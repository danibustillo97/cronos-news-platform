import { describe, expect, it } from "vitest";
import { responseError } from "./apiErrors";

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("responseError", () => {
  it("prefers the server's message, then FastAPI's detail", async () => {
    expect((await responseError(json(409, { message: "Ya publicado", detail: "x" }))).message).toBe("Ya publicado");
    expect((await responseError(json(422, { detail: "slug inválido" }))).message).toBe("slug inválido");
  });

  it("explains an expired session and falls back to the status code", async () => {
    expect((await responseError(json(401, { detail: "Invalid or expired session" }))).message).toMatch(/sesión caducó/);
    expect((await responseError(new Response("<html>", { status: 502 }))).message).toBe("HTTP 502");
  });
});
