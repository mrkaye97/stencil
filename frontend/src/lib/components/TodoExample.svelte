<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { createQuery, createMutation, useQueryClient } from '@tanstack/svelte-query';

	const queryClient = useQueryClient();

	// Example query for todos
	const todosQuery = createQuery({
		queryKey: ['todos'],
		queryFn: async () => {
			const response = await fetch('https://jsonplaceholder.typicode.com/todos?_limit=5');
			if (!response.ok) throw new Error('Failed to fetch todos');
			return response.json();
		}
	});

	// Example mutation for adding a todo
	const addTodoMutation = createMutation({
		mutationFn: async (title: string) => {
			const response = await fetch('https://jsonplaceholder.typicode.com/todos', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					title,
					completed: false,
					userId: 1
				})
			});
			if (!response.ok) throw new Error('Failed to add todo');
			return response.json();
		},
		onSuccess: () => {
			// Invalidate and refetch todos
			queryClient.invalidateQueries({ queryKey: ['todos'] });
		}
	});

	// Example mutation for toggling todo completion
	const toggleTodoMutation = createMutation({
		mutationFn: async ({ id, completed }: { id: number; completed: boolean }) => {
			const response = await fetch(`https://jsonplaceholder.typicode.com/todos/${id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ completed })
			});
			if (!response.ok) throw new Error('Failed to update todo');
			return response.json();
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['todos'] });
		}
	});

	let newTodoTitle = $state('');

	function handleAddTodo() {
		if (newTodoTitle.trim()) {
			$addTodoMutation.mutate(newTodoTitle);
			newTodoTitle = '';
		}
	}

	function handleToggleTodo(id: number, completed: boolean) {
		$toggleTodoMutation.mutate({ id, completed: !completed });
	}
</script>

<div class="mx-auto w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
	<h2 class="mb-6 text-center text-2xl font-bold">TanStack Query Todos</h2>

	<!-- Add new todo form -->
	<div class="mb-6">
		<div class="flex gap-2">
			<input
				bind:value={newTodoTitle}
				placeholder="Enter todo title..."
				class="flex-1 rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
				onkeydown={(e) => e.key === 'Enter' && handleAddTodo()}
			/>
			<Button onclick={handleAddTodo} disabled={!newTodoTitle.trim() || $addTodoMutation.isPending}>
				{$addTodoMutation.isPending ? 'Adding...' : 'Add'}
			</Button>
		</div>
		{#if $addTodoMutation.error}
			<p class="mt-2 text-sm text-red-500">{$addTodoMutation.error.message}</p>
		{/if}
	</div>

	<!-- Todos list -->
	{#if $todosQuery.isPending}
		<div class="py-8 text-center">
			<div class="inline-block h-8 w-8 animate-spin rounded-full border-b-2 border-blue-500"></div>
			<p class="mt-2 text-gray-500">Loading todos...</p>
		</div>
	{:else if $todosQuery.error}
		<div class="py-8 text-center">
			<p class="text-red-500">Error: {$todosQuery.error.message}</p>
			<Button onclick={() => $todosQuery.refetch()} class="mt-2">Retry</Button>
		</div>
	{:else if $todosQuery.data}
		<div class="space-y-2">
			{#each $todosQuery.data as todo}
				<div class="flex items-center gap-3 rounded-md border border-gray-200 p-3">
					<input
						type="checkbox"
						checked={todo.completed}
						onchange={() => handleToggleTodo(todo.id, todo.completed)}
						disabled={$toggleTodoMutation.isPending}
						class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
					/>
					<span class={todo.completed ? 'text-gray-500 line-through' : 'text-gray-900'}>
						{todo.title}
					</span>
				</div>
			{/each}
		</div>

		<div class="mt-6 flex justify-center">
			<Button onclick={() => $todosQuery.refetch()} disabled={$todosQuery.isFetching}>
				{$todosQuery.isFetching ? 'Refreshing...' : 'Refresh Todos'}
			</Button>
		</div>
	{/if}
</div>
