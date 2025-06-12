import { createFileRoute } from "@tanstack/react-router";
import GraphsPage from "../components/GraphsPage";

export const Route = createFileRoute("/graphs")({
  component: GraphsPage,
});
