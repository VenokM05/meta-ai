/*
 * Room Guide service worker. Production only — registered from main.tsx behind
 * import.meta.env.PROD. Same-origin GETs only: the Meta proxy on :8787 is deliberately
 * bypassed, so a stale scene is never served as if it were live.
 */
const CACHE = "roomguide-v2";
const SHELL = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/favicon.svg",
  "/icon.svg",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
];

/**
 * The entry HTML points at hashed JS/CSS, so their names are only known at build time.
 * Read them out of index.html during install and precache them; otherwise a cold offline
 * start would get the shell HTML but no script to run.
 */
async function precache() {
  const cache = await caches.open(CACHE);
  // One missing optional icon must not block installation of the rest.
  await Promise.allSettled(SHELL.map((url) => cache.add(url)));

  try {
    const res = await fetch("/index.html", { cache: "reload" });
    const html = await res.text();
    const urls = new Set();
    for (const match of html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)) {
      urls.add(match[1]);
    }
    await Promise.allSettled([...urls].map((url) => cache.add(url)));

    // Drop hashed assets from earlier builds; this cache name outlives deploys.
    const wanted = new Set([...SHELL, ...urls].map((p) => new URL(p, self.location.href).pathname));
    const cached = await cache.keys();
    await Promise.allSettled(
      cached
        .filter((req) => !wanted.has(new URL(req.url).pathname))
        .map((req) => cache.delete(req)),
    );
  } catch {
    // A network hiccup here only costs offline start-up, never the live guide.
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put("/index.html", copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match("/index.html", { ignoreVary: true })),
    );
    return;
  }

  event.respondWith(
    // ignoreVary matters: dev/preview servers emit `Vary: Origin`, and a module-script
    // request carries an Origin header the SW's precache fetch did not.
    caches.match(req, { ignoreVary: true }).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, copy)).catch(() => {});
          }
          return res;
        }),
    ),
  );
});
