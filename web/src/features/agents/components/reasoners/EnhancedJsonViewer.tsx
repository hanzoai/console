import { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Copy,
  List,
  Document,
  Maximize
} from '@/src/features/agents/components/ui/icon-bridge';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import { SmartStringRenderer } from './SmartStringRenderer';
import { JsonModal } from './JsonModal';

interface EnhancedJsonViewerProps {
  data: any;
  title?: string;
  className?: string;
  maxInlineHeight?: number;
}

interface JsonItem {
  key: string;
  value: any;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'null';
  path: string[];
  isExpandable: boolean;
}

export function EnhancedJsonViewer({
  data,
  className = "",
  maxInlineHeight = 200
}: EnhancedJsonViewerProps) {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    content: any;
    path: string[];
    title: string;
  }>({
    isOpen: false,
    content: null,
    path: [],
    title: ''
  });

  const toggleExpanded = (itemKey: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(itemKey)) {
      newExpanded.delete(itemKey);
    } else {
      newExpanded.add(itemKey);
    }
    setExpandedItems(newExpanded);
  };

  const openModal = (content: any, path: string[], itemTitle: string) => {
    setModalState({
      isOpen: true,
      content,
      path,
      title: itemTitle
    });
  };

  const closeModal = () => {
    setModalState({
      isOpen: false,
      content: null,
      path: [],
      title: ''
    });
  };

  const copyToClipboard = (content: any) => {
    const text = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
    navigator.clipboard.writeText(text);
  };

  const processJsonData = (obj: any, parentPath: string[] = []): JsonItem[] => {
    if (obj === null || obj === undefined) {
      return [];
    }

    if (typeof obj !== 'object') {
      return [{
        key: 'value',
        value: obj,
        type: typeof obj as any,
        path: parentPath,
        isExpandable: false
      }];
    }

    if (Array.isArray(obj)) {
      return [{
        key: 'array',
        value: obj,
        type: 'array',
        path: parentPath,
        isExpandable: obj.length > 0
      }];
    }

    return Object.entries(obj).map(([key, value]) => {
      const path = [...parentPath, key];
      const type = value === null ? 'null' :
                  Array.isArray(value) ? 'array' :
                  typeof value;

      return {
        key,
        value,
        type: type as any,
        path,
        isExpandable: type === 'object' || type === 'array'
      };
    });
  };

  const formatLabel = (key: string): string => {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/[_-]/g, ' ')
      .replace(/\b\w/g, (match) => match.toUpperCase())
      .trim();
  };

  const renderValue = (item: JsonItem) => {
    const itemKey = item.path.join('.');
    const isExpanded = expandedItems.has(itemKey);

    switch (item.type) {
      case 'string':
        return (
          <SmartStringRenderer
            content={item.value}
            label={item.key}
            path={item.path}
            onOpenModal={() => openModal(item.value, item.path, formatLabel(item.key))}
            maxInlineHeight={maxInlineHeight}
          />
        );

      case 'number':
        return (
          <div className="flex items-center gap-2">
            <span className="text-sm font-mono text-foreground">
              {item.value.toLocaleString()}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => copyToClipboard(item.value)}
              className="h-6 w-6 p-0"
            >
              <Copy className="h-3 w-3" />
            </Button>
          </div>
        );

      case 'boolean':
        return (
          <div className="flex items-center gap-2">
            <Badge variant={item.value ? "default" : "secondary"} className="text-xs">
              {item.value ? 'true' : 'false'}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => copyToClipboard(item.value)}
              className="h-6 w-6 p-0"
            >
              <Copy className="h-3 w-3" />
            </Button>
          </div>
        );

      case 'null':
        return (
          <div className="flex items-center gap-2">
            <span className="text-body-small italic">null</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => copyToClipboard(null)}
              className="h-6 w-6 p-0"
            >
              <Copy className="h-3 w-3" />
            </Button>
          </div>
        );

      case 'array':
        return (
          <div className="space-y-2">
            <Collapsible open={isExpanded} onOpenChange={() => toggleExpanded(itemKey)}>
              <div className="flex items-center gap-2">
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-3 w-3" />
                    ) : (
                      <ChevronRight className="h-3 w-3" />
                    )}
                  </Button>
                </CollapsibleTrigger>

                <div className="flex items-center gap-2 flex-1">
                  <List className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-foreground">
                    Array
                  </span>
                  <Badge variant="secondary" className="text-xs">
                    {item.value.length} items
                  </Badge>
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(item.value)}
                    className="h-6 w-6 p-0"
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openModal(item.value, item.path, formatLabel(item.key))}
                    className="h-6 w-6 p-0"
                  >
                    <Maximize className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              <CollapsibleContent>
                <div className="ml-6 mt-2 space-y-2">
                  {item.value.slice(0, 10).map((arrayItem: any, index: number) => (
                    <div key={index} className="flex items-start gap-2 p-2 bg-muted/30 rounded text-sm">
                      <span className="text-muted-foreground font-mono text-xs mt-0.5 flex-shrink-0">
                        [{index}]
                      </span>
                      <div className="flex-1 min-w-0">
                        {typeof arrayItem === 'string' ? (
                          <SmartStringRenderer
                            content={arrayItem}
                            label={`${item.key}[${index}]`}
                            path={[...item.path, index.toString()]}
                            onOpenModal={() => openModal(arrayItem, [...item.path, index.toString()], `${formatLabel(item.key)}[${index}]`)}
                            maxInlineHeight={100}
                          />
                        ) : typeof arrayItem === 'object' && arrayItem !== null ? (
                          <div className="text-xs">
                            <pre className="text-foreground whitespace-pre-wrap break-words overflow-hidden">
                              {JSON.stringify(arrayItem, null, 2)}
                            </pre>
                          </div>
                        ) : (
                          <span className="text-foreground">
                            {String(arrayItem)}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                  {item.value.length > 10 && (
                    <div className="text-body-small text-center py-2">
                      ... and {item.value.length - 10} more items
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        );

      case 'object':
        return (
          <div className="space-y-2">
            <Collapsible open={isExpanded} onOpenChange={() => toggleExpanded(itemKey)}>
              <div className="flex items-center gap-2">
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-3 w-3" />
                    ) : (
                      <ChevronRight className="h-3 w-3" />
                    )}
                  </Button>
                </CollapsibleTrigger>

                <div className="flex items-center gap-2 flex-1">
                  <Document className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-foreground">
                    Object
                  </span>
                  <Badge variant="secondary" className="text-xs">
                    {Object.keys(item.value).length} keys
                  </Badge>
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(item.value)}
                    className="h-6 w-6 p-0"
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openModal(item.value, item.path, formatLabel(item.key))}
                    className="h-6 w-6 p-0"
                  >
                    <Maximize className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              <CollapsibleContent>
                <div className="ml-6 mt-2">
                  <EnhancedJsonViewer
                    data={item.value}
                    maxInlineHeight={maxInlineHeight}
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        );

      default:
        return (
          <div className="flex items-center gap-2">
            <span className="text-sm text-foreground">
              {String(item.value)}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => copyToClipboard(item.value)}
              className="h-6 w-6 p-0"
            >
              <Copy className="h-3 w-3" />
            </Button>
          </div>
        );
    }
  };

  const items = processJsonData(data);

  if (items.length === 0) {
    return (
      <div className={`text-center py-8 text-muted-foreground ${className}`}>
        <Document className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>No data to display</p>
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {items.map((item, index) => (
        <div key={`${item.key}-${index}`} className="space-y-2">
          {/* Key-Value Row */}
          <div className="flex items-start gap-3 py-2">
            {/* Key */}
            <div className="flex-shrink-0 w-32 sm:w-40 min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm font-medium text-foreground truncate block min-w-0" title={formatLabel(item.key)}>
                  {formatLabel(item.key)}
                </span>
                {item.type !== 'string' && item.type !== 'number' && item.type !== 'boolean' && item.type !== 'null' && (
                  <Badge variant="outline" className="text-xs flex-shrink-0">
                    {item.type}
                  </Badge>
                )}
              </div>
            </div>

            {/* Value */}
            <div className="flex-1 min-w-0">
              {renderValue(item)}
            </div>
          </div>

          {/* Separator */}
          {index < items.length - 1 && (
            <div className="border-b border-border/50" />
          )}
        </div>
      ))}

      {/* Modal */}
      <JsonModal
        isOpen={modalState.isOpen}
        onClose={closeModal}
        content={modalState.content}
        path={modalState.path}
        title={modalState.title}
      />
    </div>
  );
}
