import type { Config } from "@netlify/functions";
import serverless from "serverless-http";
import { createVercelApp } from "../../server/vercelApp";

/**
 * Runs the existing Express/tRPC application as a Netlify Function while
 * preserving the application's `/api/*` contract for browser clients.
 */
const app = createVercelApp();

export const config: Config = {
  path: "/api/*",
};

export const handler = serverless(app);
