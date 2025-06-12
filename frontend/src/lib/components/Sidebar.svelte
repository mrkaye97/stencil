<script lang="ts">
	import { page } from '$app/stores';
	import { Sidebar, SidebarGroup, SidebarItem, SidebarWrapper } from 'flowbite-svelte';
	import {
		ChartPieSolid,
		ChartLineUpSolid,
		BugSolid,
		HomeSolid,
		ClipboardListSolid
	} from 'flowbite-svelte-icons';

	const sidebarItems = [
		{
			label: 'Dashboard',
			href: '/',
			icon: HomeSolid,
			activeMatch: (pathname: string) => pathname === '/'
		},
		{
			label: 'Traces',
			href: '/traces',
			icon: BugSolid,
			activeMatch: (pathname: string) => pathname.startsWith('/traces')
		},
		{
			label: 'Logs',
			href: '/logs',
			icon: ClipboardListSolid,
			activeMatch: (pathname: string) => pathname.startsWith('/logs')
		},
		{
			label: 'Graphs',
			href: '/graphs',
			icon: ChartLineUpSolid,
			activeMatch: (pathname: string) => pathname.startsWith('/graphs')
		}
	];

	$: currentPath = $page.url.pathname;
</script>

<Sidebar {activeUrl: currentPath} class="fixed inset-y-0 left-0 z-50 w-64 bg-gray-900">
	<SidebarWrapper class="bg-gray-900">
		<div class="px-3 py-4">
			<h1 class="text-xl font-bold text-white">Stencil</h1>
			<p class="text-gray-400 text-sm">Observability Platform</p>
		</div>

		<SidebarGroup>
			{#each sidebarItems as item}
				<SidebarItem
					href={item.href}
					label={item.label}
					active={item.activeMatch(currentPath)}
					class="text-gray-300 hover:bg-gray-800 hover:text-white"
					activeClass="bg-gray-800 text-white"
				>
					<svelte:component this={item.icon} slot="icon" class="w-5 h-5" />
				</SidebarItem>
			{/each}
		</SidebarGroup>
	</SidebarWrapper>
</Sidebar>
