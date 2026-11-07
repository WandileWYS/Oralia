# Oralia Agent & Contributor Rules

## Stack and boundaries

- Use React, strict TypeScript, Tailwind CSS, Vite, npm, and the committed lockfile. Preserve warm editorial themes, pill controls, curved cards, and accessible custom dropdowns.
- Keep provider SDKs, Prisma, Node built-ins, and secrets outside the `src` browser import graph. React calls the runtime-validated `src/lib/api.ts` client. Server domain modules live under `server`; provider adapters under `server/providers`.
- Nitro exposes `routes/api/v1/[...route].ts` through a Fetch-to-Node bridge to the shared HTTP `handleApi`. Preserve `/api/v1` paths, JSON/status semantics, cookies, bounded parsing, and exact origin checks. Vercel Workflow handles durable creation, publication, and export steps from `workflows/story.ts`.
- Use shared Zod contracts with `unknown` at untrusted boundaries. Do not replace provider failures with fabricated successful responses. Isolated test fixtures and provider mocks must never enter runtime fallback paths.

## Data and state ownership

- Turso/Prisma is authoritative for stories, authors, scenes, account bookmarks, verification, sessions, jobs, versions, asset references, and exports. Cloudinary holds media bytes; never store large blobs or Base64 content in Turso or Workflow state.
- `useDatabaseCatalog` owns catalog loading/retry. App owns the browsing collection, mode, theme, and sign-in visibility; `usePublicView` owns URL-based listening/profile navigation. Keep the full catalog for direct links independently of browsing filters.
- Use `StoryCollection` values `FOLK_AND_FABLE` and `EPIC_AND_CHRONICLE`. UI-only `CollectionFilter` also permits `ALL`; never persist it on stories or manifests. Keep `RegionTag`/`RegionFilter` separate from literary collections.
- `usePersistentSession` restores identity from `/auth/session`; its historical name does not imply local credential persistence. Session cookies are HttpOnly; session props drive Navbar identity. Remove legacy browser bearer state rather than trusting it.
- Guest bookmarks remain device-local. Signed-in bookmarks use owner-authorized database routes. Preserve avatar initials fallback and catalog loading/retry before declaring profile links unavailable.

## Authentication and providers

- Email codes are cryptographically random six digits, HMAC-hashed with `AUTH_SECRET`, ten-minute expiry, at most five attempts, and single-use consumption. Preserve sixty-second resend cooldown and persistent email/IP limits. Failed attempts must commit counters; SMTP failure must invalidate its challenge and issue no session.
- Use Nodemailer with required STARTTLS on Gmail port 587 and certificate validation. Display sender name Oralia. Never accept an arbitrary PIN, fabricate delivery, introduce fake tokens, or store bearer credentials in localStorage.
- Opaque database sessions require verified email and expire after seven days. Cookies are HttpOnly, SameSite=Lax, Secure in production; preserve mutation origin protection. Verify persisted ownership for uploads, generation, editing, publishing, exports, and downloads.
- Exact current pipeline: OpenAI transcription, Gemini `gemini-3.5-flash-lite` polishing/strict four-scene extraction, OpenAI `tts-1-hd` PCM narration, and OpenAI images (initial model `gpt-image-2.5-sunburst`). Model access requires real verification; never substitute a different model without a recorded choice.
- Enforce five minutes / 20 MB for source recordings, 5,000 characters for typed and polished text, and four scenes. Preserve source language, cultural names, meaning, permission, and attribution; do not invent endorsements or translations.

## Durable processing and publication

- Persist the creation job before dispatch. Use owner-scoped request idempotency and explicit job states: QUEUED, RUNNING, REVIEW_READY, FAILED, INDETERMINATE. Persist each completed provider output and asset identity so retries reuse successful work.
- Retry only confirmed transient failures, with bounded backoff. An ambiguous paid request must become INDETERMINATE, not automatically repeat. A new version must be an explicit creator action.
- Source recordings, draft previews, and archives are authenticated Cloudinary assets. Only reviewed complete versions may publish. Generate public playback copies with immutable versioned IDs; never expose private source recordings in catalog responses.
- Derive scene starts/ends from measured 24 kHz mono 16-bit PCM samples. Keep Gemini's proposed times separately. Editing narration/order/prompts creates a new immutable version and requires regenerated media before publishing.
- Package exports on the server from owned persisted versions. Manifest is `oralia-storyboard-v4`, with collection, source context, prompts, measured boundaries, and checksums. Track archive and notification states independently. Retrying email must not repeat image/audio generation or rebuild a ready archive.
- SMTP does not offer exactly-once delivery. Preserve notification claims; investigate interrupted SENDING records before retrying an uncertain send. Do not promise delivery based solely on SMTP acceptance.

## Playback, accessibility, and storage

- One HTML audio element is the clock. Sample `currentTime` with one paint-aligned loop for scene changes and media events for seek/pause/metadata. Do not accumulate a competing timer or render React state on every animation frame.
- Use sorted half-open `[startTime,endTime)` intervals. Handle exact-boundary seeks, buffering, playback-rate changes, visibility return, and unmount cleanup. Ready images swap on the next available paint, without a hard real-time guarantee.
- Preload/decode upcoming images; retain the prior image on load failure without blocking narration. Missing audio shows retry/transcript options; never synthesize a timing tone or substitute unrelated narration/artwork.
- Real microphone visualization must use sampled input. Detect MediaRecorder MIME support, enforce recording limits, stop streams, revoke blob URLs, and close AudioContexts. Use `AudioDraftPlayer` for themed playback; no native unstyled audio bars.
- Keep semantic keyboard controls, caption/transcript alternatives, focus restoration, reduced motion, descriptive alt text, and truthful AI/photo attribution. Do not fabricate dialect overlays.
- Offline downloads are not implemented. Do not imply bookmarks download media. Future media caching must be explicit, quota-bounded, range-aware, versioned, and isolated from private authenticated responses.

## Database, deployment, and verification

- Preserve lazy cached Prisma initialization and existing libSQL adapter compatibility. Hosted runtime requires both Turso credentials, ignores legacy `DATABASE_URL`, and never falls back to local SQLite. Explicit file URLs apply only outside Vercel for isolated development/tests.
- Never log raw errors, SQL, secrets, or connection strings. Diagnostics may name missing variables and allowlisted provider categories/codes. Public failures remain sanitized JSON. Builds must remain credential- and connection-independent.
- Keep migration history immutable. The production migration revokes simulated challenges/sessions while preserving accounts, bookmarks, catalog, and scenes. Use reviewed checksummed cloud migration with ignored backups; never reset or blanket-accept data loss.
- Generate Prisma/media manifest before tests/build. Nitro packages Node.js 24 API and Workflow functions; preserve static narration, API dispatch, and Workflow internal routes. Local dev uses the Node preset at port 5173, not hosted Vercel emulation.
- `.env`, databases, generated clients/output, dependencies, and `.qa` artifacts remain ignored. `.env.example` contains names/defaults only. Configure production secrets in Vercel and redeploy; never ship credentials through `VITE_`.
- Run `npm test` then `npm run build` sequentially for backend/domain changes. Tests must explicitly select temporary SQLite. Verify OTP expiry/replay/rates, ownership, schema preservation, sample timing, interrupted providers, notification retries, and missing config without production substitutions.
- Inspect browser flows in both themes at mobile/tablet/desktop widths. Report actual PASS/FAIL/INCOMPLETE evidence. Real provider generation, inbox receipt, account ZIP settings, and hosted Workflow availability require separate integration checks; a fixture test/build/Git push is not proof.
