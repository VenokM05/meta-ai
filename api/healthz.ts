/**
 * The app probes this before opening a camera: a camera whose frames nobody can analyse would
 * narrate a scene that is not the user's room. Only booleans are returned — the key is never
 * reported, echoed, or logged.
 */

import type { IncomingMessage, ServerResponse } from "node:http";

export const config = { maxDuration: 5 };

function json(res: ServerResponse, code: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(code, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(payload);
}

export function handler(req: IncomingMessage, res: ServerResponse): void {
  if (req.method !== "GET") {
    json(res, 405, { ok: false, error: "method_not_allowed" });
    return;
  }
  json(res, 200, { ok: true, configured: Boolean(process.env.META_API_KEY) });
}

export default handler;
