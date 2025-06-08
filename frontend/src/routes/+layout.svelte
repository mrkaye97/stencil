<script lang="ts">
	import '../app.css';
	import { QueryClient, QueryClientProvider } from '@tanstack/svelte-query';

	let { children } = $props();

	const queryClient = new QueryClient({
		defaultOptions: {
			queries: {
				staleTime: 1000 * 60 * 5
			}
		}
	});
</script>

<QueryClientProvider client={queryClient}>
	{@render children()}
</QueryClientProvider>
