import { useTraces } from "../lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Link } from "@tanstack/react-router";
import { Search, ExternalLink, Clock, Activity } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";
import type { Trace } from "../types/api";

export default function TracesPage() {
  const { data: traces, isLoading, error } = useTraces();
  const [searchTerm, setSearchTerm] = useState("");

  const filteredTraces =
    traces?.filter((trace) =>
      trace.trace_id.toLowerCase().includes(searchTerm.toLowerCase())
    ) || [];

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
        <Badge variant="secondary">{filteredTraces.length} traces</Badge>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search traces by ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
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
    <div className="flex items-center justify-between p-4 bg-card rounded-lg border border-border hover:border-accent/50 hover:bg-card/80 transition-all duration-200">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 mb-3">
          <h3 className="text-sm font-medium text-foreground truncate font-mono">
            {trace.trace_id}
          </h3>
          <Badge
            variant="outline"
            className="border-border text-secondary-foreground"
          >
            {trace.span_count} spans
          </Badge>
          <Badge variant={status.variant}>{status.label}</Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>Started {timeAgo}</span>
          </div>
          {duration && (
            <div className="flex items-center gap-1">
              <Activity className="h-3 w-3" />
              <span>{duration}ms duration</span>
            </div>
          )}
          <div className="text-secondary-foreground">
            {new Date(trace.start_time).toLocaleString()}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 ml-4">
        <Link to="/trace/$traceId" params={{ traceId: trace.trace_id }}>
          <Button
            variant="outline"
            size="sm"
            className="hover:bg-accent hover:text-accent-foreground hover:border-accent transition-all duration-200"
          >
            <ExternalLink className="h-3 w-3 mr-1" />
            View Details
          </Button>
        </Link>
      </div>
    </div>
  );
}
