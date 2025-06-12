import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/graphs')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/graphs"!</div>
}
