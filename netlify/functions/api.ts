import serverless from "serverless-http";
import { createServerApp } from "../../server/serverApp";

/**
 * Runs the existing Express/tRPC application as a Netlify Function. The
 * Netlify redirect in `netlify.toml` preserves the browser-facing `/api/*`
 * contract while this adapter removes Netlify's internal function prefix.
 */
const app = createServerApp();

export const handler = serverless(app, {
  basePath: "/.netlify/functions/api",
});
