// Offline support. Bump VERSION when this file's caching rules or PRECACHE change.
// index.html does not need a bump: it is re-fetched from the network whenever online.
const VERSION = "v1";
const CACHE = `cheki-${VERSION}`;
const APP_SHELL = "/";
const NETWORK_TIMEOUT_MS = 3000;

const FACE_API_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/dist/face-api.js";
const LOCAL_ASSETS = [
  APP_SHELL,
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
  "/icons/favicon-64.png",
];
const EXTERNAL_HOSTS = new Set(["fonts.googleapis.com", "fonts.gstatic.com", "cdn.jsdelivr.net"]);

const isCacheable = res => res.ok || res.type === "opaque";

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(LOCAL_ASSETS.map(url => new Request(url, { cache: "reload" })));
    // Face detection is optional: going offline-ready must not depend on the CDN being up.
    try {
      await cache.add(new Request(FACE_API_URL, { mode: "cors" }));
    } catch (e) {}
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(
      names.filter(n => n.startsWith("cheki-") && n !== CACHE).map(n => caches.delete(n)),
    );
    await self.clients.claim();
  })());
});

// Newest copy when online; the saved copy when offline, slow, or the server returns an error.
async function appShell(event) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(APP_SHELL);
  const network = fetch(event.request).then(async res => {
    if (res.ok) await cache.put(APP_SHELL, res.clone());
    return res;
  });
  event.waitUntil(network.catch(() => {}));
  if (!cached) return network;
  return Promise.race([
    network.then(res => (res.ok ? res : cached), () => cached),
    new Promise(resolve => setTimeout(() => resolve(cached), NETWORK_TIMEOUT_MS)),
  ]);
}

// Fonts and the versioned face-api build never change at the same URL.
async function externalAsset(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const res = await fetch(request);
  if (isCacheable(res)) await cache.put(request, res.clone());
  return res;
}

async function localAsset(event) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(event.request);
  const network = fetch(event.request).then(async res => {
    if (res.ok) await cache.put(event.request, res.clone());
    return res;
  });
  event.waitUntil(network.catch(() => {}));
  return cached || network;
}

self.addEventListener("fetch", event => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (url.origin === self.location.origin) {
    if (request.mode === "navigate") event.respondWith(appShell(event));
    else if (!url.pathname.startsWith("/.well-known/")) event.respondWith(localAsset(event));
    return;
  }
  if (EXTERNAL_HOSTS.has(url.hostname)) event.respondWith(externalAsset(request));
});
