# Jisu Threads publisher

Dedicated to `@jisu__jisu65`. Keep this directory isolated from other applications. Netlify base directory: `jisu-social`, publish directory: `public`, build command: `npm run build`.

Set secret Functions-scoped production variables `THREADS_JISU_ACCESS_TOKEN` and `JISU_PUBLISH_ADMIN_KEY`. All control APIs require `Authorization: Bearer <admin key>`. Tokens never reach HTML, logs, or repository files. `.netlify` and `.env*` are ignored.

Authenticated GET `/api/connection` checks exact account and `threads_basic` / `threads_content_publish` permissions. GET `/api/posts` returns drafts, schedules and results. POST `/api/publish` accepts one fixed post `id`. POST `/api/schedule` accepts `{id, at, enabled}`, with an ISO timestamp including timezone. Cron checks every five minutes only when `JISU_SCHEDULE_ENABLED=true`; it starts disabled. Set schedules before enabling it and redeploy after env changes.

Atomic create-only blob claims prevent concurrent/repeated publishing. A failed or uncertain run is not automatically retried, including network failures during publishing: inspect the actual Threads account and result record before making a new version. At most one post is dispatched per cron invocation. Production data and preview data use separate store names. Runtime response headers are set in functions; TOML headers apply only to static files.

The access token remains in Netlify secret env vars; expiration or revocation requires renewal there and a redeploy. No automatic token renewal is configured.

Run `npm test`. Publishing tests mock Meta and storage; they do not contact or publish to real accounts.
