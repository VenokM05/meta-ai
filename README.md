# Room Guide

Live spatial narration for low-vision users, built on Meta SAM 3.1.

A long cane tells you what you have already touched. Room Guide is aimed at the moment before
that: what in this room could make you fall, where it is, and how far away it is — spoken in
the order that matters.

This is not a scene describer. It tracks twelve classes chosen by fall consequence, and it
would rather say nothing than assert that the path is clear.

## What it does

- **Live mode.** The camera frame is segmented by SAM 3.1 on a sweep: seven concepts, one model
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
| Sweep wall clock | 4.2–6.8 s (seven concepts, four lanes) |
| Refresh cadence | 4 s coast between sweeps |
| Worst-case geometry age | ~11 s, roughly 15 m at walking pace |

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

### Hosted

`api/` holds the same endpoint as Vercel Node functions, so the deployed link can use a real
camera without a laptop in the room. Set `META_API_KEY` in the Vercel project's environment
variables (Production and Preview) and redeploy. Never `VITE_META_API_KEY`: Vite inlines
`VITE_*` into the shipped bundle.

The app probes `GET /api/healthz` before opening a camera. A host whose segmenter is missing
or has no key keeps the camera closed and says so, rather than narrating the synthetic scene
while a user believes their own room is being scanned.

### Operating it without sight

The interface is built to be used with the screen off:

- **Space** starts or pauses, **D** describes the view now, **R** repeats the last line,
  **S** toggles automatic narration, **H** opens spoken help, **Esc** stops.
- **1 / 2 / 3** set detail: critical only, critical + caution, or everything. Detail filters
  what is spoken, not what is detected.
- Earcons carry state: a rising pair means start, a falling pair means pause, one soft ping
  means a fresh scan, and a low double thud means the view is older than 12 s. The stale tone
  is followed by a spoken warning.
- **A** starts aim coaching: the phone's motion sensors drive a tick that rises as the phone
  nears level, and stops at level. Spoken cues name the tilt to correct. It needs the camera
  on, a device with motion sensors, and (on iPhone) motion permission. *Level* means the phone
  is level, not that the path is clear.
- **Screen reader mode** in Audio settings keeps SpeechSynthesis silent so VoiceOver or NVDA
  is the only voice. Live regions remain for narration, status, and failures.
- Listener preferences persist in `localStorage`, so a reload does not silently change what
  gets announced.

### Languages

Speech and interface text follow the phone's locale on first run; Audio settings carries an
override. English, Spanish, French, Portuguese, and German cover narration, help, status,
settings, and aim coaching. The spoken voice is picked from the device's installed
`SpeechSynthesis` voices by language tag, so a German locale gets a German voice rather than
accented English.

Two deliberate exceptions: diagnostics and telemetry stay in English so measurements remain
comparable, and a concept with no local term falls back to its English label.

### On a phone

The guide is installable as a PWA and runs standalone, without browser chrome. Once installed
it starts offline: a service worker caches the shell and the hashed bundle at install and
prunes assets from earlier builds.

- A fixed five-button dock — start/pause, describe, repeat, narration, help — sits within
  thumb reach at the bottom. Desktop keeps the full control panel.
- Safe-area insets keep the dock above the home indicator and the header below the notch.
- The screen wake lock is held while the guide runs and re-acquired when the tab becomes
  visible again, so narration does not stop because the phone dimmed.
- Dock labels are shorter than the page buttons so five columns fit a 320px screen without
  clipping; nothing is truncated, only reworded.

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run dev:proxy` | Credential proxy on loopback |
| `npm run dev:all` | Both, proxy in the background |
| `npm test` | 56 unit tests across core and the hosted handler |
| `npm run typecheck` | Core, web, and hosted functions |
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
api               The same endpoint as Vercel Node functions, reading the key
                  from runtime env. Same-origin check, per-IP budget, body and
                  concurrency caps. Tests live in api/test.
eval              Scene fixtures and report generation for the Quality page.
```

### Credential boundary

A browser SPA cannot call the Meta API without shipping the key to every visitor. Two
server-side boundaries exist so it does not:

- **Local proxy** (`apps/proxy`, default): binds `127.0.0.1` and refuses a public bind unless
  `ALLOW_PUBLIC=1`; accepts only `POST /api/segment` and `GET /healthz` (plus the
  `/api/healthz` probe path); rejects image URLs that are not `data:image/...`, which blocks
  the obvious SSRF shape; caps body size, concept length, upstream timeout, and concurrent
  requests.
- **Hosted functions** (`api/`, Vercel): read the key from runtime environment variables and
  accept only same-Origin requests. Each IP gets a per-minute request budget, and each
  instance caps concurrent calls. These limits are best effort: serverless instances do not
  share memory, so a distributed caller sees a looser limit than one tab does.

Both never log or return the key, and neither forwards upstream error bodies.

`ALLOW_PUBLIC=1` is a loaded gun: an unauthenticated public proxy is a spend button for the
API key. Put authentication and TLS in front of it or leave it on loopback. The hosted
functions are intentionally a smaller version of that risk — public by design, bounded by the
caps above, and limited to the demo window.

The key was shared during development and should be rotated after the hackathon; rotate it
regardless of how the hosted functions behave.

## Quality page

`npm run eval` recomputes per-class recall, false-negative rate, per-tier recall, and an
explicit list of every ground-truth hazard that was never narrated. The page reads a generated
JSON file, so the numbers cannot drift from the code that produced them.

The current report is a **self-check**: ground truth is derived from the synthetic scene
actors, so it validates the scoring harness and nothing about model accuracy. Replacing those
fixtures with hand-labelled photographs is the next step before any accuracy claim is credible.

## Known limitations

- **Stale geometry.** A sweep plus the coast means on-screen geometry can be up to ~11 s old,
  roughly 15 m at walking pace. There is no motion extrapolation yet.
- **Distance is a proxy.** It assumes a per-class reference width; flat ground objects are the
  worst case, and the estimate is wrong whenever that assumption is.
- **Optimistic matching.** Evaluation uses bounding-box IoU, not mask IoU, so sloppy
  localisation can still count as a hit.
- **Absence is never asserted.** The system cannot say the path is clear. No amount of tuning
  changes that.
- **Not tested with low-vision users yet.** Until it is, every claim about real-world
  usefulness is a hypothesis.
- **The hosted demo is a public relay.** Its caps bound abuse, not eliminate it. Quota can be
  spent by anyone who finds the link until the key is rotated.
- **Translations are unreviewed.** Spanish, French, Portuguese, and German were written to
  match the English wording, not by native speakers or with assistive-tech users. Treat the
  non-English narration as a draft until someone who uses a screen reader in that language
  has read it.

## Next

1. Test with low-vision participants and record where the narration is wrong, not just whether
   it is impressive.
2. Extrapolate mask motion between sweeps to cut the staleness window.
3. Replace the synthetic eval fixtures with hand-labelled photographs.
4. Raise live coverage from seven classes to the full twelve once rate-limit behaviour is
   understood.

Built for the Meta Global AI Developer Hackathon, indie developer track. Submission deadline
4 November 2026.
