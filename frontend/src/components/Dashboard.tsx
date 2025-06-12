import { useTraces, useLogs, useSpans } from "../lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "@tanstack/react-router";
import { Activity, Database, Network, Clock } from "lucide-react";
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
            1000000
        )
      : 0,
  };

  const recentTraces = traces?.slice(0, 5) || [];
  const recentLogs = logs?.slice(0, 5) || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Dashboard</h1>
        <p className="text-gray-400 mt-2">
          Overview of your observability data
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-200">
              Total Traces
            </CardTitle>
            <Network className="h-4 w-4 text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {stats.totalTraces}
            </div>
            <p className="text-xs text-gray-400">
              {tracesLoading ? "Loading..." : "Distributed traces"}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-200">
              Total Logs
            </CardTitle>
            <Database className="h-4 w-4 text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {stats.totalLogs}
            </div>
            <p className="text-xs text-gray-400">
              {logsLoading ? "Loading..." : "Log entries"}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-200">
              Total Spans
            </CardTitle>
            <Activity className="h-4 w-4 text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {stats.totalSpans}
            </div>
            <p className="text-xs text-gray-400">
              {spansLoading ? "Loading..." : "Span operations"}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-200">
              Avg Duration
            </CardTitle>
            <Clock className="h-4 w-4 text-yellow-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {stats.avgTraceDuration}ms
            </div>
            <p className="text-xs text-gray-400">Average trace duration</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-gray-200">Recent Traces</CardTitle>
              <Button
                asChild
                variant="outline"
                size="sm"
                className="border-gray-700 text-gray-300"
              >
                <Link to="/traces">View All</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {tracesLoading ? (
              <div className="text-gray-400">Loading traces...</div>
            ) : recentTraces.length === 0 ? (
              <div className="text-gray-400">No traces found</div>
            ) : (
              <div className="space-y-3">
                {recentTraces.map((trace) => (
                  <div
                    key={trace.trace_id}
                    className="flex items-center justify-between p-3 bg-gray-800 rounded-lg"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium text-white truncate">
                        {trace.trace_id}
                      </p>
                      <p className="text-xs text-gray-400">
                        {trace.span_count} spans
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge
                        variant="secondary"
                        className="bg-gray-700 text-gray-300"
                      >
                        {trace.duration_ns
                          ? `${Math.round(trace.duration_ns / 1000000)}ms`
                          : "N/A"}
                      </Badge>
                      <p className="text-xs text-gray-400 mt-1">
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

        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-gray-200">Recent Logs</CardTitle>
              <Button
                asChild
                variant="outline"
                size="sm"
                className="border-gray-700 text-gray-300"
              >
                <Link to="/logs">View All</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {logsLoading ? (
              <div className="text-gray-400">Loading logs...</div>
            ) : recentLogs.length === 0 ? (
              <div className="text-gray-400">No logs found</div>
            ) : (
              <div className="space-y-3">
                {recentLogs.map((log) => (
                  <div key={log.log_id} className="p-3 bg-gray-800 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <Badge
                        variant={
                          log.severity_number >= 17
                            ? "destructive"
                            : log.severity_number >= 13
                              ? "default"
                              : "secondary"
                        }
                        className={
                          log.severity_number >= 17
                            ? ""
                            : log.severity_number >= 13
                              ? "bg-yellow-600"
                              : "bg-gray-600"
                        }
                      >
                        {log.severity_text || `Level ${log.severity_number}`}
                      </Badge>
                      <span className="text-xs text-gray-400">
                        {formatDistanceToNow(new Date(log.timestamp), {
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                    <p className="text-sm text-gray-300 truncate">
                      {log.body || "No message"}
                    </p>
                    {log.service_name && (
                      <p className="text-xs text-gray-500 mt-1">
                        {log.service_name}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
