import { describe, expect, it } from "vitest";
import { handler } from "../netlify/functions/api";

describe("Netlify API Function", () => {
  it("serves the public system health procedure after Netlify's internal function prefix is removed", async () => {
    const input = JSON.stringify({
      0: { json: { timestamp: 1 } },
    });

    const response = await handler(
      {
        httpMethod: "GET",
        path: "/.netlify/functions/api/api/trpc/system.health",
        headers: { host: "proctorx.netlify.app" },
        multiValueHeaders: {},
        queryStringParameters: { batch: "1", input },
        multiValueQueryStringParameters: {},
        requestContext: {},
        resource: "/.netlify/functions/api/api/*",
        body: null,
        isBase64Encoded: false,
      } as never,
      {} as never
    );

    expect(response.statusCode).toBe(200);
    expect(response.body).toContain('"ok":true');
    expect(response.body).toMatch(/"firebaseAdminConfigured":(?:true|false)/);
  });
});
