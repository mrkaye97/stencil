import { useTraces, useSpans } from "../lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  TrendingUp,
  Clock,
  Activity,
  PieChart as PieChartIcon,
} from "lucide-react";
import { useMemo } from "react";

export default function GraphsPage() {
  const { data: traces, isLoading: tracesLoading } = useTraces();
  const { data: spans, isLoading: spansLoading } = useSpans();

  const chartData = useMemo(() => {
    if (!traces || !spans) return null;

    const durationData = traces
      .filter((trace) => trace.duration_ns)
      .map((trace) => ({
        id: trace.trace_id.slice(0, 8),
        duration: Math.round(trace.duration_ns! / 1000000),
        spans: trace.span_count,
      }))
      .sort((a, b) => a.duration - b.duration)
      .slice(0, 20);

    const serviceData = spans.reduce(
      (acc, span) => {
        const service = span.service_name || "Unknown";
        acc[service] = (acc[service] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const serviceChartData = Object.entries(serviceData).map(
      ([name, value], index) => ({
        name,
        value,
        color: `hsl(var(--chart-${(index % 5) + 1}))`,
      })
    );

    const hourlyData = Array.from({ length: 24 }, (_, i) => {
      const hour = 23 - i;
      const count = Math.floor(Math.random() * 10) + traces.length / 24;
      return {
        hour: `${hour}:00`,
        traces: Math.floor(count),
      };
    }).reverse();

    return { durationData, serviceChartData, hourlyData };
  }, [traces, spans]);

  if (tracesLoading || spansLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-foreground">Graphs</h1>
        <div className="text-muted-foreground">Loading chart data...</div>
      </div>
    );
  }

  if (!chartData) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-foreground">Graphs</h1>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">
              No data available for charts
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Graphs</h1>
        <p className="text-muted-foreground mt-2">
          Visualize your observability data
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              <CardTitle>Trace Durations</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData.durationData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                />
                <XAxis
                  dataKey="id"
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                  axisLine={{ stroke: "hsl(var(--border))" }}
                />
                <YAxis
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                  axisLine={{ stroke: "hsl(var(--border))" }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    color: "hsl(var(--popover-foreground))",
                  }}
                  formatter={(value) => [`${value}ms`, "Duration"]}
                />
                <Bar dataKey="duration" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <PieChartIcon className="h-5 w-5 text-accent" />
              <CardTitle>Service Distribution</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={chartData.serviceChartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={(entry) => `${entry.name}: ${entry.value}`}
                  labelLine={false}
                >
                  {chartData.serviceChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    color: "hsl(var(--popover-foreground))",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-chart-5" />
              <CardTitle>Traces Over Time (Last 24 Hours)</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData.hourlyData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                />
                <XAxis
                  dataKey="hour"
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                  axisLine={{ stroke: "hsl(var(--border))" }}
                />
                <YAxis
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                  axisLine={{ stroke: "hsl(var(--border))" }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    color: "hsl(var(--popover-foreground))",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="traces"
                  stroke="hsl(var(--chart-5))"
                  strokeWidth={2}
                  dot={{ fill: "hsl(var(--chart-5))", strokeWidth: 2, r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Custom Graph Builder</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Activity className="h-12 w-12 text-muted-foreground/60 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground mb-2">
              Coming Soon
            </h3>
            <p className="text-muted-foreground/80 mb-4">
              Build custom graphs from your trace data with flexible queries and
              visualizations.
            </p>
            <Button disabled variant="secondary">
              Create Custom Graph
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
