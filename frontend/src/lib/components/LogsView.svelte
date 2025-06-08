<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { createLogsQuery } from '$lib/queries';

	const logsQuery = createLogsQuery();

	let searchTerm = $state('');
	let selectedSeverity = $state('all');
	let selectedService = $state('all');

	const filteredLogs = $derived(
		$logsQuery.data?.filter((log) => {
			const matchesSearch =
				!searchTerm ||
				log.body?.toLowerCase().includes(searchTerm.toLowerCase()) ||
				log.service_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
				log.trace_id?.toLowerCase().includes(searchTerm.toLowerCase());

			const matchesSeverity =
				selectedSeverity === 'all' ||
				log.severity_text?.toLowerCase() === selectedSeverity.toLowerCase();

			const matchesService = selectedService === 'all' || log.service_name === selectedService;

			return matchesSearch && matchesSeverity && matchesService;
		}) || []
	);

	const uniqueServices = $derived([
		...new Set($logsQuery.data?.map((log) => log.service_name).filter(Boolean) || [])
	]);
	const uniqueSeverities = $derived([
		...new Set($logsQuery.data?.map((log) => log.severity_text).filter(Boolean) || [])
	]);

	function getSeverityColor(severity?: string): string {
		if (!severity) return 'bg-gray-100 text-gray-800';

		switch (severity.toLowerCase()) {
			case 'trace':
				return 'bg-blue-100 text-blue-800';
			case 'debug':
				return 'bg-cyan-100 text-cyan-800';
			case 'info':
				return 'bg-green-100 text-green-800';
			case 'warn':
			case 'warning':
				return 'bg-yellow-100 text-yellow-800';
			case 'error':
				return 'bg-red-100 text-red-800';
			case 'fatal':
				return 'bg-purple-100 text-purple-800';
			default:
				return 'bg-gray-100 text-gray-800';
		}
	}

	function formatTimestamp(timestamp: string): string {
		try {
			return new Date(timestamp).toLocaleString();
		} catch {
			return timestamp;
		}
	}

	function formatLogBody(body?: string): string {
		if (!body) return '';
		try {
			const parsed = JSON.parse(body);
			return JSON.stringify(parsed, null, 2);
		} catch {
			return body;
		}
	}

	let expandedLogs = $state(new Set<string>());

	function toggleExpanded(logId: string) {
		if (expandedLogs.has(logId)) {
			expandedLogs.delete(logId);
		} else {
			expandedLogs.add(logId);
		}
		expandedLogs = new Set(expandedLogs);
	}
</script>

<div class="mx-auto w-full max-w-7xl rounded-lg bg-white p-6 shadow-lg">
	<div class="mb-6 rounded-lg bg-gray-50 p-4">
		<div class="grid grid-cols-1 gap-4 md:grid-cols-4">
			<div class="md:col-span-2">
				<label for="search" class="mb-1 block text-sm font-medium text-gray-700">
					Search logs
				</label>
				<input
					id="search"
					bind:value={searchTerm}
					placeholder="Search by message, service, trace ID..."
					class="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
				/>
			</div>

			<div>
				<label for="severity" class="mb-1 block text-sm font-medium text-gray-700">
					Severity
				</label>
				<select
					id="severity"
					bind:value={selectedSeverity}
					class="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
				>
					<option value="all">All Severities</option>
					{#each uniqueSeverities as severity}
						<option value={severity}>{severity}</option>
					{/each}
				</select>
			</div>

			<div>
				<label for="service" class="mb-1 block text-sm font-medium text-gray-700"> Service </label>
				<select
					id="service"
					bind:value={selectedService}
					class="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
				>
					<option value="all">All Services</option>
					{#each uniqueServices as service}
						<option value={service}>{service}</option>
					{/each}
				</select>
			</div>
		</div>

		<div class="mt-4 flex items-center justify-between">
			<div class="text-sm text-gray-600">
				Showing {filteredLogs.length} of {$logsQuery.data?.length || 0} logs
			</div>
			<div class="flex gap-2">
				<Button onclick={() => $logsQuery.refetch()} disabled={$logsQuery.isFetching} size="sm">
					{$logsQuery.isFetching ? 'Refreshing...' : 'Refresh'}
				</Button>
				<Button
					onclick={() => {
						searchTerm = '';
						selectedSeverity = 'all';
						selectedService = 'all';
					}}
					variant="outline"
					size="sm"
				>
					Clear Filters
				</Button>
			</div>
		</div>
	</div>

	{#if $logsQuery.isPending}
		<div class="py-12 text-center">
			<div class="inline-block h-8 w-8 animate-spin rounded-full border-b-2 border-blue-500"></div>
			<p class="mt-2 text-gray-500">Loading logs...</p>
		</div>
	{:else if $logsQuery.error}
		<div class="py-12 text-center">
			<div class="mx-auto max-w-md rounded-lg border border-red-200 bg-red-50 p-6">
				<p class="font-medium text-red-800">Failed to load logs</p>
				<p class="mt-1 text-sm text-red-600">{$logsQuery.error.message}</p>
				<Button onclick={() => $logsQuery.refetch()} class="mt-4">Try Again</Button>
			</div>
		</div>
	{:else if filteredLogs.length === 0}
		<div class="py-12 text-center">
			<div class="text-gray-500">
				{$logsQuery.data?.length === 0 ? 'No logs found' : 'No logs match your filters'}
			</div>
		</div>
	{:else}
		<div class="space-y-2">
			{#each filteredLogs as log (log.log_id)}
				<div class="rounded-lg border border-gray-200 bg-white transition-shadow hover:shadow-sm">
					<div class="p-4">
						<div class="flex items-start justify-between">
							<div class="min-w-0 flex-1">
								<div class="mb-2 flex items-center gap-3">
									<span class="font-mono text-sm text-gray-500">
										{formatTimestamp(log.timestamp)}
									</span>
									{#if log.severity_text}
										<span
											class="rounded-full px-2 py-1 text-xs font-medium {getSeverityColor(
												log.severity_text
											)}"
										>
											{log.severity_text}
										</span>
									{/if}
									{#if log.service_name}
										<span
											class="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800"
										>
											{log.service_name}
										</span>
									{/if}
								</div>

								<div class="text-gray-900">
									{#if log.body}
										<div class="break-words">
											{#if expandedLogs.has(log.log_id)}
												<pre
													class="overflow-x-auto rounded border bg-gray-50 p-3 text-sm">{formatLogBody(
														log.body
													)}</pre>
											{:else}
												<p class="text-sm">
													{log.body.length > 200 ? log.body.substring(0, 200) + '...' : log.body}
												</p>
											{/if}
										</div>
									{:else}
										<p class="text-sm italic text-gray-500">No message body</p>
									{/if}
								</div>

								{#if expandedLogs.has(log.log_id)}
									<div class="mt-3 border-t border-gray-100 pt-3">
										<div class="grid grid-cols-1 gap-3 text-xs md:grid-cols-2">
											<div>
												<strong>Log ID:</strong>
												<code class="rounded bg-gray-100 px-1">{log.log_id}</code>
											</div>
											{#if log.trace_id}
												<div>
													<strong>Trace ID:</strong>
													<code class="rounded bg-gray-100 px-1">{log.trace_id}</code>
												</div>
											{/if}
											{#if log.span_id}
												<div>
													<strong>Span ID:</strong>
													<code class="rounded bg-gray-100 px-1">{log.span_id}</code>
												</div>
											{/if}
											{#if log.instrumentation_library}
												<div><strong>Library:</strong> {log.instrumentation_library}</div>
											{/if}
											{#if log.observed_timestamp}
												<div>
													<strong>Observed:</strong>
													{formatTimestamp(log.observed_timestamp)}
												</div>
											{/if}
											<div><strong>Severity Number:</strong> {log.severity_number}</div>
										</div>
									</div>
								{/if}
							</div>

							<Button
								onclick={() => toggleExpanded(log.log_id)}
								class="ml-4 p-1 text-gray-400 transition-colors hover:text-gray-600"
								title={expandedLogs.has(log.log_id) ? 'Collapse' : 'Expand'}
							>
								<svg
									class="h-5 w-5 transform transition-transform {expandedLogs.has(log.log_id)
										? 'rotate-180'
										: ''}"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M19 9l-7 7-7-7"
									/>
								</svg>
							</Button>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
