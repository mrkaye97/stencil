import { useParams } from "@tanstack/react-router";
import { useTrace, useTraceSpans } from "../lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Clock,
  Activity,
  Layers,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { useState, useMemo } from "react";
import type { Span } from "../types/api";

interface SpanTreeNode {
  span: Span;
  children: SpanTreeNode[];
  depth: number;
  startOffset: number;
  endOffset: number;
}

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

  // Build span tree for waterfall view
  const spanTree = useMemo(() => {
    if (!spans || spans.length === 0) return [];

    // Find the root span (no parent or parent not in this trace)
    const spanMap = new Map(spans.map((span) => [span.span_id, span]));
    const rootSpans = spans.filter(
      (span) => !span.parent_span_id || !spanMap.has(span.parent_span_id)
    );

    // Get trace start time and duration for relative positioning
    const traceStartTime = Math.min(
      ...spans.map((s) => new Date(s.start_time).getTime())
    );
    const traceEndTime = Math.max(
      ...spans.map((s) => new Date(s.end_time).getTime())
    );
    const traceDuration = traceEndTime - traceStartTime;

    function buildTree(span: Span, depth = 0): SpanTreeNode {
      const children = (spans || [])
        .filter((s) => s.parent_span_id === span.span_id)
        .sort(
          (a, b) =>
            new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
        )
        .map((child) => buildTree(child, depth + 1));

      const startTime = new Date(span.start_time).getTime();
      const endTime = new Date(span.end_time).getTime();
      const startOffset = ((startTime - traceStartTime) / traceDuration) * 100;
      const endOffset = ((endTime - traceStartTime) / traceDuration) * 100;

      return {
        span,
        children,
        depth,
        startOffset,
        endOffset,
      };
    }

    return rootSpans
      .sort(
        (a, b) =>
          new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
      )
      .map((root) => buildTree(root));
  }, [spans]);

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
          <p className="text-gray-400 mt-1 font-mono text-sm">
            ID: {trace.trace_id}
          </p>
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
          <CardTitle className="text-gray-200">Trace Waterfall</CardTitle>
        </CardHeader>
        <CardContent>
          {!spans || spans.length === 0 ? (
            <div className="text-gray-400 text-center py-8">
              No spans found for this trace
            </div>
          ) : (
            <div className="space-y-1">
              {spanTree.map((node) => (
                <SpanTreeView key={node.span.span_id} node={node} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SpanTreeView({ node }: { node: SpanTreeNode }) {
  const [isOpen, setIsOpen] = useState(true);
  const [showDetails, setShowDetails] = useState(false);
  const hasChildren = node.children.length > 0;

  const duration = Math.round(node.span.duration_ns / 1000000); // Convert to ms
  const statusColor =
    node.span.status_code === 1
      ? "text-green-400 bg-green-900"
      : node.span.status_code === 2
        ? "text-red-400 bg-red-900"
        : "text-gray-400 bg-gray-700";

  const barWidth = Math.max(node.endOffset - node.startOffset, 1); // Minimum 1% width
  const depthIndent = node.depth * 20;

  return (
    <div>
      <div
        className="group relative p-2 hover:bg-gray-800 rounded-lg cursor-pointer"
        onClick={() => setShowDetails(!showDetails)}
      >
        {/* Span timeline bar */}
        <div className="relative h-8 mb-2">
          <div
            className="absolute top-1 h-6 rounded flex items-center px-2 text-xs font-medium"
            style={{
              left: `calc(${node.startOffset}% + ${depthIndent}px)`,
              width: `${barWidth}%`,
              backgroundColor:
                node.span.status_code === 2
                  ? "#7f1d1d"
                  : node.span.status_code === 1
                    ? "#14532d"
                    : "#374151",
              border: `1px solid ${
                node.span.status_code === 2
                  ? "#ef4444"
                  : node.span.status_code === 1
                    ? "#22c55e"
                    : "#6b7280"
              }`,
              minWidth: "80px",
            }}
          >
            <span className="truncate text-white">
              {node.span.operation_name}
            </span>
          </div>
        </div>

        {/* Span details */}
        <div className="flex items-center justify-between">
          <div
            className="flex items-center gap-2"
            style={{ marginLeft: `${depthIndent}px` }}
          >
            {hasChildren && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-gray-400 hover:text-white"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOpen(!isOpen);
                }}
              >
                {isOpen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
            )}
            <span className="text-sm font-medium text-white">
              {node.span.operation_name}
            </span>
            <Badge
              variant="outline"
              className="border-gray-600 text-gray-300 text-xs"
            >
              {duration}ms
            </Badge>
            <Badge className={`text-xs ${statusColor}`}>
              {node.span.status_code === 1
                ? "OK"
                : node.span.status_code === 2
                  ? "ERROR"
                  : "UNSET"}
            </Badge>
          </div>
        </div>

        {/* Expanded details */}
        {showDetails && (
          <div className="mt-3 p-3 bg-gray-800 rounded border border-gray-700">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-gray-400 font-medium mb-1">
                  Span Details
                </div>
                <div className="space-y-1 text-gray-300">
                  <div>
                    <span className="text-gray-500">ID:</span>{" "}
                    <code className="text-xs">{node.span.span_id}</code>
                  </div>
                  <div>
                    <span className="text-gray-500">Parent:</span>{" "}
                    <code className="text-xs">
                      {node.span.parent_span_id || "None"}
                    </code>
                  </div>
                  <div>
                    <span className="text-gray-500">Service:</span>{" "}
                    {node.span.service_name || "Unknown"}
                  </div>
                  <div>
                    <span className="text-gray-500">Library:</span>{" "}
                    {node.span.instrumentation_library || "Unknown"}
                  </div>
                </div>
              </div>
              <div>
                <div className="text-gray-400 font-medium mb-1">Timing</div>
                <div className="space-y-1 text-gray-300">
                  <div>
                    <span className="text-gray-500">Start:</span>{" "}
                    {new Date(node.span.start_time).toISOString()}
                  </div>
                  <div>
                    <span className="text-gray-500">End:</span>{" "}
                    {new Date(node.span.end_time).toISOString()}
                  </div>
                  <div>
                    <span className="text-gray-500">Duration:</span> {duration}
                    ms
                  </div>
                </div>
              </div>
            </div>
            {node.span.status_message && (
              <div className="mt-3 pt-3 border-t border-gray-700">
                <div className="text-gray-400 font-medium mb-1">
                  Status Message
                </div>
                <div className="text-gray-300 text-sm">
                  {node.span.status_message}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Child spans */}
      {hasChildren && isOpen && (
        <div className="space-y-1">
          {node.children.map((child) => (
            <SpanTreeView key={child.span.span_id} node={child} />
          ))}
        </div>
      )}
    </div>
  );
}
