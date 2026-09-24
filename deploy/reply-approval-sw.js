self.addEventListener('push',event=>{
  let data={};
  try{data=event.data?.json()||{}}catch{}
  event.waitUntil(self.registration.showNotification(data.title||'답글 승인 대기',{
    body:data.body||'새 항공권 답글을 확인해주세요.',
    icon:'/favicon.ico',tag:data.tag||'reply-approval',
    data:{url:'/api/threads-reply-approval'}
  }));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(async windows=>{
    const url=new URL('/api/threads-reply-approval',self.location.origin).href;
    const existing=windows.find(w=>w.url.startsWith(url));
    if(existing)return existing.focus();
    return clients.openWindow(url);
  }));
});
