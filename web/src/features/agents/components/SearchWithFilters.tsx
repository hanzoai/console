import React, { useState, useEffect, useRef } from 'react';
import { Command } from 'cmdk';
import { Search, ChevronDown } from "@/src/features/agents/components/ui/icon-bridge";
import { cn } from '../lib/utils';
import { FilterTag } from './FilterTag';
import type { FilterTag as FilterTagType, FilterSuggestion } from '../types/filters';
import { FILTER_SUGGESTIONS } from '../types/filters';
import { parseFilterInput, createFilterTag } from '../utils/filterUtils';

interface SearchWithFiltersProps {
  tags: FilterTagType[];
  onTagsChange: (tags: FilterTagType[]) => void;
  placeholder?: string;
  className?: string;
}

export function SearchWithFilters({
  tags,
  onTagsChange,
  placeholder = "Search executions or add filters like status:running, agent:support...",
  className,
}: SearchWithFiltersProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [filteredSuggestions, setFilteredSuggestions] = useState<FilterSuggestion[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter suggestions based on input
  useEffect(() => {
    if (!inputValue.trim()) {
      setFilteredSuggestions(FILTER_SUGGESTIONS.slice(0, 12)); // Show top suggestions
      return;
    }

    const query = inputValue.toLowerCase();
    const filtered = FILTER_SUGGESTIONS.filter(suggestion => {
      // Check if already applied
      const isApplied = tags.some(tag =>
        tag.type === suggestion.type && tag.value === suggestion.value
      );
      if (isApplied) return false;

      // Match against keywords, label, or description
      return (
        suggestion.keywords.some(keyword => keyword.includes(query)) ||
        suggestion.label.toLowerCase().includes(query) ||
        suggestion.description?.toLowerCase().includes(query) ||
        suggestion.category.toLowerCase().includes(query)
      );
    }).slice(0, 8);

    setFilteredSuggestions(filtered);
  }, [inputValue, tags]);

  // Group suggestions by category
  const groupedSuggestions = filteredSuggestions.reduce((acc, suggestion) => {
    if (!acc[suggestion.category]) {
      acc[suggestion.category] = [];
    }
    acc[suggestion.category].push(suggestion);
    return acc;
  }, {} as Record<string, FilterSuggestion[]>);

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      e.preventDefault();
      handleAddFromInput();
    } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      // Remove last tag when backspacing on empty input
      const newTags = [...tags];
      newTags.pop();
      onTagsChange(newTags);
    }
  };

  const handleAddFromInput = () => {
    if (!inputValue.trim()) return;

    const newTags = parseFilterInput(inputValue);
    if (newTags.length > 0) {
      onTagsChange([...tags, ...newTags]);
      setInputValue('');
      setOpen(false);
    }
  };

  const handleSuggestionSelect = (suggestion: FilterSuggestion) => {
    const newTag = createFilterTag(suggestion.type, suggestion.value, suggestion.label);
    onTagsChange([...tags, newTag]);
    setInputValue('');
    setOpen(false);
    inputRef.current?.focus();
  };

  const handleRemoveTag = (tagId: string) => {
    onTagsChange(tags.filter(tag => tag.id !== tagId));
  };

  const handleInputFocus = () => {
    setOpen(true);
  };

  const handleInputBlur = (e: React.FocusEvent) => {
    // Don't close if clicking on a suggestion
    if (containerRef.current?.contains(e.relatedTarget as Node)) {
      return;
    }
    setTimeout(() => setOpen(false), 150);
  };

  return (
    <div className={cn('relative w-full', className)} ref={containerRef}>
      <Command className="relative">
        {/* Main search container */}
        <div className="relative flex min-h-12 w-full rounded-lg border border-border bg-background shadow-sm transition-all duration-200 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 hover:border-border/80">
          {/* Search icon */}
          <div className="flex items-center pl-3">
            <Search size={16} className="text-muted-foreground" />
          </div>

          {/* Tags and input container */}
          <div className="flex flex-1 flex-wrap items-center gap-1.5 px-2 py-2">
            {/* Filter tags */}
            {tags.map((tag) => (
              <FilterTag
                key={tag.id}
                tag={tag}
                onRemove={handleRemoveTag}
                className="flex-shrink-0"
              />
            ))}

            {/* Input field */}
            <Command.Input
              ref={inputRef}
              value={inputValue}
              onValueChange={setInputValue}
              onKeyDown={handleInputKeyDown}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
              placeholder={tags.length === 0 ? placeholder : "Add more filters..."}
              className="flex-1 min-w-32 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>

          {/* Command Hint & Dropdown indicator */}
          <div className="flex items-center pr-3 gap-2">
            {!inputValue && tags.length === 0 && (
              <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100 sm:flex">
                <span className="text-xs">⌘</span>K
              </kbd>
            )}
            <ChevronDown
              size={16}
              className={cn(
                "text-muted-foreground transition-transform duration-200",
                open && "rotate-180"
              )}
            />
          </div>
        </div>

        {/* Suggestions dropdown */}
        {open && (
          <Command.List className="absolute top-full left-0 right-0 z-50 mt-2 max-h-96 overflow-hidden rounded-xl border border-border bg-popover shadow-xl backdrop-blur-sm">
            {Object.keys(groupedSuggestions).length === 0 ? (
              <div className="px-6 py-12 text-center">
                {inputValue ? (
                  <div className="space-y-3">
                    <div className="text-sm font-medium text-foreground">
                      No matching filters found
                    </div>
                    <div className="text-body-small">
                      Press <kbd className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">Enter</kbd> to search for "{inputValue}"
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-foreground">
                      Filter suggestions
                    </div>
                    <div className="text-body-small">
                      Start typing to see available filters
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="overflow-auto max-h-96">
                {Object.entries(groupedSuggestions).map(([category, suggestions], categoryIndex) => (
                  <div key={category}>
                    {categoryIndex > 0 && <div className="border-t border-border/50" />}
                    <Command.Group>
                      {/* Category header */}
                      <div className="px-4 py-3 bg-muted/30">
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          {category}
                        </h4>
                      </div>

                      {/* Category items */}
                      <div className="px-2 py-1">
                        {suggestions.map((suggestion) => (
                          <Command.Item
                            key={suggestion.id}
                            value={suggestion.id}
                            onSelect={() => handleSuggestionSelect(suggestion)}
                            className="group flex cursor-pointer items-center justify-between rounded-lg px-3 py-3 text-sm transition-all duration-150 hover:bg-accent/80 data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground"
                          >
                            <div className="flex flex-col space-y-1 min-w-0 flex-1">
                              <div className="flex items-center space-x-2">
                                <span className="font-medium text-foreground group-hover:text-accent-foreground truncate">
                                  {suggestion.label}
                                </span>
                                <div className="flex-shrink-0">
                                  <kbd className="inline-flex items-center rounded-md bg-muted/80 px-2 py-1 text-[10px] font-mono text-muted-foreground group-hover:bg-accent-foreground/10 group-hover:text-accent-foreground/70">
                                    {suggestion.type}:{suggestion.value}
                                  </kbd>
                                </div>
                              </div>
                              {suggestion.description && (
                                <span className="text-body-small group-hover:text-accent-foreground/70 line-clamp-1">
                                  {suggestion.description}
                                </span>
                              )}
                            </div>
                          </Command.Item>
                        ))}
                      </div>
                    </Command.Group>
                  </div>
                ))}
              </div>
            )}
          </Command.List>
        )}
      </Command>
    </div>
  );
}
