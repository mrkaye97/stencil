import { createFileRoute } from "@tanstack/react-router";
import TraceDetailPage from "../../components/TraceDetailPage";

export const Route = createFileRoute("/traces/$traceId")({
  component: TraceDetailPage,
});
