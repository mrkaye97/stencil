import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/traces/$traceId')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/traces/$traceId"!</div>
}
