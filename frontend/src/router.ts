import { createRoute, createRootRoute, createRouter } from '@tanstack/react-router'
import Layout from './components/Layout'
import Dashboard from './components/Dashboard'
import TracesPage from './components/TracesPage'
import TraceDetailPage from './components/TraceDetailPage'
import LogsPage from './components/LogsPage'
import GraphsPage from './components/GraphsPage'

const rootRoute = createRootRoute({
  component: Layout,
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: Dashboard,
})

const tracesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/traces',
  component: TracesPage,
})

const traceDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/trace/$traceId',
  component: TraceDetailPage,
})

const logsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/logs',
  component: LogsPage,
})

const graphsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/graphs',
  component: GraphsPage,
})

const routeTree = rootRoute.addChildren([
  indexRoute,
  tracesRoute,
  traceDetailRoute,
  logsRoute,
  graphsRoute,
])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
