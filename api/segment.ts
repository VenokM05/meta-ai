/**
 * Hosted credential boundary.
 *
 * Same rule as the local proxy in apps/proxy: the browser never holds `META_API_KEY`, and
 * only this server-side code reads it. Vercel injects the secret at runtime, so nothing about
 * it reaches the shipped bundle.
 *
 * The difference is exposure. The local proxy binds to loopback and pins one Origin; this one
 * is on the public internet, so it is a spend button for whoever finds the URL. The caps here
 * are what make that survivable for a demo: same-Origin requests only, a per-IP request
 * budget, one length-capped concept per call, a body cap, an upstream timeout, and a cap on
 * concurrent calls per instance. They are best effort, not a substitute for rotating the key
 * once the deadline has passed.
 */

import type { IncomingMessage, ServerResponse } from "node:http";

const UPSTREAM = "https://api.meta.ai/v1/responses";
const MODEL = "sam-3.1";

/** Measured live at 1.0-3.3s; 15s leaves room for a bad network without hanging the loop. */
const UPSTREAM_TIMEOUT_MS = Number(process.env.SEGMENT_TIMEOUT_MS ?? 15_000);
const MAX_BODY_BYTES = 4_000_000;
const MAX_CONCEPT_CHARS = 48;
const MAX_IN_FLIGHT = Number(process.env.SEGMENT_MAX_IN_FLIGHT ?? 6);
/** A continuous user sweeps 7 concepts roughly every 8s, so ~55/min; 100 leaves headroom. */
const MAX_REQUESTS_PER_MINUTE = Number(process.env.SEGMENT_RPM_LIMIT ?? 100);
const RATE_WINDOW_MS = 60_000;

// Vercel's default function duration is shorter than the upstream timeout it enforces.
export const config = { maxDuration: 20 };

interface SegmentRequest {
  concept?: unknown;
  imageDataUrl?: unknown;
}

function json(res: ServerResponse, code: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(code, {
    "content-type": "application/json; charset=utf-8",
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

function clientIp(req: IncomingMessage): string {
  const forwarded = req.headers["x-forwarded-for"];
  const first = typeof forwarded === "string" ? forwarded.split(",")[0]?.trim() : undefined;
  return first || "unknown";
}

/**
 * Per-instance and in-memory, so a burst spread across warm instances sees a fraction of this
 * limit. Enough to stop one tab — or one script — hammering the key from a single address.
 */
const hits = new Map<string, number[]>();

function rateLimited(ip: string, now: number): boolean {
  const windowStart = now - RATE_WINDOW_MS;
  const recent = (hits.get(ip) ?? []).filter((t) => t > windowStart);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 256) {
    for (const [key, times] of hits) {
      if ((times[times.length - 1] ?? 0) <= windowStart) hits.delete(key);
    }
  }
  return recent.length > MAX_REQUESTS_PER_MINUTE;
}

function sameOrigin(req: IncomingMessage): boolean {
  const origin = req.headers.origin;
  if (typeof origin !== "string") return true; // non-browser callers send no Origin at all
  const host = req.headers["x-forwarded-host"] ?? req.headers.host;
  const proto = String(req.headers["x-forwarded-proto"] ?? "https");
  const self = host ? `${proto}://${host}` : "";
  const extra = process.env.SEGMENT_ALLOWED_ORIGIN ?? "";
  return origin === self || (extra.length > 0 && origin === extra);
}

let inFlight = 0;

export async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== "POST") {
    json(res, 405, { ok: false, error: "method_not_allowed" });
    return;
  }
  if (!sameOrigin(req)) {
    json(res, 403, { ok: false, error: "origin_not_allowed" });
    return;
  }
  if (rateLimited(clientIp(req), Date.now())) {
    json(res, 429, { ok: false, error: "rate_limited" });
    return;
  }
  if (inFlight >= MAX_IN_FLIGHT) {
    json(res, 429, { ok: false, error: "segmenter_at_capacity" });
    return;
  }
  if (!process.env.META_API_KEY) {
    // A missing key is a deployment fault, and naming it beats a misleading 502 upstream.
    json(res, 500, { ok: false, error: "key_not_configured" });
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
  // One concept only: verified against the live API that a comma-joined prompt returns zero
  // matches, so batching would silently produce an empty scene rather than a faster one.
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
        authorization: `Bearer ${String(process.env.META_API_KEY ?? "")}`,
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
        // include_confidence is required for the minConfidence thresholds in the vocabulary to
        // mean anything; without it every box arrives with no score.
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

export default handler;
