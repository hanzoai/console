import type { ExecutionFilters, ExecutionGrouping } from "../types/executions";
import type { FilterTag, FilterType } from "../types/filters";
import { FILTER_COLORS } from "../types/filters";

export function generateFilterId(): string {
  return Math.random().toString(36).substr(2, 9);
}

export function createFilterTag(
  type: FilterType,
  value: string,
  customLabel?: string
): FilterTag {
  const label = customLabel || formatFilterLabel(type, value);

  return {
    id: generateFilterId(),
    type,
    value,
    label,
    color: FILTER_COLORS[type],
    removable: true,
  };
}

export function formatFilterLabel(type: FilterType, value: string): string {
  switch (type) {
    case "search":
      return value;
    case "status":
      return `Status: ${capitalizeFirst(value)}`;
    case "agent":
      return `Agent: ${value}`;
    case "workflow":
      return `Workflow: ${value}`;
    case "session":
      return `Session: ${value}`;
    case "actor":
      return `Actor: ${value}`;
    case "time":
      return `Time: ${formatTimeLabel(value)}`;
    case "group-by":
      return `Group by: ${capitalizeFirst(value)}`;
    case "sort":
      return `Sort: ${capitalizeFirst(value)}`;
    case "order":
      return value === "asc" ? "Ascending" : "Descending";
    default:
      return `${capitalizeFirst(type)}: ${value}`;
  }
}

function formatTimeLabel(value: string): string {
  switch (value) {
    case "last-hour":
      return "Last Hour";
    case "last-24h":
      return "Last 24 Hours";
    case "last-week":
      return "Last Week";
    default:
      return capitalizeFirst(value);
  }
}

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function convertTagsToApiFormat(tags: FilterTag[]): {
  filters: Partial<ExecutionFilters>;
  grouping: ExecutionGrouping;
} {
  const filters: Partial<ExecutionFilters> = {
    page: 1,
    page_size: 20,
  };

  const grouping: ExecutionGrouping = {
    group_by: "none",
    sort_by: "time",
    sort_order: "desc",
  };

  // Extract search text from search tags
  const searchTags = tags.filter((tag) => tag.type === "search");
  if (searchTags.length > 0) {
    filters.search = searchTags.map((tag) => tag.value).join(" ");
  }

  tags.forEach((tag) => {
    switch (tag.type) {
      case "status":
        filters.status = tag.value;
        break;
      case "agent":
        filters.agent_node_id = tag.value;
        break;
      case "workflow":
        filters.workflow_id = tag.value;
        break;
      case "session":
        filters.session_id = tag.value;
        break;
      case "actor":
        filters.actor_id = tag.value;
        break;
      case "time":
        const timeRange = getTimeRange(tag.value);
        if (timeRange.start_time) {
          filters.start_time = timeRange.start_time;
        }
        if (timeRange.end_time) {
          filters.end_time = timeRange.end_time;
        }
        break;
      case "group-by":
        grouping.group_by = tag.value as any;
        break;
      case "sort":
        grouping.sort_by = tag.value as any;
        break;
      case "order":
        grouping.sort_order = tag.value as any;
        break;
    }
  });

  return { filters, grouping };
}

function getTimeRange(timeValue: string): {
  start_time?: string;
  end_time?: string;
} {
  const now = new Date();
  const nowISO = now.toISOString();

  switch (timeValue) {
    case "last-hour":
      return {
        start_time: new Date(now.getTime() - 3600000).toISOString(),
        end_time: nowISO,
      };
    case "last-24h":
      return {
        start_time: new Date(now.getTime() - 86400000).toISOString(),
        end_time: nowISO,
      };
    case "last-week":
      return {
        start_time: new Date(now.getTime() - 604800000).toISOString(),
        end_time: nowISO,
      };
    default:
      return {};
  }
}

export function convertApiFormatToTags(
  filters: Partial<ExecutionFilters>,
  grouping: ExecutionGrouping
): FilterTag[] {
  const tags: FilterTag[] = [];

  // Add search tag
  if (filters.search) {
    tags.push(createFilterTag("search", filters.search));
  }

  // Add filter tags
  if (filters.status) {
    tags.push(createFilterTag("status", filters.status));
  }

  if (filters.agent_node_id) {
    tags.push(createFilterTag("agent", filters.agent_node_id));
  }

  if (filters.workflow_id) {
    tags.push(createFilterTag("workflow", filters.workflow_id));
  }

  if (filters.session_id) {
    tags.push(createFilterTag("session", filters.session_id));
  }

  if (filters.actor_id) {
    tags.push(createFilterTag("actor", filters.actor_id));
  }

  // Add time tag if time range is set
  if (filters.start_time || filters.end_time) {
    const timeLabel = getTimeLabelFromRange(
      filters.start_time,
      filters.end_time
    );
    if (timeLabel) {
      tags.push(createFilterTag("time", timeLabel));
    }
  }

  // Add grouping tags
  if (grouping.group_by && grouping.group_by !== "none") {
    tags.push(createFilterTag("group-by", grouping.group_by));
  }

  if (grouping.sort_by && grouping.sort_by !== "time") {
    tags.push(createFilterTag("sort", grouping.sort_by));
  }

  if (grouping.sort_order && grouping.sort_order !== "desc") {
    tags.push(createFilterTag("order", grouping.sort_order));
  }

  return tags;
}

function getTimeLabelFromRange(
  startTime?: string,
  endTime?: string
): string | null {
  if (!startTime || !endTime) return null;

  const start = new Date(startTime);
  const end = new Date(endTime);
  const diffMs = end.getTime() - start.getTime();

  // Check if it matches our predefined ranges (with some tolerance)
  const tolerance = 60000; // 1 minute tolerance

  if (Math.abs(diffMs - 3600000) < tolerance) {
    // 1 hour
    return "last-hour";
  } else if (Math.abs(diffMs - 86400000) < tolerance) {
    // 24 hours
    return "last-24h";
  } else if (Math.abs(diffMs - 604800000) < tolerance) {
    // 1 week
    return "last-week";
  }

  return "custom";
}

export function parseFilterInput(input: string): FilterTag[] {
  const tags: FilterTag[] = [];
  const parts = input.split(/\s+/);

  for (const part of parts) {
    if (part.includes(":")) {
      const [type, value] = part.split(":", 2);
      const filterType = type.toLowerCase() as FilterType;

      // Validate filter type
      if (Object.keys(FILTER_COLORS).includes(filterType)) {
        tags.push(createFilterTag(filterType, value));
      } else {
        // If not a valid filter type, treat as search text
        tags.push(createFilterTag("search", part));
      }
    } else if (part.trim()) {
      // Regular search text
      tags.push(createFilterTag("search", part));
    }
  }

  return tags;
}

export function serializeFiltersToUrl(tags: FilterTag[]): string {
  const params = new URLSearchParams();

  tags.forEach((tag) => {
    if (tag.type === "search") {
      const existing = params.get("q") || "";
      params.set("q", existing ? `${existing} ${tag.value}` : tag.value);
    } else {
      params.append("filter", `${tag.type}:${tag.value}`);
    }
  });

  return params.toString();
}

export function deserializeFiltersFromUrl(
  urlParams: URLSearchParams
): FilterTag[] {
  const tags: FilterTag[] = [];

  // Add search query
  const query = urlParams.get("q");
  if (query) {
    tags.push(createFilterTag("search", query));
  }

  // Add filter parameters
  const filters = urlParams.getAll("filter");
  filters.forEach((filter) => {
    if (filter.includes(":")) {
      const [type, value] = filter.split(":", 2);
      const filterType = type as FilterType;

      if (Object.keys(FILTER_COLORS).includes(filterType)) {
        tags.push(createFilterTag(filterType, value));
      }
    }
  });

  return tags;
}
