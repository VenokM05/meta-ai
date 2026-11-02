import { Readable } from "node:stream";
import type { IncomingMessage } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";

type Json = Record<string, unknown>;

class FakeResponse {
  statusCode = 0;
  headers: Record<string, string> = {};
  payload = "";

  writeHead(code: number, headers: Record<string, string>) {
    this.statusCode = code;
    Object.assign(this.headers, headers);
    return this;
  }

  end(payload: string) {
    this.payload = payload;
  }

  get body(): Json {
    return JSON.parse(this.payload) as Json;
  }
}

function request(payload: unknown, headers: Record<string, string> = {}): IncomingMessage {
  const raw = typeof payload === "string" ? payload : JSON.stringify(payload);
  const req = Readable.from([Buffer.from(raw)]) as unknown as IncomingMessage & {
    method?: string;
  };
  (req as IncomingMessage & { method: string }).method = "POST";
  Object.assign(req, { headers: { host: "meta-ai-silk.vercel.app", ...headers } });
  return req;
}

function frame(): Json {
  return { concept: "chair", imageDataUrl: "data:image/jpeg;base64,AAAA" };
}

async function load() {
  const mod = await import("../segment");
  return mod.handler as unknown as (req: IncomingMessage, res: FakeResponse) => Promise<void>;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
  delete process.env.SEGMENT_RPM_LIMIT;
});

describe("hosted segmenter", () => {
  it("refuses a cross-origin caller", async () => {
    process.env.META_API_KEY = "test-key";
    const handler = await load();
    const res = new FakeResponse();
    await handler(request(frame(), { origin: "https://somewhere-else.example" }), res);
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toBe("origin_not_allowed");
  });

  it("accepts its own origin and forwards only the concept and frame", async () => {
    process.env.META_API_KEY = "test-key";
    const fetch = vi.fn(async () =>
      Response.json({
        status: "completed",
        output: [{ content: [{ text: "chair (0.91) [10,20,30,40]" }] }],
      }),
    );
    vi.stubGlobal("fetch", fetch);

    const handler = await load();
    const res = new FakeResponse();
    await handler(request(frame(), { origin: "https://meta-ai-silk.vercel.app" }), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ ok: true, concept: "chair", completed: true });
    expect(res.headers["content-type"]).toContain("application/json");
    expect(res.headers["cache-control"]).toBe("no-store");

    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.meta.ai/v1/responses");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer test-key");
    expect(JSON.stringify(init.body)).not.toContain("test-key");
  });

  it("never names a key it does not have", async () => {
    delete process.env.META_API_KEY;
    const handler = await load();
    const res = new FakeResponse();
    await handler(request(frame()), res);
    expect(res.statusCode).toBe(500);
    expect(res.body.error).toBe("key_not_configured");
  });

  it("rejects an over-long prompt and a non-image body", async () => {
    process.env.META_API_KEY = "test-key";
    const handler = await load();

    const tooLong = new FakeResponse();
    await handler(request({ ...frame(), concept: "c".repeat(49) }), tooLong);
    expect(tooLong.body.error).toBe("invalid_concept");

    const controlChar = new FakeResponse();
    await handler(request({ ...frame(), concept: "chair\u0007" }), controlChar);
    expect(controlChar.body.error).toBe("invalid_concept");

    const notImage = new FakeResponse();
    await handler(request({ ...frame(), imageDataUrl: "https://example.test/a.jpg" }), notImage);
    expect(notImage.body.error).toBe("invalid_image");
  });

  it("caps the request body", async () => {
    process.env.META_API_KEY = "test-key";
    const handler = await load();
    const res = new FakeResponse();
    const huge = JSON.stringify({ ...frame(), imageDataUrl: `data:image/jpeg;base64,${"A".repeat(4_100_000)}` });
    await handler(request(huge), res);
    expect(res.statusCode).toBe(413);
    expect(res.body.error).toBe("request_too_large");
  });

  it("budgets one address per minute", async () => {
    process.env.META_API_KEY = "test-key";
    process.env.SEGMENT_RPM_LIMIT = "2";
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ status: "completed", output: [] })));
    const handler = await load();

    const codes: number[] = [];
    for (let i = 0; i < 4; i += 1) {
      const res = new FakeResponse();
      await handler(request(frame(), { "x-forwarded-for": "203.0.113.9" }), res);
      codes.push(res.statusCode);
    }
    expect(codes).toEqual([200, 200, 429, 429]);
  });

  it("reports an upstream failure without echoing its body", async () => {
    process.env.META_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("secret detail from upstream", { status: 429 })),
    );
    const handler = await load();
    const res = new FakeResponse();
    await handler(request(frame()), res);
    expect(res.statusCode).toBe(502);
    expect(res.body).toMatchObject({ ok: false, error: "upstream_status", status: 429 });
    expect(res.payload).not.toContain("secret detail");
  });

  it("only takes POST", async () => {
    const handler = await load();
    const req = request(frame());
    (req as IncomingMessage & { method: string }).method = "GET";
    const res = new FakeResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(405);
  });
});
