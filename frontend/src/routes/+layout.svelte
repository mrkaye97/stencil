<script lang="ts">
	import '../app.css';
	import { QueryClient, QueryClientProvider } from '@tanstack/svelte-query';
	import { page } from '$app/stores';

	let { children } = $props();

	const queryClient = new QueryClient({
		defaultOptions: {
			queries: {
				staleTime: 1000 * 60 * 5
			}
		}
	});

	let currentPath = $derived($page.url.pathname);
</script>

<QueryClientProvider client={queryClient}>
	<div class="min-h-screen bg-gray-50">
		<!-- Navigation -->
		<nav class="border-b bg-white shadow-sm">
			<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
				<div class="flex h-16 justify-between">
					<div class="flex items-center">
						<a href="/" class="text-xl font-bold text-gray-900">Stencil</a>
					</div>
					<div class="flex items-center space-x-8">
						<a
							href="/"
							class="text-sm font-medium transition-colors {currentPath === '/'
								? 'border-b-2 border-blue-600 text-blue-600'
								: 'text-gray-700 hover:text-blue-600'} pb-4"
						>
							Dashboard
						</a>
					</div>
				</div>
			</div>
		</nav>

		<!-- Main Content -->
		<main>
			{@render children()}
		</main>
	</div>
</QueryClientProvider>
