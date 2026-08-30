import { describe, expect, it } from "vitest";
import vercelApiHandler from "./vercelEntry";

describe("Vercel API Function", () => {
  it("exports the provider-neutral Express application as a source-detected catch-all handler", () => {
    expect(vercelApiHandler).toBeTypeOf("function");
  });
});
