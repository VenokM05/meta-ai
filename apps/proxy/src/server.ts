/**
 * Credential boundary.
 *
 * Room Guide's web app is a static SPA. If it called `api.meta.ai` directly, the API key
 * would have to be inlined into the shipped JavaScript bundle — where anyone who opens dev
 * tools owns it. So the browser talks to this process instead, and this process is the only
 * thing that holds `META_API_KEY`.
 *
 * That turns a leaked key into a different problem: an *open relay*. Anyone who can reach
 * this port can spend your quota, so the defaults are deliberately hostile:
 *
 * - binds 127.0.0.1 only; refuses any other interface unless ALLOW_PUBLIC=1 is set
 * - accepts only POST /api/segment and GET /healthz
 * - one concept per request, length-capped, control characters rejected
 * - request body capped, upstream timeout enforced, in-flight requests capped
 * - the key is never logged, echoed, or included in any response
 */

import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";

const UPSTREAM = "https://api.meta.ai/v1/responses";
const MODEL = "sam-3.1";

const PORT = Number(process.env.PROXY_PORT ?? 8787);
const HOST = process.env.PROXY_HOST ?? "127.0.0.1";
const ALLOW_PUBLIC = process.env.ALLOW_PUBLIC === "1";

/** Measured live at 1.0-3.3s; 15s leaves room for a bad network without hanging the loop. */
const UPSTREAM_TIMEOUT_MS = Number(process.env.PROXY_TIMEOUT_MS ?? 15_000);
/** ~390 bytes of base64 per pixel is absurd; 4 MB covers a real camera frame comfortably. */
const MAX_BODY_BYTES = 4_000_000;
const MAX_CONCEPT_CHARS = 48;
/** A browser tab doing 12 concepts per sweep should never approach this. */
const MAX_IN_FLIGHT = Number(process.env.PROXY_MAX_IN_FLIGHT ?? 6);

const apiKey = process.env.META_API_KEY ?? "";

let inFlight = 0;

interface SegmentRequest {
  concept?: unknown;
  imageDataUrl?: unknown;
}

function json(res: ServerResponse, code: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(code, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
    "cache-control": "no-store",
  });
  res.end(payload);
}

function readBody(req: IncomingMessage): Promise<string | null> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        resolve(null);
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", () => resolve(null));
  });
}

async function handleSegment(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (inFlight >= MAX_IN_FLIGHT) {
    json(res, 429, { ok: false, error: "proxy_at_capacity" });
    return;
  }

  const raw = await readBody(req);
  if (raw === null) {
    json(res, 413, { ok: false, error: "request_too_large" });
    return;
  }

  let parsed: SegmentRequest;
  try {
    parsed = JSON.parse(raw) as SegmentRequest;
  } catch {
    json(res, 400, { ok: false, error: "invalid_json" });
    return;
  }

  const concept = typeof parsed.concept === "string" ? parsed.concept.trim() : "";
  // One concept only: verified against the live API that a comma-joined prompt such as
  // "red square, green circle" returns zero matches, so batching here would silently
  // produce an empty scene rather than a faster one.
  if (!concept || concept.length > MAX_CONCEPT_CHARS || /[\u0000-\u001f]/.test(concept)) {
    json(res, 400, { ok: false, error: "invalid_concept" });
    return;
  }

  const image = typeof parsed.imageDataUrl === "string" ? parsed.imageDataUrl : "";
  if (!image.startsWith("data:image/")) {
    json(res, 400, { ok: false, error: "invalid_image" });
    return;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  const startedAt = Date.now();
  inFlight += 1;

  try {
    const upstream = await fetch(UPSTREAM, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        input: [
          {
            type: "message",
            role: "user",
            content: [
              { type: "input_text", text: concept },
              { type: "input_image", image_url: image },
            ],
          },
        ],
        // include_confidence is required for the minConfidence thresholds in the vocabulary
        // to mean anything; without it every box arrives with no score.
        metadata: { include_confidence: "true" },
      }),
      signal: controller.signal,
    });

    const latencyMs = Date.now() - startedAt;

    if (!upstream.ok) {
      // Upstream bodies can echo request details; only the status is forwarded.
      json(res, 502, { ok: false, error: "upstream_status", status: upstream.status, latencyMs });
      return;
    }

    const body = (await upstream.json()) as {
      status?: string;
      error?: unknown;
      output?: Array<{ content?: Array<{ text?: string }> }>;
    };

    const text = (body.output ?? [])
      .flatMap((item) => item.content ?? [])
      .map((part) => part.text ?? "")
      .join("");

    json(res, 200, {
      ok: true,
      concept,
      text,
      latencyMs,
      upstreamStatus: body.status ?? "unknown",
      completed: body.status === "completed" && !body.error,
    });
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    json(res, aborted ? 504 : 502, {
      ok: false,
      error: aborted ? "upstream_timeout" : "upstream_unreachable",
      latencyMs: Date.now() - startedAt,
    });
  } finally {
    clearTimeout(timer);
    inFlight -= 1;
  }
}

const server = createServer((req, res) => {
  const url = req.url ?? "";

  if (req.method === "GET" && url === "/healthz") {
    json(res, 200, { ok: true, configured: apiKey.length > 0, inFlight });
    return;
  }

  if (req.method === "OPTIONS") {
    // Dev only: Vite proxies /api so the browser sees one origin, but a separately hosted
    // proxy still needs these for the preflight.
    res.writeHead(204, {
      allow: "POST /api/segment, GET /healthz",
      "access-control-allow-origin": String(process.env.ALLOWED_ORIGIN ?? "http://localhost:5173"),
      "access-control-allow-methods": "POST, GET, OPTIONS",
      "access-control-allow-headers": "content-type",
      "access-control-max-age": "600",
    });
    res.end();
    return;
  }

  if (req.method === "POST" && url === "/api/segment") {
    const origin = req.headers.origin;
    const allowed = String(process.env.ALLOWED_ORIGIN ?? "http://localhost:5173");
    if (typeof origin === "string" && origin !== allowed) {
      json(res, 403, { ok: false, error: "origin_not_allowed" });
      return;
    }
    void handleSegment(req, res);
    return;
  }

  json(res, 404, { ok: false, error: "not_found" });
});

if (!apiKey) {
  console.error("[proxy] META_API_KEY is not set. Load it from the repository .env.");
  process.exit(1);
}

if (HOST !== "127.0.0.1" && HOST !== "localhost" && !ALLOW_PUBLIC) {
  console.error(
    `[proxy] refusing to bind ${HOST}: an unauthenticated proxy is a public spend button for ` +
      "your API key. Set ALLOW_PUBLIC=1 only behind authentication and TLS.",
  );
  process.exit(1);
}

server.listen(PORT, HOST, () => {
  console.log(`[proxy] listening on http://${HOST}:${PORT} — key held server-side`);
});
