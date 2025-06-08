import { createQuery, createMutation, useQueryClient } from '@tanstack/svelte-query';

// Example API base URL - replace with your actual backend URL
const API_BASE_URL = 'http://localhost:3000'; // Adjust this to match your Rust backend

// Generic fetch function with error handling
async function fetchApi(endpoint: string, options?: RequestInit) {
	const response = await fetch(`${API_BASE_URL}${endpoint}`, {
		headers: {
			'Content-Type': 'application/json',
			...options?.headers,
		},
		...options,
	});

	if (!response.ok) {
		throw new Error(`HTTP error! status: ${response.status}`);
	}

	return response.json();
}

// Example query factory functions
export function createPostsQuery() {
	return createQuery({
		queryKey: ['posts'],
		queryFn: () => fetchApi('/posts'),
	});
}

export function createPostQuery(id: number) {
	return createQuery({
		queryKey: ['posts', id],
		queryFn: () => fetchApi(`/posts/${id}`),
		enabled: !!id, // Only run if id is truthy
	});
}

// Example mutation for creating a post
export function createPostMutation() {
	const queryClient = useQueryClient();

	return createMutation({
		mutationFn: async (newPost: { title: string; body: string }) => {
			return fetchApi('/posts', {
				method: 'POST',
				body: JSON.stringify(newPost),
			});
		},
		onSuccess: () => {
			// Invalidate and refetch posts query after successful creation
			queryClient.invalidateQueries({ queryKey: ['posts'] });
		},
	});
}

// Example mutation for updating a post
export function createUpdatePostMutation() {
	const queryClient = useQueryClient();

	return createMutation({
		mutationFn: async ({ id, ...updates }: { id: number; title?: string; body?: string }) => {
			return fetchApi(`/posts/${id}`, {
				method: 'PUT',
				body: JSON.stringify(updates),
			});
		},
		onSuccess: (data, variables) => {
			// Update the specific post in the cache
			queryClient.setQueryData(['posts', variables.id], data);
			// Also invalidate the posts list
			queryClient.invalidateQueries({ queryKey: ['posts'] });
		},
	});
}

// Example mutation for deleting a post
export function createDeletePostMutation() {
	const queryClient = useQueryClient();

	return createMutation({
		mutationFn: async (id: number) => {
			return fetchApi(`/posts/${id}`, {
				method: 'DELETE',
			});
		},
		onSuccess: (data, id) => {
			// Remove the post from the cache
			queryClient.removeQueries({ queryKey: ['posts', id] });
			// Invalidate the posts list
			queryClient.invalidateQueries({ queryKey: ['posts'] });
		},
	});
}
