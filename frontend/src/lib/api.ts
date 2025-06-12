import { useQuery } from '@tanstack/react-query';
import type { Trace, Span, Log } from '../types/api';

const API_BASE_URL = 'http://localhost:8080'; // Adjust to match your backend port

// API functions
const fetchTraces = async (): Promise<Trace[]> => {
  const response = await fetch(`${API_BASE_URL}/traces`);
  if (!response.ok) {
    throw new Error('Failed to fetch traces');
  }
  return response.json();
};

const fetchTrace = async (traceId: string): Promise<Trace> => {
  const response = await fetch(`${API_BASE_URL}/traces/${traceId}`);
  if (!response.ok) {
    throw new Error('Failed to fetch trace');
  }
  return response.json();
};

const fetchTraceSpans = async (traceId: string): Promise<Span[]> => {
  const response = await fetch(`${API_BASE_URL}/traces/${traceId}/spans`);
  if (!response.ok) {
    throw new Error('Failed to fetch trace spans');
  }
  return response.json();
};

const fetchSpans = async (): Promise<Span[]> => {
  const response = await fetch(`${API_BASE_URL}/spans`);
  if (!response.ok) {
    throw new Error('Failed to fetch spans');
  }
  return response.json();
};

const fetchLogs = async (): Promise<Log[]> => {
  const response = await fetch(`${API_BASE_URL}/logs`);
  if (!response.ok) {
    throw new Error('Failed to fetch logs');
  }
  return response.json();
};

// React Query hooks
export const useTraces = () => {
  return useQuery({
    queryKey: ['traces'],
    queryFn: fetchTraces,
    refetchInterval: 30000, // Refetch every 30 seconds
  });
};

export const useTrace = (traceId: string) => {
  return useQuery({
    queryKey: ['trace', traceId],
    queryFn: () => fetchTrace(traceId),
    enabled: !!traceId,
  });
};

export const useTraceSpans = (traceId: string) => {
  return useQuery({
    queryKey: ['trace-spans', traceId],
    queryFn: () => fetchTraceSpans(traceId),
    enabled: !!traceId,
  });
};

export const useSpans = () => {
  return useQuery({
    queryKey: ['spans'],
    queryFn: fetchSpans,
    refetchInterval: 30000,
  });
};

export const useLogs = () => {
  return useQuery({
    queryKey: ['logs'],
    queryFn: fetchLogs,
    refetchInterval: 30000,
  });
};
