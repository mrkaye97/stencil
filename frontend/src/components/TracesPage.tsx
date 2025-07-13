import {
  useSpans,
  useSearchTraces,
  useSpanAttributes,
  type SearchTracesQuery,
  type SpanAttribute,
} from "../lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Link } from "@tanstack/react-router";
import {
  Search,
  ExternalLink,
  Clock,
  Activity,
  Filter,
  Plus,
  X,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useState, useMemo } from "react";
import type { Trace } from "../types/api";

type FilterOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "not_contains"
  | "greater_than"
  | "less_than"
  | "exists"
  | "not_exists";
type FilterType = "duration" | "service" | "operation" | "status" | "attribute";

interface QueryFilter {
  id: string;
  type: FilterType;
  field: string;
  operator: FilterOperator;
  value: string;
  attributeKey?: string; // For attribute filters
}

export default function TracesPage() {
  // Keep spans data for filter options
  const { data: allSpans, isLoading: spansLoading } = useSpans();
  const { data: spanAttributes, isLoading: spanAttributesLoading } =
    useSpanAttributes();

  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState<QueryFilter[]>([]);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Build search query from filters
  const searchQuery = useMemo((): SearchTracesQuery => {
    const query: SearchTracesQuery = { limit: 100 };
    const spanAttributeFilters: SpanAttribute[] = [];

    // Apply filters to search query
    filters.forEach((filter) => {
      if (
        !filter.value &&
        filter.operator !== "exists" &&
        filter.operator !== "not_exists"
      ) {
        return; // Skip empty filters
      }

      switch (filter.type) {
        case "service":
          if (filter.operator === "equals") {
            query.service_name = filter.value;
          }
          break;

        case "operation":
          if (filter.operator === "equals") {
            query.operation_name = filter.value;
          }
          break;

        case "duration":
          const durationMs = parseFloat(filter.value);
          const durationNs = durationMs * 1000000;

          switch (filter.operator) {
            case "greater_than":
              query.min_duration_ns = durationNs;
              break;
            case "less_than":
              query.max_duration_ns = durationNs;
              break;
            case "equals":
              query.min_duration_ns = durationNs - 1000000;
              query.max_duration_ns = durationNs + 1000000;
              break;
          }
          break;

        case "status":
          const statusCode = parseInt(filter.value);
          if (filter.operator === "equals") {
            query.status_code = statusCode;
          }
          break;

        case "attribute":
          if (filter.attributeKey && filter.value) {
            // Handle multiple values separated by commas
            const values = filter.value
              .split(",")
              .map((v) => v.trim())
              .filter(Boolean);

            // Only handle equality - backend only supports exact matches
            if (filter.operator === "equals") {
              values.forEach((value) => {
                spanAttributeFilters.push({
                  key: filter.attributeKey!,
                  value: value,
                });
              });
            }
            // Note: not_equals would need to be handled client-side if needed
          }
          break;
      }
    });

    // Add span attributes to query if any
    if (spanAttributeFilters.length > 0) {
      query.span_attributes = spanAttributeFilters;
    }

    return query;
  }, [filters]);

  // Use the search API
  const {
    data: searchResults,
    isLoading,
    error,
  } = useSearchTraces(searchQuery, true);

  // Filter options based on spans data
  const filterOptions = useMemo(() => {
    if (!allSpans) {
      return {
        services: [],
        operations: [],
        statusCodes: [],
        spanAttributes: [],
      };
    }

    const services = new Set(
      allSpans.map((span) => span.service_name).filter(Boolean) as string[]
    );
    const operations = new Set(
      allSpans.map((span) => span.operation_name).filter(Boolean) as string[]
    );
    const statusCodes = new Set(allSpans.map((span) => span.status_code));

    return {
      services: Array.from(services),
      operations: Array.from(operations),
      statusCodes: Array.from(statusCodes),
      spanAttributes: spanAttributes || [],
    };
  }, [allSpans, spanAttributes]);

  // Apply client-side search term filtering
  const filteredTraces = useMemo(() => {
    if (!searchResults) return [];

    if (searchTerm) {
      return searchResults.filter((trace) =>
        trace.trace_id.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return searchResults;
  }, [searchResults, searchTerm]);

  const addFilter = () => {
    const newFilter: QueryFilter = {
      id: Math.random().toString(36).substr(2, 9),
      type: "service",
      field: "service.name",
      operator: "equals",
      value: "",
    };
    setFilters([...filters, newFilter]);
  };

  const updateFilter = (id: string, updates: Partial<QueryFilter>) => {
    setFilters(
      filters.map((filter) =>
        filter.id === id ? { ...filter, ...updates } : filter
      )
    );
  };

  const removeFilter = (id: string) => {
    setFilters(filters.filter((filter) => filter.id !== id));
  };

  const clearAllFilters = () => {
    setFilters([]);
    setSearchTerm("");
  };

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-foreground">Traces</h1>
        <Card className="bg-destructive/10 border-destructive/20">
          <CardContent className="pt-6">
            <p className="text-destructive">
              Error loading traces: {error.message}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Traces</h1>
          <p className="text-muted-foreground mt-2">
            Distributed traces across your services
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="secondary">{filteredTraces.length} traces</Badge>
          {isLoading && (
            <Badge variant="outline" className="text-muted-foreground">
              <div className="animate-spin h-3 w-3 border border-current border-t-transparent rounded-full mr-2"></div>
              Searching...
            </Badge>
          )}
        </div>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          {/* Basic Search */}
          <div className="relative">
            <label htmlFor="trace-search" className="sr-only">
              Search traces by ID
            </label>
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="trace-search"
              placeholder="Search traces by ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              aria-describedby="search-help"
            />
            <div id="search-help" className="sr-only">
              Enter a trace ID to filter the results
            </div>
          </div>

          {/* Advanced Filters Toggle */}
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className="flex items-center gap-2"
              aria-expanded={showAdvancedFilters}
              aria-controls="advanced-filters"
            >
              <Filter className="h-4 w-4" aria-hidden="true" />
              Advanced Filters
              {showAdvancedFilters ? (
                <ChevronUp className="h-4 w-4" aria-hidden="true" />
              ) : (
                <ChevronDown className="h-4 w-4" aria-hidden="true" />
              )}
            </Button>

            {(filters.length > 0 || searchTerm) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllFilters}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4 mr-1" />
                Clear All
              </Button>
            )}
          </div>

          {/* Active Filters Summary */}
          {(filters.length > 0 || searchTerm) && (
            <div className="flex flex-wrap items-center gap-2 p-3 bg-accent/5 rounded-lg border border-accent/20">
              <span className="text-xs font-medium text-muted-foreground">
                Active filters:
              </span>
              {searchTerm && (
                <Badge
                  variant="outline"
                  className="bg-primary/10 border-primary/20 text-primary"
                >
                  Search: "{searchTerm}"
                  <X
                    className="h-3 w-3 ml-1 cursor-pointer hover:text-destructive"
                    onClick={() => setSearchTerm("")}
                  />
                </Badge>
              )}
              {filters.map((filter) => (
                <Badge
                  key={filter.id}
                  variant="outline"
                  className="bg-accent/10 border-accent/20 text-accent-foreground"
                >
                  {filter.type === "attribute"
                    ? `${filter.attributeKey || "attribute"}: ${filter.value}`
                    : `${filter.type} ${filter.operator.replace(/_/g, " ")} ${filter.value}`}
                  <X
                    className="h-3 w-3 ml-1 cursor-pointer hover:text-destructive"
                    onClick={() => removeFilter(filter.id)}
                  />
                </Badge>
              ))}
            </div>
          )}

          {/* Advanced Filters */}
          {showAdvancedFilters && (
            <div 
              id="advanced-filters"
              className="space-y-3 pt-4 border-t border-border/50"
              role="region"
              aria-label="Advanced filter options"
            >
              {filters.map((filter) => (
                <FilterRow
                  key={filter.id}
                  filter={filter}
                  filterOptions={filterOptions}
                  onUpdate={(updates) => updateFilter(filter.id, updates)}
                  onRemove={() => removeFilter(filter.id)}
                />
              ))}

              <Button
                variant="outline"
                onClick={addFilter}
                className="w-full border-dashed border-2 hover:border-primary hover:bg-primary/5"
                aria-label="Add new filter"
              >
                <Plus className="h-4 w-4 mr-2" aria-hidden="true" />
                Add Filter
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="flex-1 min-h-0">
        <CardHeader>
          <CardTitle>All Traces</CardTitle>
        </CardHeader>
        <CardContent className="h-full pb-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-muted-foreground">Loading traces...</div>
            </div>
          ) : filteredTraces.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-muted-foreground">
                {searchTerm ? "No traces match your search" : "No traces found"}
              </div>
            </div>
          ) : (
            <div className="h-full overflow-y-auto space-y-3">
              {filteredTraces.map((trace) => (
                <TraceCard key={trace.trace_id} trace={trace} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TraceCard({ trace }: { trace: Trace }) {
  const duration = trace.duration_ns
    ? Math.round(trace.duration_ns / 1000000)
    : null;
  const timeAgo = formatDistanceToNow(new Date(trace.start_time), {
    addSuffix: true,
  });

  const getStatusInfo = () => {
    if (!duration) return { variant: "outline" as const, label: "Unknown" };
    if (duration > 5000) return { variant: "error" as const, label: "Slow" };
    if (duration > 1000)
      return { variant: "warning" as const, label: "Warning" };
    return { variant: "success" as const, label: "Good" };
  };

  const status = getStatusInfo();

  return (
    <article 
      className="flex items-center justify-between p-4 bg-card rounded-lg border border-border hover:border-accent/50 hover:bg-card/80 transition-all duration-200"
      aria-labelledby={`trace-${trace.trace_id}`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 mb-3">
          <h3 
            id={`trace-${trace.trace_id}`}
            className="text-sm font-medium text-foreground truncate font-mono"
          >
            {trace.trace_id}
          </h3>
          <Badge
            variant="outline"
            className="border-border text-secondary-foreground"
            aria-label={`${trace.span_count} spans in this trace`}
          >
            {trace.span_count} spans
          </Badge>
          <Badge 
            variant={status.variant}
            aria-label={`Trace performance status: ${status.label}`}
          >
            {status.label}
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" aria-hidden="true" />
            <span>Started {timeAgo}</span>
          </div>
          {duration && (
            <div className="flex items-center gap-1">
              <Activity className="h-3 w-3" aria-hidden="true" />
              <span>{duration}ms duration</span>
            </div>
          )}
          <div className="text-secondary-foreground">
            <time dateTime={trace.start_time}>
              {new Date(trace.start_time).toLocaleString()}
            </time>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 ml-4">
        <Link to="/trace/$traceId" params={{ traceId: trace.trace_id }}>
          <Button
            variant="outline"
            size="sm"
            className="hover:bg-accent hover:text-accent-foreground hover:border-accent transition-all duration-200"
            aria-label={`View details for trace ${trace.trace_id}`}
          >
            <ExternalLink className="h-3 w-3 mr-1" aria-hidden="true" />
            View Details
          </Button>
        </Link>
      </div>
    </article>
  );
}

function FilterRow({
  filter,
  filterOptions,
  onUpdate,
  onRemove,
}: {
  filter: QueryFilter;
  filterOptions: {
    services: string[];
    operations: string[];
    statusCodes: number[];
    spanAttributes: string[];
  };
  onUpdate: (updates: Partial<QueryFilter>) => void;
  onRemove: () => void;
}) {
  const getOperatorOptions = (
    type: FilterType
  ): { value: FilterOperator; label: string }[] => {
    switch (type) {
      case "duration":
        return [
          { value: "greater_than", label: ">" },
          { value: "less_than", label: "<" },
          { value: "equals", label: "=" },
        ];
      case "service":
      case "operation":
        return [
          { value: "equals", label: "equals" },
          { value: "not_equals", label: "not equals" },
          { value: "contains", label: "contains" },
          { value: "not_contains", label: "not contains" },
        ];
      case "status":
        return [
          { value: "equals", label: "equals" },
          { value: "not_equals", label: "not equals" },
          { value: "greater_than", label: ">" },
          { value: "less_than", label: "<" },
        ];
      default:
        return [{ value: "equals", label: "equals" }];
    }
  };

  const renderValueInput = () => {
    switch (filter.type) {
      case "service":
        return (
          <Select
            value={filter.value}
            onValueChange={(value) => onUpdate({ value })}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Select service" />
            </SelectTrigger>
            <SelectContent>
              {filterOptions.services.map((service) => (
                <SelectItem key={service} value={service}>
                  {service}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case "operation":
        return (
          <Select
            value={filter.value}
            onValueChange={(value) => onUpdate({ value })}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Select operation" />
            </SelectTrigger>
            <SelectContent>
              {filterOptions.operations.map((operation) => (
                <SelectItem key={operation} value={operation}>
                  {operation}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case "status":
        return (
          <Select
            value={filter.value}
            onValueChange={(value) => onUpdate({ value })}
          >
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Status code" />
            </SelectTrigger>
            <SelectContent>
              {filterOptions.statusCodes.map((code) => (
                <SelectItem key={code} value={code.toString()}>
                  {code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case "duration":
        return (
          <div className="flex items-center gap-2">
            <Input
              type="number"
              placeholder="Duration (ms)"
              value={filter.value}
              onChange={(e) => onUpdate({ value: e.target.value })}
              className="w-32"
            />
            <span className="text-xs text-muted-foreground">ms</span>
          </div>
        );

      case "attribute":
        return (
          <Input
            placeholder="Value (use commas for multiple values)"
            value={filter.value}
            onChange={(e) => onUpdate({ value: e.target.value })}
            className="w-60"
          />
        );

      default:
        return (
          <Input
            placeholder="Value"
            value={filter.value}
            onChange={(e) => onUpdate({ value: e.target.value })}
            className="w-40"
          />
        );
    }
  };

  return (
    <div className="flex items-center gap-3 p-3 bg-card/50 rounded-lg border border-border">
      <Select
        value={filter.type}
        onValueChange={(value) =>
          onUpdate({
            type: value as FilterType,
            field:
              value === "service"
                ? "service.name"
                : value === "operation"
                  ? "operation.name"
                  : value === "attribute"
                    ? "attribute"
                    : value,
            operator: "equals",
            value: "",
            attributeKey: value === "attribute" ? "" : undefined,
          })
        }
      >
        <SelectTrigger className="w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="service">Service</SelectItem>
          <SelectItem value="operation">Operation</SelectItem>
          <SelectItem value="duration">Duration</SelectItem>
          <SelectItem value="status">Status</SelectItem>
          <SelectItem value="attribute">Attribute</SelectItem>
        </SelectContent>
      </Select>

      {/* For attribute filters, show attribute key selector first */}
      {filter.type === "attribute" && (
        <Select
          value={filter.attributeKey || ""}
          onValueChange={(value) => onUpdate({ attributeKey: value })}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Select key" />
          </SelectTrigger>
          <SelectContent>
            {filterOptions.spanAttributes.map((attr) => (
              <SelectItem key={attr} value={attr}>
                {attr}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Only show operator dropdown for non-attribute filters */}
      {filter.type !== "attribute" && (
        <Select
          value={filter.operator}
          onValueChange={(value) =>
            onUpdate({ operator: value as FilterOperator })
          }
        >
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {getOperatorOptions(filter.type).map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {renderValueInput()}

      <Button
        variant="ghost"
        size="sm"
        onClick={onRemove}
        className="text-muted-foreground hover:text-destructive"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
