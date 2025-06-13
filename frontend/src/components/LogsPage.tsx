import { useLogs } from "../lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./ui/collapsible";
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
  AlertTriangle,
  Info,
  Bug,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Copy,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
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
        <h1 className="text-3xl font-bold text-foreground">Logs</h1>
        <Card className="bg-destructive/10 border-destructive/20">
          <CardContent className="pt-6">
            <p className="text-destructive-foreground">
              Error loading logs: {error.message}
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
          <h1 className="text-3xl font-bold text-foreground">Logs</h1>
          <p className="text-muted-foreground mt-2">
            Application logs and events
          </p>
        </div>
        <Badge
          variant="secondary"
          className="bg-secondary text-secondary-foreground"
        >
          {filteredLogs.length} logs
        </Badge>
      </div>

      <Card className="bg-card border-border">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search logs by message, service, or trace ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-input border-border text-foreground placeholder-muted-foreground"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select
                value={severityFilter}
                onValueChange={(value: SeverityFilter) =>
                  setSeverityFilter(value)
                }
              >
                <SelectTrigger className="w-40 bg-input border-border text-foreground">
                  <SelectValue placeholder="Severity" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
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

      <Card className="bg-card border-border flex-1 min-h-0">
        <CardHeader>
          <CardTitle className="text-card-foreground">Log Stream</CardTitle>
        </CardHeader>
        <CardContent className="h-full pb-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-muted-foreground">Loading logs...</div>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-muted-foreground">
                {searchTerm || severityFilter !== "all"
                  ? "No logs match your filters"
                  : "No logs found"}
              </div>
            </div>
          ) : (
            <div className="h-full overflow-y-auto space-y-1">
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
  const [isExpanded, setIsExpanded] = useState(false);
  const timeAgo = formatDistanceToNow(new Date(log.timestamp), {
    addSuffix: true,
  });

  const getSeverityInfo = (severityNumber: number) => {
    if (severityNumber >= 17) {
      return { color: "bg-destructive", icon: AlertTriangle, label: "ERROR" };
    } else if (severityNumber >= 13) {
      return { color: "bg-chart-4", icon: AlertTriangle, label: "WARN" };
    } else if (severityNumber >= 9) {
      return { color: "bg-chart-1", icon: Info, label: "INFO" };
    } else {
      return { color: "bg-chart-3", icon: Bug, label: "DEBUG" };
    }
  };

  const severity = getSeverityInfo(log.severity_number);
  const SeverityIcon = severity.icon;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <Collapsible
      open={isExpanded}
      onOpenChange={setIsExpanded}
      className="rounded border border-border hover:border-ring transition-colors"
    >
      <CollapsibleTrigger className="w-full p-3 text-left hover:bg-muted/50">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0">
            <Badge
              className={`${severity.color} text-primary-foreground flex items-center gap-1 text-xs px-2 py-0.5`}
            >
              <SeverityIcon className="h-3 w-3" />
              {log.severity_text || severity.label}
            </Badge>
          </div>

          <div className="flex-1 min-w-0 flex items-center gap-4">
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {new Date(log.timestamp).toLocaleTimeString()}
            </span>

            <div className="flex-1 min-w-0">
              <span className="text-sm text-card-foreground truncate block">
                {log.body || "No message"}
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {log.service_name && (
                <Badge
                  variant="outline"
                  className="border-border text-secondary-foreground text-xs"
                >
                  {log.service_name}
                </Badge>
              )}
              {log.trace_id && (
                <span className="font-mono">{log.trace_id.slice(0, 8)}...</span>
              )}
              <div className="flex items-center gap-1">
                {isExpanded ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
              </div>
            </div>
          </div>
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent className="px-3 pb-3">
        <div className="border-t border-border pt-4 space-y-4">
          {/* Full message */}
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-2">
              Full Message
            </div>
            <div className="bg-muted p-3 rounded border border-border">
              <pre className="text-sm text-card-foreground whitespace-pre-wrap break-words">
                {log.body || "No message"}
              </pre>
            </div>
          </div>

          {/* Metadata grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-1">
                  Log Details
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-secondary-foreground w-16">ID:</span>
                    <code className="text-xs text-foreground bg-muted px-2 py-1 rounded">
                      {log.log_id}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                      onClick={() => copyToClipboard(log.log_id)}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-secondary-foreground w-16">
                      Severity:
                    </span>
                    <div className="text-card-foreground">
                      {log.severity_text || severity.label} (
                      {log.severity_number})
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-secondary-foreground w-16">
                      Service:
                    </span>
                    <div className="text-card-foreground">
                      {log.service_name || "Unknown"}
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-secondary-foreground w-16">
                      Library:
                    </span>
                    <div className="text-card-foreground">
                      {log.instrumentation_library || "Unknown"}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-1">
                  Timing
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex items-start gap-2">
                    <span className="text-secondary-foreground w-20">
                      Timestamp:
                    </span>
                    <div className="text-card-foreground">
                      <div>{new Date(log.timestamp).toISOString()}</div>
                      <div className="text-xs text-muted-foreground">
                        {timeAgo}
                      </div>
                    </div>
                  </div>
                  {log.observed_timestamp && (
                    <div className="flex items-start gap-2">
                      <span className="text-secondary-foreground w-20">
                        Observed:
                      </span>
                      <div className="text-card-foreground">
                        {new Date(log.observed_timestamp).toISOString()}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {(log.trace_id || log.span_id) && (
                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-1">
                    Tracing
                  </div>
                  <div className="space-y-1 text-sm">
                    {log.trace_id && (
                      <div className="flex items-center gap-2">
                        <span className="text-secondary-foreground w-20">
                          Trace:
                        </span>
                        <div className="flex items-center gap-2">
                          <code className="text-xs text-foreground bg-muted px-2 py-1 rounded">
                            {log.trace_id}
                          </code>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                            onClick={() => copyToClipboard(log.trace_id!)}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                          <Button
                            asChild
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                          >
                            <Link
                              to="/trace/$traceId"
                              params={{ traceId: log.trace_id }}
                            >
                              <ExternalLink className="h-3 w-3" />
                            </Link>
                          </Button>
                        </div>
                      </div>
                    )}
                    {log.span_id && (
                      <div className="flex items-center gap-2">
                        <span className="text-secondary-foreground w-20">
                          Span:
                        </span>
                        <div className="flex items-center gap-2">
                          <code className="text-xs text-foreground bg-muted px-2 py-1 rounded">
                            {log.span_id}
                          </code>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                            onClick={() => copyToClipboard(log.span_id!)}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
