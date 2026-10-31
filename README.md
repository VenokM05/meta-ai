# Room Guide

Live spatial narration for low-vision users, built on Meta SAM 3.1.

A long cane tells you what you have already touched. Room Guide is aimed at the moment before
that: what in this room could make you fall, where it is, and how far away it is — spoken in
the order that matters.

This is not a scene describer. It tracks twelve classes chosen by fall consequence, and it
would rather say nothing than assert that the path is clear.

## What it does

- **Live mode.** The camera frame is segmented by SAM 3.1 on a sweep: six concepts, one model
  call each, four in flight at a time. Between sweeps the guide coasts on the last geometry it
  saw and keeps narrating changes in position rather than re-describing the room.
- **Spatial language, not labels.** Detections become `a person, one step ahead, slightly
  left.` Bearing comes from the mask centroid; distance from a pinhole-size proxy; corridor
  membership comes from the projected walking path.
- **Priority by tier.** Critical, caution, and informative hazards get different glyph shapes,
  colours, sonification pitches, and speech urgency. Colour is never the only carrier.
- **Works with the screen off.** Speech and stereo-panned blips carry the same ranking. The
  visual instrument panel exists for sighted collaborators and for judging.
- **Honest failure states.** `n/a` means a class is not in the live watch list. `—` means it was
  asked and came back empty. `?` means the call failed. None of them means "absent".

## The part this project owns

SAM 3.1 answers "where is the thing I named". The engineering above it answers the harder
question for this user: **what does that geometry mean for the next step?**

`packages/core` is that translation layer:

- normalises model boxes and mask contours into frame-relative coordinates;
- converts apparent mask size into a distance band using a per-class reference width;
- derives bearing, span, and "in my path" membership;
- gates re-segmentation on scene change and a maximum coast interval;
- turns updates into ranked, debounced narration with per-concept identity, so a chair that
  moves twenty pixels does not get re-announced every frame;
- computes recall, false-negative rate, and missed-hazard lists for the Quality page.

`@meta-sam/parser` owns the wire format. Hand-rolling a base85 decoder would have been a
liability; the geometry-to-language translation above it is the part worth owning.

## Measured, not assumed

These numbers shaped the design:

| Fact | Measurement |
| --- | --- |
| One call answers one concept | A comma-joined prompt on an image containing both objects returned zero matches |
| Per-call latency | 1.0–3.3 s observed, typically 1.6–2.2 s |
| Sweep wall clock | 2.5–5.6 s (six concepts, four lanes) |
| Refresh cadence | 4 s coast between sweeps |
| Worst-case geometry age | ~10 s, roughly 13 m at walking pace |

That last row is the reason keyframe gating and mask coasting are load-bearing rather than an
optimisation: at 1.6–2.2 s per call there is no such thing as a per-frame live model. Treat
narration as a periodic scan, not a continuous sense.

## Run it

Requirements: Node 20+, an npm workspace install, and a Meta Model API key for live mode.

```bash
npm install

# Server-side only. Never VITE_*: Vite inlines those into the shipped bundle.
echo 'META_API_KEY=your-key-here' > .env

npm run dev:proxy   # terminal 1 — credential boundary on 127.0.0.1:8787
npm run dev         # terminal 2 — Vite on localhost:5173
```

Open `http://localhost:5173`, press **Use my camera**, then **Space** to start.

Mock mode needs no key and no proxy: synthetic scenes exercise the same geometry, gating,
narration, sonification, and metric paths. The header says `Synthetic` for exactly that
reason, and no latency figure is shown because no model call happens.

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run dev:proxy` | Credential proxy on loopback |
| `npm run dev:all` | Both, proxy in the background |
| `npm test` | 48 unit tests across core |
| `npm run typecheck` | Core + web |
| `npm run build` | Type-check and production Vite build |
| `npm run eval` | Regenerate `apps/web/public/eval-report.json` |

## Architecture

```
packages/core     Pure TypeScript: vocabulary, SAM adapter, geometry, gating,
                  narration FSM, metrics. No DOM, no network. 48 tests.
apps/web          React 19 + Vite. Instrument-panel UI, camera capture,
                  sweep orchestration, speech and sonification.
apps/proxy        Dependency-free Node server. Holds the only copy of the key,
                  validates concepts and image data URLs, caps body size and
                  in-flight requests.
eval              Scene fixtures and report generation for the Quality page.
```

### Credential boundary

A browser SPA cannot call the Meta API without shipping the key to every visitor. The proxy
exists so it does not:

- binds `127.0.0.1` by default and refuses a public bind unless `ALLOW_PUBLIC=1`;
- accepts only `POST /api/segment` and `GET /healthz`;
- rejects image URLs that are not `data:image/...`, which blocks the obvious SSRF shape;
- caps body size, concept length, upstream timeout, and concurrent requests;
- never logs or returns the key, and does not forward upstream error bodies.

`ALLOW_PUBLIC=1` is a loaded gun: an unauthenticated public proxy is a spend button for the
API key. Put authentication and TLS in front of it or leave it on loopback.

The key was shared during development and should be rotated after the hackathon.

## Quality page

`npm run eval` recomputes per-class recall, false-negative rate, per-tier recall, and an
explicit list of every ground-truth hazard that was never narrated. The page reads a generated
JSON file, so the numbers cannot drift from the code that produced them.

The current report is a **self-check**: ground truth is derived from the synthetic scene
actors, so it validates the scoring harness and nothing about model accuracy. Replacing those
fixtures with hand-labelled photographs is the next step before any accuracy claim is credible.

## Known limitations

- **Stale geometry.** A sweep plus the coast means on-screen geometry can be up to ~10 s old,
  roughly 13 m at walking pace. There is no motion extrapolation yet.
- **Distance is a proxy.** It assumes a per-class reference width; flat ground objects are the
  worst case, and the estimate is wrong whenever that assumption is.
- **Optimistic matching.** Evaluation uses bounding-box IoU, not mask IoU, so sloppy
  localisation can still count as a hit.
- **Absence is never asserted.** The system cannot say the path is clear. No amount of tuning
  changes that.
- **Not tested with low-vision users yet.** Until it is, every claim about real-world
  usefulness is a hypothesis.

## Next

1. Test with low-vision participants and record where the narration is wrong, not just whether
   it is impressive.
2. Extrapolate mask motion between sweeps to cut the staleness window.
3. Replace the synthetic eval fixtures with hand-labelled photographs.
4. Raise live coverage from six classes to the full twelve once rate-limit behaviour is
   understood.

Built for the Meta Global AI Developer Hackathon, indie developer track. Submission deadline
4 November 2026.
