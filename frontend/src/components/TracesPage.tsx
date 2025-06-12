import { useTraces } from "../lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
        <h1 className="text-3xl font-bold text-white">Traces</h1>
        <Card className="bg-red-950 border-red-800">
          <CardContent className="pt-6">
            <p className="text-red-200">
              Error loading traces: {error.message}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Traces</h1>
          <p className="text-gray-400 mt-2">
            Distributed traces across your services
          </p>
        </div>
        <Badge variant="secondary" className="bg-gray-700 text-gray-300">
          {filteredTraces.length} traces
        </Badge>
      </div>

      <Card className="bg-gray-900 border-gray-800">
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search traces by ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-gray-800 border-gray-700 text-white placeholder-gray-400"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-gray-200">All Traces</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-gray-400">Loading traces...</div>
            </div>
          ) : filteredTraces.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-gray-400">
                {searchTerm ? "No traces match your search" : "No traces found"}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
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

  // Determine status based on duration (for demo purposes)
  const getStatusInfo = () => {
    if (!duration) return { color: "bg-gray-600", label: "Unknown" };
    if (duration > 5000) return { color: "bg-red-600", label: "Slow" };
    if (duration > 1000) return { color: "bg-yellow-600", label: "Warning" };
    return { color: "bg-green-600", label: "Good" };
  };

  const status = getStatusInfo();

  return (
    <div className="flex items-center justify-between p-4 bg-gray-800 rounded-lg hover:bg-gray-750 transition-colors border border-gray-700 hover:border-gray-600">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 mb-3">
          <h3 className="text-sm font-medium text-white truncate font-mono">
            {trace.trace_id}
          </h3>
          <Badge variant="outline" className="border-gray-600 text-gray-300">
            {trace.span_count} spans
          </Badge>
          <Badge className={`${status.color} text-white text-xs`}>
            {status.label}
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-gray-400">
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
          <div className="text-gray-500">
            {new Date(trace.start_time).toLocaleString()}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 ml-4">
        <Button
          asChild
          variant="outline"
          size="sm"
          className="border-gray-700 text-gray-300 hover:bg-gray-700"
        >
          <Link to="/traces/$traceId" params={{ traceId: trace.trace_id }}>
            <ExternalLink className="h-3 w-3 mr-1" />
            View Details
          </Link>
        </Button>
      </div>
    </div>
  );
}
