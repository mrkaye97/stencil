import { useParams } from "@tanstack/react-router";
import { useTrace, useTraceSpans } from "../lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Clock, Activity, Layers } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import type { Span } from "../types/api";

export default function TraceDetailPage() {
  const { traceId } = useParams({ from: "/traces/$traceId" });
  const {
    data: trace,
    isLoading: traceLoading,
    error: traceError,
  } = useTrace(traceId);
  const {
    data: spans,
    isLoading: spansLoading,
    error: spansError,
  } = useTraceSpans(traceId);

  if (traceError || spansError) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button
            asChild
            variant="outline"
            size="sm"
            className="border-gray-700 text-gray-300"
          >
            <Link to="/traces">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Traces
            </Link>
          </Button>
          <h1 className="text-3xl font-bold text-white">Trace Details</h1>
        </div>
        <Card className="bg-red-950 border-red-800">
          <CardContent className="pt-6">
            <p className="text-red-200">
              Error loading trace: {traceError?.message || spansError?.message}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (traceLoading || spansLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button
            asChild
            variant="outline"
            size="sm"
            className="border-gray-700 text-gray-300"
          >
            <Link to="/traces">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Traces
            </Link>
          </Button>
          <h1 className="text-3xl font-bold text-white">Trace Details</h1>
        </div>
        <div className="text-gray-400">Loading trace details...</div>
      </div>
    );
  }

  if (!trace) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button
            asChild
            variant="outline"
            size="sm"
            className="border-gray-700 text-gray-300"
          >
            <Link to="/traces">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Traces
            </Link>
          </Button>
          <h1 className="text-3xl font-bold text-white">Trace Details</h1>
        </div>
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="pt-6">
            <p className="text-gray-400">Trace not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const duration = trace.duration_ns
    ? Math.round(trace.duration_ns / 1000000)
    : null;
  const timeAgo = formatDistanceToNow(new Date(trace.start_time), {
    addSuffix: true,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          asChild
          variant="outline"
          size="sm"
          className="border-gray-700 text-gray-300"
        >
          <Link to="/traces">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Traces
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-white">Trace Details</h1>
          <p className="text-gray-400 mt-1">ID: {trace.trace_id}</p>
        </div>
      </div>

      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-gray-200">Trace Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Layers className="h-4 w-4 text-blue-400" />
                <span className="text-sm font-medium text-gray-200">Spans</span>
              </div>
              <p className="text-2xl font-bold text-white">
                {trace.span_count}
              </p>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <Activity className="h-4 w-4 text-green-400" />
                <span className="text-sm font-medium text-gray-200">
                  Duration
                </span>
              </div>
              <p className="text-2xl font-bold text-white">
                {duration ? `${duration}ms` : "N/A"}
              </p>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4 text-purple-400" />
                <span className="text-sm font-medium text-gray-200">
                  Started
                </span>
              </div>
              <p className="text-lg font-medium text-white">{timeAgo}</p>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4 text-yellow-400" />
                <span className="text-sm font-medium text-gray-200">
                  Status
                </span>
              </div>
              <Badge
                variant="secondary"
                className="bg-green-800 text-green-200"
              >
                Complete
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-gray-200">Spans</CardTitle>
        </CardHeader>
        <CardContent>
          {!spans || spans.length === 0 ? (
            <div className="text-gray-400 text-center py-8">
              No spans found for this trace
            </div>
          ) : (
            <div className="space-y-3">
              {spans
                .sort(
                  (a, b) =>
                    new Date(a.start_time).getTime() -
                    new Date(b.start_time).getTime()
                )
                .map((span) => (
                  <SpanCard key={span.span_id} span={span} />
                ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SpanCard({ span }: { span: Span }) {
  const duration = Math.round(span.duration_ns / 1000000); // Convert to ms
  const statusColor =
    span.status_code === 1
      ? "text-green-400"
      : span.status_code === 2
        ? "text-red-400"
        : "text-gray-400";

  return (
    <div className="p-4 bg-gray-800 rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-white">
          {span.operation_name}
        </h3>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-gray-600 text-gray-300">
            {duration}ms
          </Badge>
          <Badge variant="outline" className={`border-gray-600 ${statusColor}`}>
            {span.status_code === 1
              ? "OK"
              : span.status_code === 2
                ? "ERROR"
                : "UNSET"}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-gray-400">
        <div>
          <span className="font-medium">Span ID:</span> {span.span_id}
        </div>
        <div>
          <span className="font-medium">Service:</span>{" "}
          {span.service_name || "Unknown"}
        </div>
        <div>
          <span className="font-medium">Library:</span>{" "}
          {span.instrumentation_library || "Unknown"}
        </div>
      </div>

      {span.status_message && (
        <div className="mt-2 text-xs text-gray-300">
          <span className="font-medium">Message:</span> {span.status_message}
        </div>
      )}
    </div>
  );
}
