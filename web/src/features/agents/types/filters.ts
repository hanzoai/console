export interface FilterTag {
  id: string;
  type: FilterType;
  value: string;
  label: string;
  color: FilterColor;
  removable: boolean;
}

export type FilterType =
  | 'search'
  | 'status'
  | 'agent'
  | 'workflow'
  | 'session'
  | 'actor'
  | 'time'
  | 'group-by'
  | 'sort'
  | 'order';

export type FilterColor =
  | 'blue'
  | 'green'
  | 'purple'
  | 'orange'
  | 'red'
  | 'gray'
  | 'indigo'
  | 'pink';

export interface FilterSuggestion {
  id: string;
  type: FilterType;
  value: string;
  label: string;
  description?: string;
  category: string;
  keywords: string[];
}

export interface FilterState {
  tags: FilterTag[];
  searchText: string;
}

export const FILTER_COLORS: Record<FilterType, FilterColor> = {
  search: 'gray',
  status: 'blue',
  agent: 'green',
  workflow: 'purple',
  session: 'orange',
  actor: 'red',
  time: 'indigo',
  'group-by': 'pink',
  sort: 'gray',
  order: 'gray',
};

export const FILTER_SUGGESTIONS: FilterSuggestion[] = [
  // Status filters
  {
    id: 'status-running',
    type: 'status',
    value: 'running',
    label: 'Status: Running',
    description: 'Show only running executions',
    category: 'Status',
    keywords: ['status', 'running', 'active', 'in-progress'],
  },
  {
    id: 'status-completed',
    type: 'status',
    value: 'completed',
    label: 'Status: Completed',
    description: 'Show only completed executions',
    category: 'Status',
    keywords: ['status', 'completed', 'finished', 'done', 'success'],
  },
  {
    id: 'status-failed',
    type: 'status',
    value: 'failed',
    label: 'Status: Failed',
    description: 'Show only failed executions',
    category: 'Status',
    keywords: ['status', 'failed', 'error', 'failed'],
  },
  {
    id: 'status-pending',
    type: 'status',
    value: 'pending',
    label: 'Status: Pending',
    description: 'Show only pending executions',
    category: 'Status',
    keywords: ['status', 'pending', 'waiting', 'queued'],
  },

  // Time filters
  {
    id: 'time-last-hour',
    type: 'time',
    value: 'last-hour',
    label: 'Time: Last Hour',
    description: 'Show executions from the last hour',
    category: 'Time Range',
    keywords: ['time', 'hour', 'recent', 'last'],
  },
  {
    id: 'time-last-24h',
    type: 'time',
    value: 'last-24h',
    label: 'Time: Last 24 Hours',
    description: 'Show executions from the last 24 hours',
    category: 'Time Range',
    keywords: ['time', '24h', 'day', 'today', 'recent'],
  },
  {
    id: 'time-last-week',
    type: 'time',
    value: 'last-week',
    label: 'Time: Last Week',
    description: 'Show executions from the last week',
    category: 'Time Range',
    keywords: ['time', 'week', 'last', '7 days'],
  },

  // Group by filters
  {
    id: 'group-workflow',
    type: 'group-by',
    value: 'workflow',
    label: 'Group by: Workflow',
    description: 'Group executions by workflow',
    category: 'Grouping',
    keywords: ['group', 'workflow', 'organize'],
  },
  {
    id: 'group-agent',
    type: 'group-by',
    value: 'agent',
    label: 'Group by: Agent',
    description: 'Group executions by agent',
    category: 'Grouping',
    keywords: ['group', 'agent', 'organize'],
  },
  {
    id: 'group-session',
    type: 'group-by',
    value: 'session',
    label: 'Group by: Session',
    description: 'Group executions by session',
    category: 'Grouping',
    keywords: ['group', 'session', 'organize'],
  },
  {
    id: 'group-status',
    type: 'group-by',
    value: 'status',
    label: 'Group by: Status',
    description: 'Group executions by status',
    category: 'Grouping',
    keywords: ['group', 'status', 'organize'],
  },

  // Sort filters
  {
    id: 'sort-time',
    type: 'sort',
    value: 'time',
    label: 'Sort by: Time',
    description: 'Sort executions by start time',
    category: 'Sorting',
    keywords: ['sort', 'time', 'date', 'chronological'],
  },
  {
    id: 'sort-duration',
    type: 'sort',
    value: 'duration',
    label: 'Sort by: Duration',
    description: 'Sort executions by duration',
    category: 'Sorting',
    keywords: ['sort', 'duration', 'time', 'length'],
  },
  {
    id: 'sort-status',
    type: 'sort',
    value: 'status',
    label: 'Sort by: Status',
    description: 'Sort executions by status',
    category: 'Sorting',
    keywords: ['sort', 'status', 'state'],
  },

  // Order filters
  {
    id: 'order-desc',
    type: 'order',
    value: 'desc',
    label: 'Order: Descending',
    description: 'Sort in descending order (newest first)',
    category: 'Sorting',
    keywords: ['order', 'desc', 'descending', 'newest', 'latest'],
  },
  {
    id: 'order-asc',
    type: 'order',
    value: 'asc',
    label: 'Order: Ascending',
    description: 'Sort in ascending order (oldest first)',
    category: 'Sorting',
    keywords: ['order', 'asc', 'ascending', 'oldest', 'earliest'],
  },
];
