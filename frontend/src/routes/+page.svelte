<script lang="ts">
	import LogsView from '$lib/components/LogsView.svelte';
</script>

<svelte:head>
	<title>Stencil - OpenTelemetry Dashboard</title>
	<meta
		name="description"
		content="Monitor your application's logs, traces, and spans in real-time"
	/>
</svelte:head>

<div class="py-8">
	<div class="mx-auto max-w-7xl px-4">
		<!-- Header Section -->
		<div class="mb-8 text-center">
			<h1 class="mb-4 text-4xl font-bold">Stencil - OpenTelemetry Dashboard</h1>
			<p class="text-gray-600">Monitor your application's logs, traces, and spans in real-time</p>
		</div>

		<!-- Logs Section -->
		<LogsView />
	</div>
</div>
