const CACHE='alryeok-pwa-v8';
const ASSETS=['./index.html','./manifest.webmanifest','./icon-180.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>e.respondWith(fetch(e.request).then(r=>{const c=r.clone();caches.open(CACHE).then(cache=>cache.put(e.request,c));return r}).catch(()=>caches.match(e.request))));
self.addEventListener('push',e=>{let d={title:'알려줘',body:'이동 경로를 확인하세요.'};try{d=JSON.parse(e.data?.text()||'{}')}catch{}e.waitUntil(self.registration.showNotification(d.title||'알려줘',{body:d.body||'',icon:'./icon-180.png',badge:'./icon-180.png'}));});
