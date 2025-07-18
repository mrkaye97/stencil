import { useState, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Badge } from "./ui/badge";
import { Separator } from "./ui/separator";
import { Play, Plus, X, TrendingUp, Filter } from "lucide-react";
import { useTimeSeriesData, useSpanAttributes, useSpans } from "../lib/api";
import type {
  QuerySpec,
  TimeBinQuery,
  Filter as QueryFilter,
  Aggregate,
} from "../types/timeseries";

const SPAN_COLUMNS = [
  { value: "trace_id", label: "Trace ID" },
  { value: "operation_name", label: "Operation Name" },
  { value: "duration_ns", label: "Duration (ns)" },
  { value: "status_code", label: "Status Code" },
  { value: "service_name", label: "Service Name" },
  { value: "instrumentation_library", label: "Instrumentation Library" },
];

const TIME_BINS = [
  { value: "Second", label: "Second" },
  { value: "Minute", label: "Minute" },
  { value: "Hour", label: "Hour" },
  { value: "Day", label: "Day" },
] as const;

const AGGREGATE_TYPES = [
  { value: "Count", label: "Count" },
  { value: "Sum", label: "Sum" },
  { value: "Avg", label: "Average" },
  { value: "Min", label: "Minimum" },
  { value: "Max", label: "Maximum" },
] as const;

const COLORS = [
  "#8884d8",
  "#82ca9d",
  "#ffc658",
  "#ff7300",
  "#00ff00",
  "#0088ff",
  "#ff0088",
  "#88ff00",
  "#ff8800",
  "#8800ff",
];

export default function TimeSeriesPage() {
  const [aggregateSource, setAggregateSource] = useState<
    "SpanColumn" | "SpanAttribute"
  >("SpanColumn");
  const [aggregateType, setAggregateType] = useState<string>("Count");
  const [timeBin, setTimeBin] = useState<TimeBinQuery>({
    bin: "Minute",
    value: 1,
  });
  const [groupBy, setGroupBy] = useState<string>("__none__");
  const [filters, setFilters] = useState<QueryFilter[]>([]);
  const [aggregateColumn, setAggregateColumn] = useState<string>("");
  const [aggregateKey, setAggregateKey] = useState<string>("");
  const [queryEnabled, setQueryEnabled] = useState(false);

  // Load span attributes for dropdowns
  const { data: spanAttributes = [] } = useSpanAttributes();
  const { data: allSpans = [] } = useSpans();

  // Build query spec
  const querySpec: QuerySpec = useMemo(() => {
    // Build aggregate type
    let aggType: Aggregate["agg_type"] = "Count";
    if (aggregateType === "Sum" && (aggregateColumn || aggregateKey)) {
      aggType = {
        Sum: aggregateSource === "SpanColumn" ? aggregateColumn : aggregateKey,
      };
    } else if (aggregateType === "Avg" && (aggregateColumn || aggregateKey)) {
      aggType = {
        Avg: aggregateSource === "SpanColumn" ? aggregateColumn : aggregateKey,
      };
    } else if (aggregateType === "Min" && (aggregateColumn || aggregateKey)) {
      aggType = {
        Min: aggregateSource === "SpanColumn" ? aggregateColumn : aggregateKey,
      };
    } else if (aggregateType === "Max" && (aggregateColumn || aggregateKey)) {
      aggType = {
        Max: aggregateSource === "SpanColumn" ? aggregateColumn : aggregateKey,
      };
    }

    return {
      aggregate: {
        agg_type: aggType,
        source: aggregateSource,
      },
      filters: filters.length > 0 ? filters : undefined,
      group: groupBy !== "__none__" ? groupBy : undefined,
      time_bin: timeBin,
    };
  }, [
    aggregateSource,
    aggregateType,
    aggregateColumn,
    aggregateKey,
    timeBin,
    groupBy,
    filters,
  ]);

  // Fetch data
  const {
    data: timeSeriesData,
    isLoading,
    error,
    refetch,
  } = useTimeSeriesData(querySpec, queryEnabled);

  // Transform data for chart
  const chartData = useMemo(() => {
    if (!timeSeriesData) return [];

    if (groupBy !== "__none__") {
      // Group by specified column
      const groupedData = timeSeriesData.reduce(
        (acc, point) => {
          const time = new Date(point.end_time).toLocaleString();
          if (!acc[time]) {
            acc[time] = { time };
          }
          acc[time][point.group || "unknown"] = point.value;
          return acc;
        },
        {} as Record<string, any>
      );

      return Object.values(groupedData);
    } else {
      // Single line
      return timeSeriesData.map((point) => ({
        time: new Date(point.end_time).toLocaleString(),
        value: point.value,
      }));
    }
  }, [timeSeriesData, groupBy]);

  // Get unique groups for legend
  const groups = useMemo(() => {
    if (!timeSeriesData || groupBy === "__none__") return [];
    const uniqueGroups = new Set(
      timeSeriesData.map((point) => point.group || "unknown")
    );
    return Array.from(uniqueGroups);
  }, [timeSeriesData, groupBy]);

  // Get filter options
  const filterOptions = useMemo(() => {
    if (!allSpans) return { services: [], operations: [] };

    const services = new Set(
      allSpans.map((span) => span.service_name).filter(Boolean)
    );
    const operations = new Set(
      allSpans.map((span) => span.operation_name).filter(Boolean)
    );

    return {
      services: Array.from(services),
      operations: Array.from(operations),
    };
  }, [allSpans]);

  const addFilter = () => {
    setFilters([...filters, { column: "service_name", value: "" }]);
  };

  const updateFilter = (
    index: number,
    field: keyof QueryFilter,
    value: string
  ) => {
    const newFilters = [...filters];
    newFilters[index] = { ...newFilters[index], [field]: value };
    setFilters(newFilters);
  };

  const removeFilter = (index: number) => {
    setFilters(filters.filter((_, i) => i !== index));
  };

  const executeQuery = () => {
    setQueryEnabled(true);
    refetch();
  };

  const needsColumn = ["Sum", "Avg", "Min", "Max"].includes(aggregateType);

  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Time Series Analytics
          </h1>
          <p className="text-muted-foreground mt-2">
            Build custom time series visualizations of your telemetry data
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={executeQuery}
            disabled={
              isLoading ||
              (needsColumn &&
                aggregateSource === "SpanColumn" &&
                !aggregateColumn) ||
              (needsColumn &&
                aggregateSource === "SpanAttribute" &&
                !aggregateKey)
            }
            className="flex items-center gap-2"
          >
            <Play className="h-4 w-4" />
            {isLoading ? "Running..." : "Execute Query"}
          </Button>
          {timeSeriesData && (
            <Badge variant="secondary">
              {timeSeriesData.length} data points
            </Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
        {/* Query Builder */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Query Builder
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Aggregate Configuration */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm">Aggregation</h3>

              <div className="space-y-2">
                <label className="text-xs font-medium">Source</label>
                <Select
                  value={aggregateSource}
                  onValueChange={(value: "SpanColumn" | "SpanAttribute") =>
                    setAggregateSource(value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SpanColumn">Span Column</SelectItem>
                    <SelectItem value="SpanAttribute">
                      Span Attribute
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium">Function</label>
                <Select value={aggregateType} onValueChange={setAggregateType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AGGREGATE_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {needsColumn && (
                <div className="space-y-2">
                  <label className="text-xs font-medium">
                    {aggregateSource === "SpanColumn"
                      ? "Column"
                      : "Attribute Key"}
                  </label>
                  {aggregateSource === "SpanColumn" ? (
                    <Select
                      value={aggregateColumn}
                      onValueChange={setAggregateColumn}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select column" />
                      </SelectTrigger>
                      <SelectContent>
                        {SPAN_COLUMNS.map((col) => (
                          <SelectItem key={col.value} value={col.value}>
                            {col.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Select
                      value={aggregateKey}
                      onValueChange={setAggregateKey}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select attribute" />
                      </SelectTrigger>
                      <SelectContent>
                        {spanAttributes.map((attr) => (
                          <SelectItem key={attr} value={attr}>
                            {attr}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}
            </div>

            <Separator />

            {/* Time Binning */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm">Time Binning</h3>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <label className="text-xs font-medium">Interval</label>
                  <Select
                    value={timeBin.bin}
                    onValueChange={(value: any) =>
                      setTimeBin({ ...timeBin, bin: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIME_BINS.map((bin) => (
                        <SelectItem key={bin.value} value={bin.value}>
                          {bin.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium">Value</label>
                  <Input
                    type="number"
                    min="1"
                    value={timeBin.value}
                    onChange={(e) =>
                      setTimeBin({
                        ...timeBin,
                        value: parseInt(e.target.value) || 1,
                      })
                    }
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Grouping */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm">Grouping</h3>

              <div className="space-y-2">
                <label className="text-xs font-medium">Group By</label>
                <Select value={groupBy} onValueChange={setGroupBy}>
                  <SelectTrigger>
                    <SelectValue placeholder="No grouping" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No grouping</SelectItem>
                    {SPAN_COLUMNS.map((col) => (
                      <SelectItem key={col.value} value={col.value}>
                        {col.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            {/* Filters */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">Filters</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addFilter}
                  className="flex items-center gap-1"
                >
                  <Plus className="h-3 w-3" />
                  Add Filter
                </Button>
              </div>

              <div className="space-y-2">
                {filters.map((filter, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 p-2 bg-muted/50 rounded"
                  >
                    <Select
                      value={filter.column}
                      onValueChange={(value) =>
                        updateFilter(index, "column", value)
                      }
                    >
                      <SelectTrigger className="h-8 w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SPAN_COLUMNS.map((col) => (
                          <SelectItem key={col.value} value={col.value}>
                            {col.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Input
                      placeholder="Value"
                      value={filter.value}
                      onChange={(e) =>
                        updateFilter(index, "value", e.target.value)
                      }
                      className="h-8 flex-1"
                    />

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFilter(index)}
                      className="h-8 w-8 p-0"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Time Series Chart
            </CardTitle>
          </CardHeader>
          <CardContent className="h-full pb-6">
            {error && (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <p className="text-destructive mb-2">Error loading data</p>
                  <p className="text-sm text-muted-foreground">
                    {error.message}
                  </p>
                </div>
              </div>
            )}

            {isLoading && (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="animate-spin h-8 w-8 border-2 border-current border-t-transparent rounded-full mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    Loading time series data...
                  </p>
                </div>
              </div>
            )}

            {!queryEnabled && !isLoading && (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <TrendingUp className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">
                    Configure your query and click "Execute Query" to see
                    results
                  </p>
                </div>
              </div>
            )}

            {queryEnabled && chartData.length > 0 && (
              <div className="h-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="time"
                      tick={{ fontSize: 12 }}
                      angle={-45}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "6px",
                      }}
                    />
                    <Legend />

                    {groupBy !== "__none__" ? (
                      groups.map((group, index) => (
                        <Line
                          key={group}
                          type="monotone"
                          dataKey={group}
                          stroke={COLORS[index % COLORS.length]}
                          strokeWidth={2}
                          dot={false}
                          connectNulls={false}
                        />
                      ))
                    ) : (
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke={COLORS[0]}
                        strokeWidth={2}
                        dot={false}
                        connectNulls={false}
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {queryEnabled && chartData.length === 0 && !isLoading && !error && (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <p className="text-muted-foreground">
                    No data found for the specified query
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
