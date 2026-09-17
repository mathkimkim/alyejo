import { getStore } from '@netlify/blobs';

export default async () => {
  const publicKey = Netlify.env.get('VAPID_PUBLIC_KEY') || '';
  return Response.json({ vapidPublicKey: publicKey });
};

export const config = { path: '/api/config' };
