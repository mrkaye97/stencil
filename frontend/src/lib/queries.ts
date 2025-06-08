import { createQuery } from '@tanstack/svelte-query';

const API_BASE_URL = 'http://localhost:8001';

export interface LogEntry {
	log_id: string;
	trace_id?: string;
	span_id?: string;
	timestamp: string;
	observed_timestamp?: string;
	severity_number: number;
	severity_text?: string;
	body?: string;
	instrumentation_library?: string;
	service_name?: string;
}

async function fetchApi(endpoint: string, options?: RequestInit) {
	const response = await fetch(`${API_BASE_URL}${endpoint}`, {
		headers: {
			'Content-Type': 'application/json',
			...options?.headers
		},
		...options
	});

	if (!response.ok) {
		throw new Error(`HTTP error! status: ${response.status}`);
	}

	return response.json();
}

export function createLogsQuery() {
	return createQuery({
		queryKey: ['logs'],
		queryFn: async (): Promise<LogEntry[]> => {
			return fetchApi('/logs');
		},
		refetchInterval: 5000 // Auto-refresh every 5 seconds
	});
}
