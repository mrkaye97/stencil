<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { createQuery } from '@tanstack/svelte-query';
	import TodoExample from '$lib/components/TodoExample.svelte';

	let count = $state(0);

	// Example query - fetching posts from JSONPlaceholder
	const postsQuery = createQuery({
		queryKey: ['posts'],
		queryFn: async () => {
			const response = await fetch('https://jsonplaceholder.typicode.com/posts?_limit=5');
			if (!response.ok) {
				throw new Error('Failed to fetch posts');
			}
			return response.json();
		}
	});
</script>

<div class="min-h-screen bg-gray-50 py-8">
	<div class="mx-auto max-w-4xl space-y-12 px-4">
		<!-- Header Section -->
		<div class="text-center">
			<h1 class="mb-4 text-4xl font-bold">Welcome to SvelteKit with TanStack Query</h1>
			<p class="mb-4 text-gray-600">
				Visit <a href="https://svelte.dev/docs/kit" class="text-blue-500 hover:underline"
					>svelte.dev/docs/kit</a
				> to read the documentation
			</p>
			<Button on:click={() => count++}>Click me - Count {count}</Button>
		</div>

		<!-- Query Example Section -->
		<div class="rounded-lg bg-white p-6 shadow-lg">
			<h2 class="mb-4 text-2xl font-bold">Simple Query Example</h2>

			{#if $postsQuery.isPending}
				<div class="py-8 text-center">
					<div
						class="inline-block h-8 w-8 animate-spin rounded-full border-b-2 border-blue-500"
					></div>
					<p class="mt-2 text-gray-500">Loading posts...</p>
				</div>
			{:else if $postsQuery.error}
				<p class="text-red-500">Error: {$postsQuery.error.message}</p>
			{:else if $postsQuery.data}
				<div class="space-y-4">
					{#each $postsQuery.data as post}
						<div class="rounded-lg border border-gray-200 p-4">
							<h3 class="text-lg font-semibold">{post.title}</h3>
							<p class="mt-2 text-gray-600">{post.body}</p>
						</div>
					{/each}
				</div>
			{/if}

			<div class="mt-4">
				<Button on:click={() => $postsQuery.refetch()} disabled={$postsQuery.isFetching}>
					{$postsQuery.isFetching ? 'Refetching...' : 'Refetch Posts'}
				</Button>
			</div>
		</div>

		<!-- Mutation Example Section -->
		<div class="rounded-lg bg-white p-6 shadow-lg">
			<h2 class="mb-4 text-2xl font-bold">Mutation Example</h2>
			<TodoExample />
		</div>
	</div>
</div>
