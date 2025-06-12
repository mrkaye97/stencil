import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/traces')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/traces"!</div>
}
