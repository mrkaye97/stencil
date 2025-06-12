import { createFileRoute } from "@tanstack/react-router";
import TracesPage from "../components/TracesPage";

export const Route = createFileRoute("/traces")({
  component: TracesPage,
});
