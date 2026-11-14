/* Service worker – Lavandería DONDE LICO
   - Permite usar la app sin internet.
   - Recibe archivos de pedidos compartidos desde WhatsApp (share target). */
const CACHE = "donde-lico-v1";
const CACHE_COMPARTIDOS = "dl-compartidos";
const BASE = self.registration.scope;
const ARCHIVOS = ["./", "index.html", "banner.jpg", "manifest.webmanifest", "icon-192.png", "icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE && k !== CACHE_COMPARTIDOS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);

  // Archivo compartido desde WhatsApp u otra app
  if (req.method === "POST" && url.pathname.endsWith("/share-target")) {
    e.respondWith((async () => {
      try {
        const fd = await req.formData();
        const textos = [];
        for (const f of fd.getAll("archivos")) {
          if (f && typeof f.text === "function") textos.push(await f.text());
        }
        const cache = await caches.open(CACHE_COMPARTIDOS);
        await cache.put(new URL("compartido-pendiente", BASE).href,
          new Response(JSON.stringify(textos), { headers: { "Content-Type": "application/json" } }));
      } catch (err) { /* se avisará en la app */ }
      return Response.redirect(new URL("./?compartido=1", BASE).href, 303);
    })());
    return;
  }

  if (req.method !== "GET") return;

  // Primero red (para recibir actualizaciones), si no hay internet usa lo guardado
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res && (res.ok || res.type === "opaque")) {
          const copia = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copia));
        }
        return res;
      })
      .catch(() => caches.match(req).then((r) => r || (req.mode === "navigate" ? caches.match("index.html") : undefined)))
  );
});
