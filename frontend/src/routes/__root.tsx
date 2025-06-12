import { Outlet, createRootRoute } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

import Layout from "../components/Layout";

export const Route = createRootRoute({
  component: () => (
    <div className="dark">
      <Layout>
        <Outlet />
        <TanStackRouterDevtools />
      </Layout>
    </div>
  ),
});
