const CACHE='intl-flight-v1';
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(['./','./index.html']))));
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('fetch',e=>e.respondWith(fetch(e.request).catch(()=>caches.match(e.request))));
self.addEventListener('push',e=>{
  let d={}; try{d=e.data?.json()||{}}catch{d={body:e.data?.text()||''}}
  e.waitUntil(self.registration.showNotification(d.title||'알려줘',{
    body:d.body||'',
    icon:'/icon-180.png',
    badge:'/icon-180.png',
    data:{url:d.url||'/intl-flight/'}
  }));
});
self.addEventListener('notificationclick',e=>{
  e.notification.close();
  e.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(ws=>{
    for(const w of ws){ if('focus' in w) return w.focus(); }
    return clients.openWindow(e.notification.data?.url||'/intl-flight/');
  }));
});
