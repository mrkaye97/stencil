import { useTraces, useLogs, useSpans } from "../lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Link } from "@tanstack/react-router";
import { Activity, Database, Network, Clock, Search } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function Dashboard() {
  const { data: traces, isLoading: tracesLoading } = useTraces();
  const { data: logs, isLoading: logsLoading } = useLogs();
  const { data: spans, isLoading: spansLoading } = useSpans();

  const stats = {
    totalTraces: traces?.length || 0,
    totalLogs: logs?.length || 0,
    totalSpans: spans?.length || 0,
    avgTraceDuration: traces?.length
      ? Math.round(
          traces.reduce((sum, trace) => sum + (trace.duration_ns || 0), 0) /
            traces.length /
            1000000,
        )
      : 0,
  };

  const recentTraces = traces?.slice(0, 5) || [];
  const recentLogs = logs?.slice(0, 5) || [];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Overview of your observability data
        </p>
      </header>

      <section aria-label="Key metrics">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Traces
              </CardTitle>
              <Network className="h-4 w-4 text-primary" aria-hidden="true" />
            </CardHeader>
            <CardContent>
              <div
                className="text-2xl font-bold text-foreground"
                aria-live="polite"
              >
                {stats.totalTraces}
              </div>
              <p className="text-xs text-muted-foreground">
                {tracesLoading ? "Loading..." : "Distributed traces"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Logs</CardTitle>
              <Database className="h-4 w-4 text-accent" aria-hidden="true" />
            </CardHeader>
            <CardContent>
              <div
                className="text-2xl font-bold text-foreground"
                aria-live="polite"
              >
                {stats.totalLogs}
              </div>
              <p className="text-xs text-muted-foreground">
                {logsLoading ? "Loading..." : "Log entries"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Spans</CardTitle>
              <Activity className="h-4 w-4 text-chart-4" aria-hidden="true" />
            </CardHeader>
            <CardContent>
              <div
                className="text-2xl font-bold text-foreground"
                aria-live="polite"
              >
                {stats.totalSpans}
              </div>
              <p className="text-xs text-muted-foreground">
                {spansLoading ? "Loading..." : "Span operations"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Avg Duration
              </CardTitle>
              <Clock className="h-4 w-4 text-chart-5" aria-hidden="true" />
            </CardHeader>
            <CardContent>
              <div
                className="text-2xl font-bold text-foreground"
                aria-live="polite"
              >
                {stats.avgTraceDuration}ms
              </div>
              <p className="text-xs text-muted-foreground">
                Average trace duration
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section
        aria-label="Recent activity"
        className="grid grid-cols-1 lg:grid-cols-2 gap-6"
      >
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-card-foreground">
                Recent Traces
              </CardTitle>
              <Button
                asChild
                variant="outline"
                size="sm"
                className="border-border text-foreground"
              >
                <Link to="/traces">View All</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {tracesLoading ? (
              <div className="text-muted-foreground">Loading traces...</div>
            ) : recentTraces.length === 0 ? (
              <div className="text-muted-foreground">No traces found</div>
            ) : (
              <div className="space-y-2">
                {recentTraces.map((trace) => (
                  <div
                    key={trace.trace_id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50 hover:bg-muted/50 transition-all duration-200"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground truncate">
                        {trace.trace_id}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {trace.span_count} spans
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge
                        variant="secondary"
                        className="bg-secondary text-secondary-foreground"
                      >
                        {trace.duration_ns
                          ? `${Math.round(trace.duration_ns / 1000000)}ms`
                          : "N/A"}
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(trace.start_time), {
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-card-foreground">
                Recent Logs
              </CardTitle>
              <Button
                asChild
                variant="outline"
                size="sm"
                className="border-border text-foreground"
              >
                <Link to="/logs">View All</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {logsLoading ? (
              <div className="text-muted-foreground">Loading logs...</div>
            ) : recentLogs.length === 0 ? (
              <div className="text-muted-foreground">No logs found</div>
            ) : (
              <div className="space-y-2">
                {recentLogs.map((log) => (
                  <div
                    key={log.log_id}
                    className="p-3 rounded-lg bg-muted/30 border border-border/50 hover:bg-muted/50 transition-all duration-200"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <Badge
                        variant={
                          log.severity_number >= 17
                            ? "destructive"
                            : log.severity_number >= 13
                              ? "warning"
                              : log.severity_number >= 9
                                ? "default"
                                : "secondary"
                        }
                      >
                        {log.severity_text || `Level ${log.severity_number}`}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(log.timestamp), {
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                    <p className="text-sm text-foreground truncate">
                      {log.body || "No message"}
                    </p>
                    {log.service_name && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {log.service_name}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section aria-label="Quick actions">
        <Card className="bg-gradient-to-r from-primary/5 to-accent/5 border-primary/20">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Search className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-foreground">
                    Advanced Trace Filtering
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Filter traces by duration, service, status, span attributes,
                    and more with our powerful filtering interface
                  </p>
                </div>
              </div>
              <Button
                asChild
                variant="default"
                className="bg-primary hover:bg-primary/90"
              >
                <Link to="/traces">Explore Traces</Link>
              </Button>
            </div>
          </CardHeader>
        </Card>
      </section>
    </div>
  );
}
