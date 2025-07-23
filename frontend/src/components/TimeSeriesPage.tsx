import { useState, useMemo, useEffect } from "react";
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
import { Label } from "./ui/label";
import {
  Play,
  Plus,
  X,
  TrendingUp,
  Filter,
  Save,
  FolderOpen,
  Copy,
  Settings,
  Trash2,
  BarChart3,
} from "lucide-react";
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
  "#2563eb",
  "#059669",
  "#dc2626",
  "#7c3aed",
  "#ea580c",
  "#0891b2",
  "#65a30d",
  "#be185d",
  "#4338ca",
  "#b45309",
];

const UNITS = [
  { value: "none", label: "None" },
  { value: "bytes", label: "Bytes" },
  { value: "seconds", label: "Seconds" },
  { value: "milliseconds", label: "Milliseconds" },
  { value: "microseconds", label: "Microseconds" },
  { value: "nanoseconds", label: "Nanoseconds" },
  { value: "percent", label: "Percent" },
  { value: "requests", label: "Requests" },
  { value: "operations", label: "Operations" },
];

interface MultiQuery {
  id: string;
  name: string;
  querySpec: QuerySpec;
  color: string;
  enabled: boolean;
}

interface Dashboard {
  id: string;
  name: string;
  queries: MultiQuery[];
  chartSettings: {
    yAxisUnit: string;
    yAxisLabel: string;
    showLegend: boolean;
    showGrid: boolean;
  };
  createdAt: string;
}

interface ChartSettings {
  yAxisUnit: string;
  yAxisLabel: string;
  showLegend: boolean;
  showGrid: boolean;
}

export default function TimeSeriesPage() {
  const [queries, setQueries] = useState<MultiQuery[]>([
    {
      id: "1",
      name: "Query 1",
      querySpec: {
        aggregate: {
          agg_type: "Count",
          source: "SpanColumn",
        },
        time_bin: { bin: "Minute", value: 1 },
      },
      color: COLORS[0],
      enabled: true,
    },
  ]);

  const [selectedQueryId, setSelectedQueryId] = useState<string>("1");

  const [chartSettings, setChartSettings] = useState<ChartSettings>({
    yAxisUnit: "none",
    yAxisLabel: "Value",
    showLegend: true,
    showGrid: true,
  });

  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [currentDashboard, setCurrentDashboard] = useState<Dashboard | null>(
    null
  );
  const [newDashboardName, setNewDashboardName] = useState("");
  const [showDashboardDialog, setShowDashboardDialog] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("stencil-dashboards");
    if (saved) {
      try {
        setDashboards(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load dashboards:", e);
      }
    }
  }, []);

  const saveDashboards = (newDashboards: Dashboard[]) => {
    setDashboards(newDashboards);
    localStorage.setItem("stencil-dashboards", JSON.stringify(newDashboards));
  };

  const { data: spanAttributes = [] } = useSpanAttributes();
  const { data: allSpans = [] } = useSpans();

  const selectedQuery = queries.find((q) => q.id === selectedQueryId);

  const queryResults = queries.map((query) => {
    const { data, isLoading, error } = useTimeSeriesData(
      query.querySpec,
      query.enabled
    );
    return { query, data, isLoading, error };
  });

  const chartData = useMemo(() => {
    const allData: Record<string, any> = {};

    queryResults.forEach(({ query, data }) => {
      if (!data || !query.enabled) return;

      data.forEach((point) => {
        const date = new Date(point.end_time);
        const time = date.toLocaleTimeString("en-US", {
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
        });
        const fullTime = date.toISOString();

        if (!allData[fullTime]) {
          allData[fullTime] = { time, fullTime, timestamp: date.getTime() };
        }

        if (query.querySpec.group && point.group) {
          allData[fullTime][`${query.name}_${point.group}`] = point.value;
        } else {
          allData[fullTime][query.name] = point.value;
        }
      });
    });

    return Object.values(allData).sort(
      (a: any, b: any) => a.timestamp - b.timestamp
    );
  }, [queryResults]);

  const seriesNames = useMemo(() => {
    const names: string[] = [];
    queryResults.forEach(({ query, data }) => {
      if (!data || !query.enabled) return;

      if (query.querySpec.group) {
        const groups = new Set(
          data.map((point) => point.group).filter(Boolean)
        );
        groups.forEach((group) => names.push(`${query.name}_${group}`));
      } else {
        names.push(query.name);
      }
    });
    return names;
  }, [queryResults]);

  const filterOptions = useMemo(() => {
    if (!allSpans) return { services: [], operations: [] };

    const services = new Set(
      allSpans
        .map((span) => span.service_name)
        .filter((name): name is string => Boolean(name))
    );
    const operations = new Set(
      allSpans
        .map((span) => span.operation_name)
        .filter((name): name is string => Boolean(name))
    );

    return {
      services: Array.from(services),
      operations: Array.from(operations),
    };
  }, [allSpans]);

  const addQuery = () => {
    const newId = (queries.length + 1).toString();
    const colorIndex = queries.length % COLORS.length;
    const newQuery: MultiQuery = {
      id: newId,
      name: `Query ${newId}`,
      querySpec: {
        aggregate: {
          agg_type: "Count",
          source: "SpanColumn",
        },
        time_bin: { bin: "Minute", value: 1 },
      },
      color: COLORS[colorIndex],
      enabled: true,
    };
    setQueries([...queries, newQuery]);
    setSelectedQueryId(newId);
  };

  const updateQuery = (queryId: string, updates: Partial<MultiQuery>) => {
    setQueries(
      queries.map((q) => (q.id === queryId ? { ...q, ...updates } : q))
    );
  };

  const removeQuery = (queryId: string) => {
    if (queries.length === 1) return;

    const newQueries = queries.filter((q) => q.id !== queryId);
    setQueries(newQueries);

    if (selectedQueryId === queryId) {
      setSelectedQueryId(newQueries[0]?.id || "");
    }
  };

  const duplicateQuery = (queryId: string) => {
    const query = queries.find((q) => q.id === queryId);
    if (!query) return;

    const newId = (
      Math.max(...queries.map((q) => parseInt(q.id))) + 1
    ).toString();
    const colorIndex = queries.length % COLORS.length;
    const newQuery: MultiQuery = {
      ...query,
      id: newId,
      name: `${query.name} (copy)`,
      color: COLORS[colorIndex],
    };
    setQueries([...queries, newQuery]);
  };

  const saveDashboard = () => {
    if (!newDashboardName.trim()) return;

    const dashboard: Dashboard = {
      id: Date.now().toString(),
      name: newDashboardName.trim(),
      queries: [...queries],
      chartSettings: { ...chartSettings },
      createdAt: new Date().toISOString(),
    };

    const newDashboards = [...dashboards, dashboard];
    saveDashboards(newDashboards);
    setCurrentDashboard(dashboard);
    setNewDashboardName("");
    setShowDashboardDialog(false);
  };

  const loadDashboard = (dashboard: Dashboard) => {
    setQueries(dashboard.queries);
    setChartSettings(dashboard.chartSettings);
    setCurrentDashboard(dashboard);
    setSelectedQueryId(dashboard.queries[0]?.id || "");
  };

  const deleteDashboard = (dashboardId: string) => {
    const newDashboards = dashboards.filter((d) => d.id !== dashboardId);
    saveDashboards(newDashboards);
    if (currentDashboard?.id === dashboardId) {
      setCurrentDashboard(null);
    }
  };

  const updateCurrentDashboard = () => {
    if (!currentDashboard) return;

    const updatedDashboard: Dashboard = {
      ...currentDashboard,
      queries: [...queries],
      chartSettings: { ...chartSettings },
    };

    const newDashboards = dashboards.map((d) =>
      d.id === currentDashboard.id ? updatedDashboard : d
    );
    saveDashboards(newDashboards);
    setCurrentDashboard(updatedDashboard);
  };

  const formatYAxisValue = (value: number): string => {
    switch (chartSettings.yAxisUnit) {
      case "bytes":
        if (value >= 1e9) return `${(value / 1e9).toFixed(1)}GB`;
        if (value >= 1e6) return `${(value / 1e6).toFixed(1)}MB`;
        if (value >= 1e3) return `${(value / 1e3).toFixed(1)}KB`;
        return `${value}B`;
      case "seconds":
        return `${value}s`;
      case "milliseconds":
        return `${value}ms`;
      case "microseconds":
        return `${value}μs`;
      case "nanoseconds":
        return `${value}ns`;
      case "percent":
        return `${value}%`;
      default:
        return value.toString();
    }
  };

  const isLoading = queryResults.some(({ isLoading }) => isLoading);
  const hasError = queryResults.some(({ error }) => error);
  const hasData = chartData.length > 0;

  return (
    <div className="h-screen flex flex-col space-y-6 p-6 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Time Series Analytics
          </h1>
          <p className="text-muted-foreground text-sm">
            Build custom time series visualizations with multiple queries
          </p>
        </div>
        <div className="flex items-center gap-3">
          {currentDashboard && (
            <Badge
              variant="outline"
              className="flex items-center gap-2 px-3 py-1"
            >
              <FolderOpen className="h-4 w-4" />
              {currentDashboard.name}
            </Badge>
          )}
          <Button
            variant="outline"
            onClick={() => setShowDashboardDialog(true)}
            className="flex items-center gap-2"
          >
            <Save className="h-4 w-4" />
            Save Dashboard
          </Button>
          {hasData && (
            <Badge variant="secondary" className="px-3 py-1">
              {chartData.length} data points
            </Badge>
          )}
        </div>
      </div>

      {/* Dashboard selector */}
      {dashboards.length > 0 && (
        <Card className="border-2 border-dashed flex-shrink-0">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <Label className="text-sm font-medium text-muted-foreground">
                Load Dashboard:
              </Label>
              <div className="flex items-center gap-2 flex-wrap">
                {dashboards.map((dashboard) => (
                  <div key={dashboard.id} className="relative group">
                    <Button
                      variant={
                        currentDashboard?.id === dashboard.id
                          ? "default"
                          : "outline"
                      }
                      size="sm"
                      onClick={() => loadDashboard(dashboard)}
                      className="flex items-center gap-2 pr-8"
                    >
                      <FolderOpen className="h-3 w-3" />
                      {dashboard.name}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteDashboard(dashboard.id);
                      }}
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-5 w-5 p-0 opacity-0 group-hover:opacity-100 hover:bg-destructive/20 transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6 flex-1 min-h-0">
        {/* Query Builder */}
        <Card className="xl:col-span-1 shadow-sm border-2 flex flex-col">
          <CardHeader className="pb-4 flex-shrink-0">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Filter className="h-5 w-5 text-primary" />
              Query Builder
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 flex-1 overflow-y-auto">
            {/* Query Tabs */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Queries</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addQuery}
                  className="h-7 px-3 text-xs hover:bg-primary hover:text-primary-foreground transition-colors"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add Query
                </Button>
              </div>
              <div className="space-y-2">
                {queries.map((query, index) => (
                  <div
                    key={query.id}
                    className={`group flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer ${
                      selectedQueryId === query.id
                        ? "bg-primary/5 border-primary/30 shadow-sm"
                        : "bg-muted/30 hover:bg-muted/50 border-border"
                    }`}
                    onClick={() => setSelectedQueryId(query.id)}
                  >
                    <div
                      className="w-3 h-3 rounded-full border-2 border-white shadow-sm flex-shrink-0"
                      style={{ backgroundColor: query.color }}
                    />
                    <Input
                      value={query.name}
                      onChange={(e) =>
                        updateQuery(query.id, { name: e.target.value })
                      }
                      className="h-6 text-xs border-0 bg-transparent p-0 focus-visible:ring-0 font-medium flex-1"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          updateQuery(query.id, { enabled: !query.enabled });
                        }}
                        className="h-6 w-6 p-0"
                        title={query.enabled ? "Disable query" : "Enable query"}
                      >
                        {query.enabled ? (
                          <Play className="h-3 w-3 text-green-600" />
                        ) : (
                          <Play className="h-3 w-3 text-muted-foreground" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          duplicateQuery(query.id);
                        }}
                        className="h-6 w-6 p-0"
                        title="Duplicate query"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                      {queries.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeQuery(query.id);
                          }}
                          className="h-6 w-6 p-0 hover:bg-destructive/20"
                          title="Delete query"
                        >
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {selectedQuery && (
              <QueryEditor
                query={selectedQuery}
                onUpdate={(updates) => updateQuery(selectedQuery.id, updates)}
                spanAttributes={spanAttributes}
                filterOptions={filterOptions}
              />
            )}
          </CardContent>
        </Card>

        {/* Chart */}
        <Card className="xl:col-span-4 shadow-sm border-2 flex flex-col">
          <CardHeader className="pb-4 flex-shrink-0">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <TrendingUp className="h-5 w-5 text-primary" />
                Time Series Chart
              </CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {queries.filter((q) => q.enabled).length} active queries
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSettingsModal(true)}
                  className="flex items-center gap-2"
                >
                  <Settings className="h-4 w-4" />
                  Settings
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 pb-6 min-h-0">
            {hasError && (
              <div className="flex items-center justify-center h-full">
                <div className="text-center p-8 bg-destructive/5 rounded-lg border border-destructive/20">
                  <p className="text-destructive mb-2 font-medium">
                    Error loading data
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Check your query configuration and try again
                  </p>
                </div>
              </div>
            )}

            {isLoading && (
              <div className="flex items-center justify-center h-full">
                <div className="text-center p-8">
                  <div className="animate-spin h-12 w-12 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />
                  <p className="text-muted-foreground font-medium">
                    Loading time series data...
                  </p>
                </div>
              </div>
            )}

            {!isLoading && !hasData && queries.some((q) => q.enabled) && (
              <div className="flex items-center justify-center h-full">
                <div className="text-center p-8 bg-muted/20 rounded-lg border-2 border-dashed">
                  <BarChart3 className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground font-medium mb-2">
                    No data found
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Try adjusting your query filters or time range
                  </p>
                </div>
              </div>
            )}

            {!queries.some((q) => q.enabled) && (
              <div className="flex items-center justify-center h-full">
                <div className="text-center p-8 bg-primary/5 rounded-lg border-2 border-dashed border-primary/20">
                  <TrendingUp className="h-16 w-16 mx-auto mb-4 text-primary/60" />
                  <p className="text-muted-foreground font-medium mb-2">
                    No active queries
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Enable at least one query to see results
                  </p>
                </div>
              </div>
            )}

            {hasData && (
              <div className="h-full w-full bg-gradient-to-br from-background to-muted/10 rounded-lg p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={chartData}
                    margin={{ top: 15, right: 25, left: 60, bottom: 60 }}
                  >
                    {chartSettings.showGrid && (
                      <CartesianGrid
                        strokeDasharray="2 2"
                        stroke="hsl(var(--muted-foreground))"
                        opacity={0.3}
                        horizontal={true}
                        vertical={false}
                      />
                    )}
                    <XAxis
                      dataKey="time"
                      tick={{
                        fontSize: 14,
                        fill: "hsl(var(--foreground))",
                        fontWeight: 600,
                      }}
                      angle={-45}
                      textAnchor="end"
                      height={70}
                      stroke="hsl(var(--foreground))"
                      strokeWidth={1.5}
                      interval="preserveStartEnd"
                      tickLine={{
                        stroke: "hsl(var(--foreground))",
                        strokeWidth: 1.5,
                      }}
                      axisLine={{
                        stroke: "hsl(var(--foreground))",
                        strokeWidth: 1.5,
                      }}
                    />
                    <YAxis
                      tick={{
                        fontSize: 14,
                        fill: "hsl(var(--foreground))",
                        fontWeight: 600,
                      }}
                      tickFormatter={formatYAxisValue}
                      width={90}
                      stroke="hsl(var(--foreground))"
                      strokeWidth={1.5}
                      tickLine={{
                        stroke: "hsl(var(--foreground))",
                        strokeWidth: 1.5,
                      }}
                      axisLine={{
                        stroke: "hsl(var(--foreground))",
                        strokeWidth: 1.5,
                      }}
                      label={{
                        value: chartSettings.yAxisLabel,
                        angle: -90,
                        position: "insideLeft",
                        style: {
                          textAnchor: "middle",
                          fontSize: "14px",
                          fill: "hsl(var(--foreground))",
                          fontWeight: 700,
                        },
                      }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--background))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        boxShadow: "0 10px 40px rgba(0,0,0,0.15)",
                        backdropFilter: "blur(12px)",
                        fontSize: "13px",
                        padding: "12px",
                      }}
                      formatter={(value: any, name: string) => [
                        formatYAxisValue(value),
                        name,
                      ]}
                      labelStyle={{
                        fontWeight: "600",
                        fontSize: "12px",
                        color: "hsl(var(--foreground))",
                        marginBottom: "4px",
                      }}
                      itemStyle={{
                        color: "hsl(var(--foreground))",
                        fontWeight: "500",
                      }}
                      cursor={{
                        stroke: "hsl(var(--muted-foreground))",
                        strokeWidth: 1,
                        strokeDasharray: "3 3",
                      }}
                    />
                    {chartSettings.showLegend && (
                      <Legend
                        wrapperStyle={{
                          paddingTop: "15px",
                          fontSize: "12px",
                          fontWeight: "500",
                        }}
                        iconSize={14}
                        iconType="line"
                      />
                    )}

                    {seriesNames.map((seriesName, index) => {
                      const queryName = seriesName.split("_")[0];
                      const query = queries.find((q) => q.name === queryName);
                      return (
                        <Line
                          key={seriesName}
                          type="monotone"
                          dataKey={seriesName}
                          stroke={query?.color || COLORS[index % COLORS.length]}
                          strokeWidth={2.5}
                          dot={false}
                          connectNulls={false}
                          name={seriesName}
                          activeDot={{
                            r: 4,
                            stroke:
                              query?.color || COLORS[index % COLORS.length],
                            strokeWidth: 2,
                            fill: "hsl(var(--background))",
                          }}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      );
                    })}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Chart Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <Card className="w-[600px] max-w-[90vw] shadow-2xl border-2">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-primary" />
                Chart Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Y-Axis Configuration */}
              <div className="space-y-4">
                <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-primary"></div>
                  Y-Axis Configuration
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">
                      Unit
                    </Label>
                    <Select
                      value={chartSettings.yAxisUnit}
                      onValueChange={(value) =>
                        setChartSettings({ ...chartSettings, yAxisUnit: value })
                      }
                    >
                      <SelectTrigger className="h-10 mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {UNITS.map((unit) => (
                          <SelectItem key={unit.value} value={unit.value}>
                            {unit.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">
                      Label
                    </Label>
                    <Input
                      value={chartSettings.yAxisLabel}
                      onChange={(e) =>
                        setChartSettings({
                          ...chartSettings,
                          yAxisLabel: e.target.value,
                        })
                      }
                      className="h-10 mt-1"
                      placeholder="Value"
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Display Options */}
              <div className="space-y-4">
                <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                  Display Options
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                    <input
                      type="checkbox"
                      checked={chartSettings.showLegend}
                      onChange={(e) =>
                        setChartSettings({
                          ...chartSettings,
                          showLegend: e.target.checked,
                        })
                      }
                      className="rounded w-4 h-4"
                    />
                    <div>
                      <div className="text-sm font-medium">Show Legend</div>
                      <div className="text-xs text-muted-foreground">
                        Display series legend below chart
                      </div>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                    <input
                      type="checkbox"
                      checked={chartSettings.showGrid}
                      onChange={(e) =>
                        setChartSettings({
                          ...chartSettings,
                          showGrid: e.target.checked,
                        })
                      }
                      className="rounded w-4 h-4"
                    />
                    <div>
                      <div className="text-sm font-medium">Show Grid</div>
                      <div className="text-xs text-muted-foreground">
                        Display background grid lines
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              <Separator />

              {/* Dashboard Actions */}
              {currentDashboard && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    Dashboard Actions
                  </h3>
                  <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                    <FolderOpen className="h-5 w-5 text-muted-foreground" />
                    <div className="flex-1">
                      <div className="text-sm font-medium">
                        Current Dashboard
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {currentDashboard.name}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={updateCurrentDashboard}
                      className="flex items-center gap-2"
                    >
                      <Save className="h-4 w-4" />
                      Update
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowSettingsModal(false)}
                >
                  Close
                </Button>
                <Button
                  onClick={() => setShowSettingsModal(false)}
                  className="bg-primary hover:bg-primary/90"
                >
                  Apply Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Dashboard Save Dialog */}
      {showDashboardDialog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <Card className="w-96 shadow-2xl border-2">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2">
                <Save className="h-5 w-5 text-primary" />
                Save Dashboard
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="dashboard-name" className="text-sm font-medium">
                  Dashboard Name
                </Label>
                <Input
                  id="dashboard-name"
                  value={newDashboardName}
                  onChange={(e) => setNewDashboardName(e.target.value)}
                  placeholder="Enter dashboard name"
                  className="h-10"
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowDashboardDialog(false);
                    setNewDashboardName("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={saveDashboard}
                  disabled={!newDashboardName.trim()}
                  className="bg-primary hover:bg-primary/90"
                >
                  Save Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

interface QueryEditorProps {
  query: MultiQuery;
  onUpdate: (updates: Partial<MultiQuery>) => void;
  spanAttributes: string[];
  filterOptions: { services: string[]; operations: string[] };
}

function QueryEditor({
  query,
  onUpdate,
  spanAttributes,
  filterOptions,
}: QueryEditorProps) {
  const querySpec = query.querySpec;

  const needsColumn = useMemo(() => {
    if (typeof querySpec.aggregate.agg_type === "string") {
      return ["Sum", "Avg", "Min", "Max"].includes(
        querySpec.aggregate.agg_type
      );
    }
    return true;
  }, [querySpec.aggregate.agg_type]);

  const aggregateType = useMemo(() => {
    if (typeof querySpec.aggregate.agg_type === "string") {
      return querySpec.aggregate.agg_type;
    }
    const complexType = querySpec.aggregate.agg_type;
    if ("Sum" in complexType) return "Sum";
    if ("Avg" in complexType) return "Avg";
    if ("Min" in complexType) return "Min";
    if ("Max" in complexType) return "Max";
    return "Count";
  }, [querySpec.aggregate.agg_type]);

  const currentColumn = useMemo(() => {
    if (typeof querySpec.aggregate.agg_type === "string") return "";
    const complexType = querySpec.aggregate.agg_type;
    if ("Sum" in complexType) return complexType.Sum;
    if ("Avg" in complexType) return complexType.Avg;
    if ("Min" in complexType) return complexType.Min;
    if ("Max" in complexType) return complexType.Max;
    return "";
  }, [querySpec.aggregate.agg_type]);

  const updateQuerySpec = (updates: Partial<QuerySpec>) => {
    onUpdate({
      querySpec: { ...querySpec, ...updates },
    });
  };

  const updateAggregate = (field: string, value: any) => {
    let newAggType: Aggregate["agg_type"] = "Count";

    if (field === "type") {
      if (value === "Count") {
        newAggType = "Count";
      } else if (["Sum", "Avg", "Min", "Max"].includes(value)) {
        if (currentColumn) {
          newAggType = { [value]: currentColumn } as any;
        } else {
          newAggType = "Count";
        }
      }
    } else if (field === "column" && value && aggregateType !== "Count") {
      newAggType = { [aggregateType]: value } as any;
    } else if (field === "source") {
      newAggType = querySpec.aggregate.agg_type;
    }

    updateQuerySpec({
      aggregate: {
        ...querySpec.aggregate,
        agg_type: newAggType,
        ...(field === "source" ? { source: value } : {}),
      },
    });
  };

  const addFilter = () => {
    const currentFilters = querySpec.filters || [];
    updateQuerySpec({
      filters: [...currentFilters, { column: "service_name", value: "" }],
    });
  };

  const updateFilter = (
    index: number,
    field: keyof QueryFilter,
    value: string
  ) => {
    const currentFilters = querySpec.filters || [];
    const newFilters = [...currentFilters];
    newFilters[index] = { ...newFilters[index], [field]: value };
    updateQuerySpec({ filters: newFilters });
  };

  const removeFilter = (index: number) => {
    const currentFilters = querySpec.filters || [];
    updateQuerySpec({
      filters: currentFilters.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="space-y-6">
      {/* Aggregate Configuration */}
      <div className="space-y-4">
        <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-primary"></div>
          Aggregation
        </h3>

        <div className="space-y-3">
          <div>
            <Label className="text-xs font-medium text-muted-foreground">
              Source
            </Label>
            <Select
              value={querySpec.aggregate.source}
              onValueChange={(value: "SpanColumn" | "SpanAttribute") =>
                updateAggregate("source", value)
              }
            >
              <SelectTrigger className="h-9 mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SpanColumn">Span Column</SelectItem>
                <SelectItem value="SpanAttribute">Span Attribute</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs font-medium text-muted-foreground">
              Function
            </Label>
            <Select
              value={aggregateType}
              onValueChange={(value) => updateAggregate("type", value)}
            >
              <SelectTrigger className="h-9 mt-1">
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
            <div>
              <Label className="text-xs font-medium text-muted-foreground">
                {querySpec.aggregate.source === "SpanColumn"
                  ? "Column"
                  : "Attribute Key"}
              </Label>
              {querySpec.aggregate.source === "SpanColumn" ? (
                <Select
                  value={currentColumn}
                  onValueChange={(value) => updateAggregate("column", value)}
                >
                  <SelectTrigger className="h-9 mt-1">
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
                  value={currentColumn}
                  onValueChange={(value) => updateAggregate("column", value)}
                >
                  <SelectTrigger className="h-9 mt-1">
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
      </div>

      <Separator />

      {/* Time Binning */}
      <div className="space-y-4">
        <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-500"></div>
          Time Binning
        </h3>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs font-medium text-muted-foreground">
              Interval
            </Label>
            <Select
              value={querySpec.time_bin?.bin || "Minute"}
              onValueChange={(value: any) =>
                updateQuerySpec({
                  time_bin: {
                    ...querySpec.time_bin,
                    bin: value,
                    value: querySpec.time_bin?.value || 1,
                  },
                })
              }
            >
              <SelectTrigger className="h-9 mt-1">
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

          <div>
            <Label className="text-xs font-medium text-muted-foreground">
              Value
            </Label>
            <Input
              type="number"
              min="1"
              value={querySpec.time_bin?.value || 1}
              onChange={(e) =>
                updateQuerySpec({
                  time_bin: {
                    bin: querySpec.time_bin?.bin || "Minute",
                    value: parseInt(e.target.value) || 1,
                  },
                })
              }
              className="h-9 mt-1"
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Grouping */}
      <div className="space-y-4">
        <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500"></div>
          Grouping
        </h3>

        <div>
          <Label className="text-xs font-medium text-muted-foreground">
            Group By
          </Label>
          <Select
            value={querySpec.group || "__none__"}
            onValueChange={(value) =>
              updateQuerySpec({
                group: value === "__none__" ? undefined : value,
              })
            }
          >
            <SelectTrigger className="h-9 mt-1">
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
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-orange-500"></div>
            Filters
          </h3>
          <Button
            variant="outline"
            size="sm"
            onClick={addFilter}
            className="h-7 px-3 text-xs hover:bg-primary hover:text-primary-foreground transition-colors"
          >
            <Plus className="h-3 w-3 mr-1" />
            Add Filter
          </Button>
        </div>

        <div className="space-y-3">
          {(querySpec.filters || []).map((filter, index) => (
            <div
              key={index}
              className="flex items-center gap-2 p-3 bg-muted/40 border rounded-lg hover:bg-muted/60 transition-colors"
            >
              <Select
                value={filter.column}
                onValueChange={(value) => updateFilter(index, "column", value)}
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
                onChange={(e) => updateFilter(index, "value", e.target.value)}
                className="h-8 flex-1 text-sm"
              />

              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeFilter(index)}
                className="h-8 w-8 p-0 hover:bg-destructive/20"
                title="Remove filter"
              >
                <X className="h-3 w-3 text-destructive" />
              </Button>
            </div>
          ))}
          {(querySpec.filters || []).length === 0 && (
            <div className="text-xs text-muted-foreground italic p-3 bg-muted/20 rounded-lg border-2 border-dashed">
              No filters applied
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
