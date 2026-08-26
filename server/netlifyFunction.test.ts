import { describe, expect, it } from "vitest";
import { config, handler } from "../netlify/functions/api";

describe("Netlify API Function", () => {
  it("preserves the existing API path contract", () => {
    expect(config.path).toBe("/api/*");
  });

  it("serves the public system health procedure through the Express adapter", async () => {
    const input = JSON.stringify({
      0: { json: { timestamp: 1 } },
    });

    const response = await handler(
      {
        httpMethod: "GET",
        path: "/api/trpc/system.health",
        headers: { host: "proctorx.netlify.app" },
        multiValueHeaders: {},
        queryStringParameters: { batch: "1", input },
        multiValueQueryStringParameters: {},
        requestContext: {},
        resource: "/api/*",
        body: null,
        isBase64Encoded: false,
      } as never,
      {} as never
    );

    expect(response.statusCode).toBe(200);
    expect(response.body).toContain('"ok":true');
  });
});
