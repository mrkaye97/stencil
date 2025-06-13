import { useState, useMemo, useEffect } from "react";
import { useTraces, useSpans } from "../lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  Search,
  Filter,
  Plus,
  X,
  Play,
  Clock,
  Network,
  Database,
  Download,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Link } from "@tanstack/react-router";
import type { Trace, Span } from "../types/api";

// Filter types
type FilterOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "not_contains"
  | "greater_than"
  | "less_than"
  | "exists"
  | "not_exists";
type FilterType = "duration" | "service" | "operation" | "status";

interface QueryFilter {
  id: string;
  type: FilterType;
  field: string;
  operator: FilterOperator;
  value: string;
}

interface QueryResult {
  traces: Trace[];
  totalCount: number;
  avgDuration: number;
  errorRate: number;
}

export default function QueryPage() {
  const { data: allTraces, isLoading: tracesLoading } = useTraces();
  const { data: allSpans, isLoading: spansLoading } = useSpans();

  const [filters, setFilters] = useState<QueryFilter[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isQueryRunning, setIsQueryRunning] = useState(false);

  // Available filter options based on actual data
  const filterOptions = useMemo(() => {
    if (!allSpans) return {};

    const services = new Set(
      allSpans.map((span) => span.service_name).filter(Boolean)
    );
    const operations = new Set(
      allSpans.map((span) => span.operation_name).filter(Boolean)
    );
    const statusCodes = new Set(allSpans.map((span) => span.status_code));

    return {
      services: Array.from(services),
      operations: Array.from(operations),
      statusCodes: Array.from(statusCodes),
    };
  }, [allSpans]);

  // Execute query and filter results
  const queryResults = useMemo((): QueryResult => {
    if (!allTraces || !allSpans) {
      return { traces: [], totalCount: 0, avgDuration: 0, errorRate: 0 };
    }

    let filteredTraces = allTraces;

    // Apply search filter
    if (searchTerm) {
      filteredTraces = filteredTraces.filter((trace) =>
        trace.trace_id.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply custom filters
    filteredTraces = filteredTraces.filter((trace) => {
      const traceSpans = allSpans.filter(
        (span) => span.trace_id === trace.trace_id
      );

      return filters.every((filter) => {
        switch (filter.type) {
          case "duration":
            if (!trace.duration_ns) return false;
            const durationMs = trace.duration_ns / 1000000;
            const filterValue = parseFloat(filter.value);

            switch (filter.operator) {
              case "greater_than":
                return durationMs > filterValue;
              case "less_than":
                return durationMs < filterValue;
              case "equals":
                return Math.abs(durationMs - filterValue) < 1;
              default:
                return true;
            }

          case "service":
            const hasService = traceSpans.some((span) => {
              const serviceName = span.service_name || "";
              switch (filter.operator) {
                case "equals":
                  return serviceName === filter.value;
                case "not_equals":
                  return serviceName !== filter.value;
                case "contains":
                  return serviceName
                    .toLowerCase()
                    .includes(filter.value.toLowerCase());
                case "not_contains":
                  return !serviceName
                    .toLowerCase()
                    .includes(filter.value.toLowerCase());
                case "exists":
                  return Boolean(serviceName);
                case "not_exists":
                  return !Boolean(serviceName);
                default:
                  return true;
              }
            });
            return hasService;

          case "operation":
            const hasOperation = traceSpans.some((span) => {
              const operationName = span.operation_name || "";
              switch (filter.operator) {
                case "equals":
                  return operationName === filter.value;
                case "not_equals":
                  return operationName !== filter.value;
                case "contains":
                  return operationName
                    .toLowerCase()
                    .includes(filter.value.toLowerCase());
                case "not_contains":
                  return !operationName
                    .toLowerCase()
                    .includes(filter.value.toLowerCase());
                default:
                  return true;
              }
            });
            return hasOperation;

          case "status":
            const hasStatus = traceSpans.some((span) => {
              const statusCode = span.status_code;
              const filterValue = parseInt(filter.value);

              switch (filter.operator) {
                case "equals":
                  return statusCode === filterValue;
                case "not_equals":
                  return statusCode !== filterValue;
                case "greater_than":
                  return statusCode > filterValue;
                case "less_than":
                  return statusCode < filterValue;
                default:
                  return true;
              }
            });
            return hasStatus;

          default:
            return true;
        }
      });
    });

    // Calculate statistics
    const totalCount = filteredTraces.length;
    const avgDuration =
      filteredTraces.reduce((sum, trace) => {
        return sum + (trace.duration_ns ? trace.duration_ns / 1000000 : 0);
      }, 0) / (totalCount || 1);

    const errorTraces = filteredTraces.filter((trace) => {
      const traceSpans = allSpans.filter(
        (span) => span.trace_id === trace.trace_id
      );
      return traceSpans.some((span) => span.status_code >= 400);
    });
    const errorRate =
      totalCount > 0 ? (errorTraces.length / totalCount) * 100 : 0;

    return {
      traces: filteredTraces.slice(0, 100), // Limit results for performance
      totalCount,
      avgDuration,
      errorRate,
    };
  }, [allTraces, allSpans, filters, searchTerm]);

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

  const runQuery = () => {
    setIsQueryRunning(true);
    // Simulate query execution
    setTimeout(() => setIsQueryRunning(false), 1000);
  };

  const operatorOptions = {
    attribute: [
      "equals",
      "not_equals",
      "contains",
      "not_contains",
      "exists",
      "not_exists",
    ],
    duration: ["equals", "greater_than", "less_than"],
    service: [
      "equals",
      "not_equals",
      "contains",
      "not_contains",
      "exists",
      "not_exists",
    ],
    operation: ["equals", "not_equals", "contains", "not_contains"],
    status: ["equals", "not_equals", "greater_than", "less_than"],
  };

  // Preset queries for common use cases
  const presetQueries = [
    {
      id: "slow-traces",
      name: "Slow Traces",
      description: "Traces taking longer than 5 seconds",
      filters: [
        {
          id: "preset-slow",
          type: "duration" as FilterType,
          field: "duration",
          operator: "greater_than" as FilterOperator,
          value: "5000",
        },
      ],
    },
    {
      id: "error-traces",
      name: "Error Traces",
      description: "Traces with status code >= 400",
      filters: [
        {
          id: "preset-error",
          type: "status" as FilterType,
          field: "status_code",
          operator: "greater_than" as FilterOperator,
          value: "399",
        },
      ],
    },
    {
      id: "recent-traces",
      name: "Recent Traces",
      description: "All traces (no filters)",
      filters: [],
    },
  ];

  const applyPresetQuery = (preset: (typeof presetQueries)[0]) => {
    setFilters(preset.filters);
    setSearchTerm("");
  };

  const clearAllFilters = () => {
    setFilters([]);
    setSearchTerm("");
  };

  // Keyboard shortcuts and auto-run
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl/Cmd + Enter to run query
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        runQuery();
      }
      // Ctrl/Cmd + K to focus search
      if ((event.ctrlKey || event.metaKey) && event.key === "k") {
        event.preventDefault();
        const searchInput = document.querySelector(
          'input[placeholder*="Search traces"]'
        ) as HTMLInputElement;
        searchInput?.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Auto-run query when filters change (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      // Auto-execute query after 500ms of no changes
      if (filters.length > 0 || searchTerm) {
        setIsQueryRunning(true);
        setTimeout(() => setIsQueryRunning(false), 300);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [filters, searchTerm]);

  if (tracesLoading || spansLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-foreground">Query</h1>
        <div className="text-muted-foreground">Loading data...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Query</h1>
          <p className="text-muted-foreground mt-2">
            Filter and analyze your traces with custom queries
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-muted-foreground">
            {queryResults.totalCount} results
          </Badge>
          {(filters.length > 0 || searchTerm) && (
            <Badge
              variant="secondary"
              className="bg-accent/10 text-accent-foreground"
            >
              {filters.length + (searchTerm ? 1 : 0)} active filters
            </Badge>
          )}
          {(filters.length > 0 || searchTerm) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                // In a real app, this would open a save dialog
                const queryName = prompt("Save this query as:");
                if (queryName) {
                  alert(
                    `Query "${queryName}" saved! (Demo - not actually saved)`
                  );
                }
              }}
            >
              Save Query
            </Button>
          )}
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Preset Queries */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-accent" />
            Quick Queries
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {presetQueries.map((preset) => (
              <Button
                key={preset.id}
                variant="outline"
                size="sm"
                onClick={() => applyPresetQuery(preset)}
                className="flex flex-col items-start h-auto p-3 hover:bg-accent/5 hover:border-accent"
              >
                <span className="font-medium text-sm">{preset.name}</span>
                <span className="text-xs text-muted-foreground mt-1">
                  {preset.description}
                </span>
              </Button>
            ))}
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllFilters}
              className="flex flex-col items-center h-auto p-3 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4 mb-1" />
              <span className="text-xs">Clear All</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Query Builder */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5 text-primary" />
                Query Builder
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Tip: Press ⌘+K to focus search, ⌘+Enter to run query
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="text-xs text-muted-foreground"
              >
                Auto-run enabled
              </Badge>
              <Button
                onClick={runQuery}
                disabled={isQueryRunning}
                className="bg-primary hover:bg-primary/90"
              >
                <Play className="h-4 w-4 mr-2" />
                {isQueryRunning ? "Running..." : "Run Query"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search traces by ID... (e.g., abc123def456)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
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
                  {filter.type} {filter.operator.replace(/_/g, " ")}{" "}
                  {filter.value}
                  <X
                    className="h-3 w-3 ml-1 cursor-pointer hover:text-destructive"
                    onClick={() => removeFilter(filter.id)}
                  />
                </Badge>
              ))}
            </div>
          )}

          {/* Filters */}
          <div className="space-y-3">
            {filters.map((filter) => (
              <FilterRow
                key={filter.id}
                filter={filter}
                filterOptions={filterOptions}
                operatorOptions={operatorOptions[filter.type]}
                onUpdate={(updates) => updateFilter(filter.id, updates)}
                onRemove={() => removeFilter(filter.id)}
              />
            ))}

            <Button
              variant="outline"
              onClick={addFilter}
              className="w-full border-dashed border-2 hover:border-primary hover:bg-primary/5"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Filter
            </Button>
          </div>

          {/* Preset Queries */}
          <div className="pt-4 border-t border-border/50">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">
              Preset Queries
            </h3>
            <div className="space-y-2">
              {presetQueries.map((preset) => (
                <div
                  key={preset.id}
                  className="flex flex-col p-3 rounded-lg bg-muted cursor-pointer hover:bg-muted/80 transition-all duration-200"
                  onClick={() => applyPresetQuery(preset)}
                >
                  <span className="text-sm font-medium text-foreground">
                    {preset.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {preset.description}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Clear Filters Button */}
          <div className="pt-4 border-t border-border/50">
            <Button
              variant="outline"
              onClick={clearAllFilters}
              className="w-full"
            >
              Clear All Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Query Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Traces</CardTitle>
            <Network className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {queryResults.totalCount.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Matching your query</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Duration</CardTitle>
            <Clock className="h-4 w-4 text-chart-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {Math.round(queryResults.avgDuration)}ms
            </div>
            <p className="text-xs text-muted-foreground">
              Average response time
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
            <Database className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {queryResults.errorRate.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">Traces with errors</p>
          </CardContent>
        </Card>
      </div>

      {/* Results */}
      <Card className="flex-1 min-h-0">
        <CardHeader>
          <CardTitle>Query Results</CardTitle>
        </CardHeader>
        <CardContent className="h-full pb-6">
          {queryResults.traces.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">
                  No traces found
                </h3>
                <p className="text-muted-foreground">
                  Try adjusting your filters or search terms
                </p>
              </div>
            </div>
          ) : (
            <div className="h-full overflow-y-auto space-y-2">
              {queryResults.traces.map((trace) => (
                <TraceResultCard key={trace.trace_id} trace={trace} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Filter Row Component
function FilterRow({
  filter,
  filterOptions,
  operatorOptions,
  onUpdate,
  onRemove,
}: {
  filter: QueryFilter;
  filterOptions: any;
  operatorOptions: string[];
  onUpdate: (updates: Partial<QueryFilter>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-3 p-4 bg-muted/30 rounded-lg border border-border/50 hover:bg-muted/40 transition-colors">
      <div className="text-xs text-muted-foreground font-medium min-w-[60px]">
        WHERE
      </div>

      <Select
        value={filter.type}
        onValueChange={(value: FilterType) =>
          onUpdate({ type: value, operator: "equals", value: "" })
        }
      >
        <SelectTrigger className="w-36">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="service">Service Name</SelectItem>
          <SelectItem value="operation">Operation</SelectItem>
          <SelectItem value="duration">Duration (ms)</SelectItem>
          <SelectItem value="status">Status Code</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={filter.operator}
        onValueChange={(value: FilterOperator) => onUpdate({ operator: value })}
      >
        <SelectTrigger className="w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {operatorOptions.map((op) => {
            const operatorLabels = {
              equals: "equals",
              not_equals: "does not equal",
              contains: "contains",
              not_contains: "does not contain",
              greater_than: "greater than",
              less_than: "less than",
              exists: "exists",
              not_exists: "does not exist",
            };
            return (
              <SelectItem key={op} value={op}>
                {operatorLabels[op as keyof typeof operatorLabels] || op}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>

      {filter.operator !== "exists" && filter.operator !== "not_exists" && (
        <>
          {filter.type === "service" && filterOptions.services?.length > 0 ? (
            <Select
              value={filter.value}
              onValueChange={(value) => onUpdate({ value })}
            >
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select service..." />
              </SelectTrigger>
              <SelectContent>
                {filterOptions.services.map((service: string) => (
                  <SelectItem key={service} value={service}>
                    {service}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : filter.type === "operation" &&
            filterOptions.operations?.length > 0 ? (
            <Select
              value={filter.value}
              onValueChange={(value) => onUpdate({ value })}
            >
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select operation..." />
              </SelectTrigger>
              <SelectContent>
                {filterOptions.operations.map((operation: string) => (
                  <SelectItem key={operation} value={operation}>
                    {operation}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              placeholder={
                filter.type === "duration"
                  ? "Duration in ms..."
                  : filter.type === "status"
                    ? "Status code..."
                    : "Value..."
              }
              value={filter.value}
              onChange={(e) => onUpdate({ value: e.target.value })}
              className="flex-1"
              type={
                filter.type === "duration" || filter.type === "status"
                  ? "number"
                  : "text"
              }
            />
          )}
        </>
      )}

      <Button
        variant="ghost"
        size="sm"
        onClick={onRemove}
        className="text-destructive hover:text-destructive hover:bg-destructive/10"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

// Trace Result Card Component
function TraceResultCard({ trace }: { trace: Trace }) {
  const duration = trace.duration_ns
    ? Math.round(trace.duration_ns / 1000000)
    : null;
  const timeAgo = formatDistanceToNow(new Date(trace.start_time), {
    addSuffix: true,
  });

  const getStatusBadge = () => {
    if (!duration) return { variant: "outline" as const, label: "Unknown" };
    if (duration > 5000) return { variant: "error" as const, label: "Slow" };
    if (duration > 1000)
      return { variant: "warning" as const, label: "Warning" };
    return { variant: "success" as const, label: "Good" };
  };

  const status = getStatusBadge();

  return (
    <div className="flex items-center justify-between p-4 bg-card rounded-lg border border-border hover:border-accent/50 hover:bg-card/80 transition-all duration-200">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 mb-2">
          <Link
            to="/trace/$traceId"
            params={{ traceId: trace.trace_id }}
            className="text-sm font-medium text-primary hover:text-primary/80 truncate font-mono"
          >
            {trace.trace_id}
          </Link>
          <Badge
            variant="outline"
            className="border-border text-secondary-foreground"
          >
            {trace.span_count} spans
          </Badge>
          <Badge variant={status.variant}>{status.label}</Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>Started {timeAgo}</span>
          </div>
          {duration && (
            <div className="flex items-center gap-1">
              <span>{duration}ms duration</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 ml-4">
        <Link to="/trace/$traceId" params={{ traceId: trace.trace_id }}>
          <Button
            variant="outline"
            size="sm"
            className="hover:bg-accent hover:text-accent-foreground hover:border-accent transition-all duration-200"
          >
            View Details
          </Button>
        </Link>
      </div>
    </div>
  );
}
