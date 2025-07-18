import { useQuery } from "@tanstack/react-query";
import type { Trace, Span, Log } from "../types/api";
import type { TimeSeriesValue, QuerySpec } from "../types/timeseries";

const API_BASE_URL = "http://localhost:8080";

export interface SpanAttribute {
  key: string;
  value: string;
}

export interface SearchTracesQuery {
  service_name?: string;
  operation_name?: string;
  min_duration_ns?: number;
  max_duration_ns?: number;
  status_code?: number;
  span_attributes?: SpanAttribute[];
  offset?: number;
  limit?: number;
}

const fetchTraces = async (): Promise<Trace[]> => {
  const response = await fetch(`${API_BASE_URL}/traces`);
  if (!response.ok) {
    throw new Error("Failed to fetch traces");
  }
  return response.json();
};

const fetchTrace = async (traceId: string): Promise<Trace> => {
  const response = await fetch(`${API_BASE_URL}/traces/${traceId}`);
  if (!response.ok) {
    throw new Error("Failed to fetch trace");
  }
  return response.json();
};

const fetchTraceSpans = async (traceId: string): Promise<Span[]> => {
  const response = await fetch(`${API_BASE_URL}/traces/${traceId}/spans`);
  if (!response.ok) {
    throw new Error("Failed to fetch trace spans");
  }
  return response.json();
};

const fetchSpans = async (): Promise<Span[]> => {
  const response = await fetch(`${API_BASE_URL}/spans`);
  if (!response.ok) {
    throw new Error("Failed to fetch spans");
  }
  return response.json();
};

const fetchLogs = async (): Promise<Log[]> => {
  const response = await fetch(`${API_BASE_URL}/logs`);
  if (!response.ok) {
    throw new Error("Failed to fetch logs");
  }
  return response.json();
};

const fetchSpanAttributes = async (): Promise<string[]> => {
  const response = await fetch(`${API_BASE_URL}/span-attributes`);
  if (!response.ok) {
    throw new Error("Failed to fetch span attributes");
  }
  return response.json();
};

const fetchSearchTraces = async (
  query: SearchTracesQuery,
): Promise<Trace[]> => {
  const params = new URLSearchParams();

  if (query.service_name) params.append("service_name", query.service_name);
  if (query.operation_name)
    params.append("operation_name", query.operation_name);
  if (query.min_duration_ns !== undefined)
    params.append("min_duration_ns", query.min_duration_ns.toString());
  if (query.max_duration_ns !== undefined)
    params.append("max_duration_ns", query.max_duration_ns.toString());
  if (query.status_code !== undefined)
    params.append("status_code", query.status_code.toString());
  if (query.offset !== undefined)
    params.append("offset", query.offset.toString());
  if (query.limit !== undefined) params.append("limit", query.limit.toString());

  // Handle span attributes by encoding as JSON string
  if (query.span_attributes && query.span_attributes.length > 0) {
    params.append("span_attributes", JSON.stringify(query.span_attributes));
  }

  const response = await fetch(`${API_BASE_URL}/traces?${params.toString()}`);
  if (!response.ok) {
    throw new Error("Failed to search traces");
  }
  return response.json();
};

export const useTraces = () => {
  return useQuery({
    queryKey: ["traces"],
    queryFn: fetchTraces,
    refetchInterval: 30000,
  });
};

export const useTrace = (traceId: string) => {
  return useQuery({
    queryKey: ["trace", traceId],
    queryFn: () => fetchTrace(traceId),
    enabled: !!traceId,
  });
};

export const useTraceSpans = (traceId: string) => {
  return useQuery({
    queryKey: ["trace-spans", traceId],
    queryFn: () => fetchTraceSpans(traceId),
    enabled: !!traceId,
  });
};

export const useSpans = () => {
  return useQuery({
    queryKey: ["spans"],
    queryFn: fetchSpans,
    refetchInterval: 30000,
  });
};

export const useLogs = () => {
  return useQuery({
    queryKey: ["logs"],
    queryFn: fetchLogs,
    refetchInterval: 30000,
  });
};

export const useSpanAttributes = () => {
  return useQuery({
    queryKey: ["span-attributes"],
    queryFn: fetchSpanAttributes,
    refetchInterval: 60000,
    staleTime: 30000,
  });
};

const fetchTimeSeriesData = async (
  querySpec: QuerySpec,
): Promise<TimeSeriesValue[]> => {
  const response = await fetch(`${API_BASE_URL}/query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(querySpec),
  });
  if (!response.ok) {
    throw new Error("Failed to fetch time series data");
  }
  return response.json();
};

export const useSearchTraces = (query: SearchTracesQuery, enabled = true) => {
  return useQuery({
    queryKey: ["search-traces", query],
    queryFn: () => fetchSearchTraces(query),
    enabled: enabled,
    staleTime: 10000,
  });
};

export const useTimeSeriesData = (querySpec: QuerySpec, enabled = true) => {
  return useQuery({
    queryKey: ["time-series", querySpec],
    queryFn: () => fetchTimeSeriesData(querySpec),
    enabled: enabled && querySpec.aggregate.agg_type !== null,
    staleTime: 30000,
  });
};
