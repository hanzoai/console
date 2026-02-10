import { useState, useEffect } from 'react';
import type { SearchFiltersProps } from '../../types/reasoners';
import { SearchBar } from "@/src/features/agents/components/ui/SearchBar";

export function SearchFilters({
  filters,
  onFiltersChange,
  totalCount = 0,
  onlineCount = 0,
  offlineCount = 0
}: SearchFiltersProps) {
  const [searchInput, setSearchInput] = useState(filters?.search || '');

  // Ensure we have safe values
  const safeTotalCount = totalCount ?? 0;
  const safeOnlineCount = onlineCount ?? 0;
  const safeOfflineCount = offlineCount ?? 0;
  const safeFilters = filters || { status: 'online' };

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      if (onFiltersChange) {
        onFiltersChange({ ...safeFilters, search: searchInput || undefined });
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchInput]);

  const handleStatusChange = (status: 'all' | 'online' | 'offline') => {
    if (onFiltersChange) {
      onFiltersChange({ ...safeFilters, status });
    }
  };

  const clearFilters = () => {
    setSearchInput('');
    if (onFiltersChange) {
      onFiltersChange({ status: 'online' }); // Default to online instead of all
    }
  };

  const hasActiveFilters = safeFilters.status !== 'online' || safeFilters.search;

  return (
    <div className="bg-[var(--bg-tertiary)] border border-[var(--border-secondary)] rounded-xl p-4 mb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[var(--text-primary)] font-medium text-sm">Filter Reasoners</h2>
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] text-xs transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Search Input */}
      <div className="mb-4">
        <SearchBar
          value={searchInput}
          onChange={setSearchInput}
          placeholder="Search reasoners..."
          size="md"
          wrapperClassName="w-full"
          inputClassName={`
            border border-[var(--border)] rounded-lg bg-[var(--bg-primary)]
            text-[var(--text-primary)] placeholder-[var(--text-quaternary)]
            focus-visible:ring-1 focus-visible:ring-[var(--input-focus)]
            focus-visible:border-[var(--input-focus)]
          `}
          clearButtonAriaLabel="Clear reasoner search"
        />
      </div>

      {/* Status Filter Buttons - Reordered with Online first */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-[var(--text-secondary)] text-xs font-medium mr-2">Status:</span>

        <button
          onClick={() => handleStatusChange('online')}
          className={`
            inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg
            transition-all duration-200
            ${safeFilters.status === 'online'
              ? 'text-[var(--status-success-light)] bg-[var(--status-success-bg)] border border-[var(--status-success-border)]'
              : 'text-[var(--text-secondary)] bg-[var(--bg-secondary)] border border-[var(--border)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
            }
          `}
        >
          <div className="w-2 h-2 bg-[var(--status-success)] rounded-full" />
          Online
          <span className="text-[var(--text-tertiary)]">({safeOnlineCount})</span>
        </button>

        <button
          onClick={() => handleStatusChange('all')}
          className={`
            inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg
            transition-all duration-200
            ${safeFilters.status === 'all'
              ? 'text-[var(--status-info)] bg-[var(--status-info-bg)] border border-[var(--status-info-border)]'
              : 'text-[var(--text-secondary)] bg-[var(--bg-secondary)] border border-[var(--border)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
            }
          `}
        >
          All
          <span className="text-[var(--text-tertiary)]">({safeTotalCount})</span>
        </button>

        <button
          onClick={() => handleStatusChange('offline')}
          className={`
            inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg
            transition-all duration-200
            ${safeFilters.status === 'offline'
              ? 'text-[var(--status-neutral-light)] bg-[var(--status-neutral-bg)] border border-[var(--status-neutral-border)]'
              : 'text-[var(--text-secondary)] bg-[var(--bg-secondary)] border border-[var(--border)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
            }
          `}
        >
          <div className="w-2 h-2 bg-[var(--status-neutral)] rounded-full" />
          Offline
          <span className="text-[var(--text-tertiary)]">({safeOfflineCount})</span>
        </button>
      </div>

      {/* Results Summary */}
      <div className="flex items-center justify-between text-xs">
        <div className="text-[var(--text-secondary)]">
          {safeFilters.search ? (
            <>
              Found <span className="text-[var(--text-primary)] font-medium">{safeTotalCount}</span> reasoners
              {safeFilters.search && (
                <> matching "<span className="text-[var(--text-primary)] font-medium">{safeFilters.search}</span>"</>
              )}
            </>
          ) : (
            <>
              Showing <span className="text-[var(--text-primary)] font-medium">{safeTotalCount}</span> reasoners
            </>
          )}
        </div>

        {hasActiveFilters && (
          <div className="flex items-center gap-1 text-[var(--text-tertiary)]">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.414A1 1 0 013 6.707V4z" />
            </svg>
            <span>Filtered</span>
          </div>
        )}
      </div>
    </div>
  );
}
