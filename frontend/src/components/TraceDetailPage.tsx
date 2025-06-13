import { useParams } from "@tanstack/react-router";
import { useTrace, useTraceSpans } from "../lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import {
  ArrowLeft,
  Clock,
  Activity,
  Layers,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  Calendar,
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
  const { traceId } = useParams({ strict: false });
  const {
    data: trace,
    isLoading: traceLoading,
    error: traceError,
  } = useTrace(traceId || "");
  const {
    data: spans,
    isLoading: spansLoading,
    error: spansError,
  } = useTraceSpans(traceId || "");

  const spanTree = useMemo(() => {
    if (!spans || spans.length === 0) return [];

    const spanMap = new Map(spans.map((span) => [span.span_id, span]));
    const rootSpans = spans.filter(
      (span) => !span.parent_span_id || !spanMap.has(span.parent_span_id)
    );

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

      return { span, children, depth, startOffset, endOffset };
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
          <Button asChild variant="outline" size="sm">
            <Link to="/traces">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Traces
            </Link>
          </Button>
          <h1 className="text-3xl font-bold text-foreground">Trace Details</h1>
        </div>
        <Card className="bg-destructive/10 border-destructive/20">
          <CardContent className="pt-6">
            <p className="text-destructive">
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
          <Button asChild variant="outline" size="sm">
            <Link to="/traces">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Traces
            </Link>
          </Button>
          <h1 className="text-3xl font-bold text-foreground">Trace Details</h1>
        </div>
        <div className="text-muted-foreground">Loading trace details...</div>
      </div>
    );
  }

  if (!trace) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button asChild variant="outline" size="sm">
            <Link to="/traces">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Traces
            </Link>
          </Button>
          <h1 className="text-3xl font-bold text-foreground">Trace Details</h1>
        </div>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">Trace not found</p>
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
    <div className="h-full flex flex-col space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="outline" size="sm">
          <Link to="/traces">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Traces
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-foreground">Trace Details</h1>
          <p className="text-muted-foreground mt-1 font-mono text-sm">
            ID: {trace.trace_id}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Trace Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Layers className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-foreground">
                  Spans
                </span>
              </div>
              <p className="text-2xl font-bold text-foreground">
                {trace.span_count}
              </p>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4 text-accent" />
                <span className="text-sm font-medium text-foreground">
                  Duration
                </span>
              </div>
              <p className="text-2xl font-bold text-foreground">
                {duration ? `${duration}ms` : "Unknown"}
              </p>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4 text-chart-3" />
                <span className="text-sm font-medium text-foreground">
                  Started
                </span>
              </div>
              <p className="text-lg font-medium text-foreground">{timeAgo}</p>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <Activity className="h-4 w-4 text-chart-4" />
                <span className="text-sm font-medium text-foreground">
                  Status
                </span>
              </div>
              <Badge
                variant={
                  duration && duration > 5000
                    ? "error"
                    : duration && duration > 1000
                      ? "warning"
                      : "success"
                }
              >
                {duration && duration > 5000
                  ? "Slow"
                  : duration && duration > 1000
                    ? "Warning"
                    : "Good"}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="flex-1 min-h-0">
        <CardHeader>
          <CardTitle>Trace Waterfall</CardTitle>
        </CardHeader>
        <CardContent className="h-full pb-6">
          <div className="h-full overflow-y-auto">
            {spanTree &&
              spanTree.map((node) => (
                <SpanTreeView key={node.span.span_id} node={node} />
              ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SpanTreeView({ node }: { node: SpanTreeNode }) {
  const [showDetails, setShowDetails] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const depthColor =
    node.depth === 0
      ? "text-primary border-primary/20"
      : node.depth === 1
        ? "text-accent border-accent/20"
        : node.depth === 2
          ? "text-chart-3 border-chart-3/20"
          : "text-muted-foreground border-border";

  return (
    <div className="mb-2">
      <div
        className="group relative p-2 hover:bg-accent/10 rounded-lg cursor-pointer"
        onClick={() => setShowDetails(!showDetails)}
      >
        <div
          className={`absolute left-0 top-0 bottom-0 w-1 rounded-r ${depthColor.split(" ")[1]}`}
          style={{ marginLeft: `${node.depth * 20}px` }}
        />

        <div
          className="flex items-center justify-between"
          style={{ marginLeft: `${node.depth * 20 + 8}px` }}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <h4 className={`text-sm font-medium ${depthColor.split(" ")[0]}`}>
                {node.span.operation_name}
              </h4>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  copyToClipboard(node.span.span_id, node.span.span_id);
                }}
                className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
              >
                {copiedId === node.span.span_id ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </Button>
            </div>

            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="font-mono">{node.span.span_id.slice(0, 8)}</span>
              <span className="text-sm font-medium text-foreground">
                {node.span.service_name || "Unknown Service"}
              </span>
              {node.span.duration_ns && (
                <span>{Math.round(node.span.duration_ns / 1000000)}ms</span>
              )}
            </div>

            <Badge
              variant={
                node.span.status_code === 1
                  ? "success"
                  : node.span.status_code === 2
                    ? "error"
                    : "outline"
              }
              className="mt-1"
            >
              {node.span.status_code === 1
                ? "OK"
                : node.span.status_code === 2
                  ? "ERROR"
                  : "UNSET"}
            </Badge>
          </div>
        </div>

        {showDetails && (
          <div className="mt-3 p-3 bg-card/50 rounded border border-border">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground font-medium mb-1">
                  Span Details
                </div>
                <div className="space-y-1 text-foreground">
                  <div>
                    <span className="text-muted-foreground">ID:</span>{" "}
                    <code className="text-xs">{node.span.span_id}</code>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Parent:</span>{" "}
                    <code className="text-xs">
                      {node.span.parent_span_id || "None"}
                    </code>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Service:</span>{" "}
                    {node.span.service_name || "Unknown"}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Kind:</span>{" "}
                    {node.span.span_kind || "Unknown"}
                  </div>
                </div>
              </div>

              <div>
                <div className="text-muted-foreground font-medium mb-1">
                  Timing
                </div>
                <div className="space-y-1 text-foreground">
                  <div>
                    <span className="text-muted-foreground">Started:</span>{" "}
                    {new Date(node.span.start_time).toLocaleString()}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Ended:</span>{" "}
                    {new Date(node.span.end_time).toLocaleString()}
                  </div>
                  {node.span.duration_ns && (
                    <div>
                      <span className="text-muted-foreground">Duration:</span>{" "}
                      {Math.round(node.span.duration_ns / 1000000)}ms
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="ml-4">
        {node.children.map((child) => (
          <SpanTreeView key={child.span.span_id} node={child} />
        ))}
      </div>
    </div>
  );
}
