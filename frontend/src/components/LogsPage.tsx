import { useLogs } from "../lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Filter, AlertTriangle, Info, Bug } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";
import type { Log } from "../types/api";

type SeverityFilter = "all" | "error" | "warn" | "info" | "debug";

export default function LogsPage() {
  const { data: logs, isLoading, error } = useLogs();
  const [searchTerm, setSearchTerm] = useState("");
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");

  const filteredLogs =
    logs?.filter((log) => {
      const matchesSearch =
        !searchTerm ||
        log.body?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.service_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.trace_id?.includes(searchTerm);

      const matchesSeverity =
        severityFilter === "all" ||
        (severityFilter === "error" && log.severity_number >= 17) ||
        (severityFilter === "warn" &&
          log.severity_number >= 13 &&
          log.severity_number < 17) ||
        (severityFilter === "info" &&
          log.severity_number >= 9 &&
          log.severity_number < 13) ||
        (severityFilter === "debug" && log.severity_number < 9);

      return matchesSearch && matchesSeverity;
    }) || [];

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-white">Logs</h1>
        <Card className="bg-red-950 border-red-800">
          <CardContent className="pt-6">
            <p className="text-red-200">Error loading logs: {error.message}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Logs</h1>
          <p className="text-gray-400 mt-2">Application logs and events</p>
        </div>
        <Badge variant="secondary" className="bg-gray-700 text-gray-300">
          {filteredLogs.length} logs
        </Badge>
      </div>

      <Card className="bg-gray-900 border-gray-800">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search logs by message, service, or trace ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-gray-800 border-gray-700 text-white placeholder-gray-400"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-400" />
              <Select
                value={severityFilter}
                onValueChange={(value: SeverityFilter) =>
                  setSeverityFilter(value)
                }
              >
                <SelectTrigger className="w-40 bg-gray-800 border-gray-700 text-white">
                  <SelectValue placeholder="Severity" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  <SelectItem value="all">All Levels</SelectItem>
                  <SelectItem value="error">Errors</SelectItem>
                  <SelectItem value="warn">Warnings</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="debug">Debug</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-gray-200">All Logs</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-gray-400">Loading logs...</div>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-gray-400">
                {searchTerm || severityFilter !== "all"
                  ? "No logs match your filters"
                  : "No logs found"}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredLogs.map((log) => (
                <LogEntry key={log.log_id} log={log} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function LogEntry({ log }: { log: Log }) {
  const timeAgo = formatDistanceToNow(new Date(log.timestamp), {
    addSuffix: true,
  });

  const getSeverityInfo = (severityNumber: number) => {
    if (severityNumber >= 17) {
      return { color: "bg-red-600", icon: AlertTriangle, label: "ERROR" };
    } else if (severityNumber >= 13) {
      return { color: "bg-yellow-600", icon: AlertTriangle, label: "WARN" };
    } else if (severityNumber >= 9) {
      return { color: "bg-blue-600", icon: Info, label: "INFO" };
    } else {
      return { color: "bg-gray-600", icon: Bug, label: "DEBUG" };
    }
  };

  const severity = getSeverityInfo(log.severity_number);
  const SeverityIcon = severity.icon;

  return (
    <div className="p-4 bg-gray-800 rounded-lg hover:bg-gray-750 transition-colors">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 pt-1">
          <Badge
            className={`${severity.color} text-white flex items-center gap-1`}
          >
            <SeverityIcon className="h-3 w-3" />
            {log.severity_text || severity.label}
          </Badge>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-gray-400">{timeAgo}</span>
            {log.service_name && (
              <>
                <span className="text-gray-600">•</span>
                <Badge
                  variant="outline"
                  className="border-gray-600 text-gray-300 text-xs"
                >
                  {log.service_name}
                </Badge>
              </>
            )}
            {log.trace_id && (
              <>
                <span className="text-gray-600">•</span>
                <span className="text-xs text-gray-500 font-mono">
                  trace: {log.trace_id.slice(0, 8)}...
                </span>
              </>
            )}
          </div>

          <p className="text-sm text-gray-200 mb-2">
            {log.body || "No message"}
          </p>

          {log.instrumentation_library && (
            <div className="text-xs text-gray-500">
              Library: {log.instrumentation_library}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
