# Oralia Agent & Contributor Rules

## Stack and boundaries

- Use React, strict TypeScript, Tailwind CSS, Vite, npm, and the committed lockfile. Preserve warm editorial themes, pill controls, curved cards, and accessible custom dropdowns.
- Keep provider SDKs, Prisma, Node built-ins, and secrets outside the `src` browser import graph. React calls the runtime-validated `src/lib/api.ts` client. Server domain modules live under `server`; provider adapters under `server/providers`.
- Nitro exposes `routes/api/v1/[...route].ts` through a Fetch-to-Node bridge to the shared HTTP `handleApi`. Preserve `/api/v1` paths, JSON/status semantics, cookies, bounded parsing, and exact origin checks. Vercel Workflow handles durable creation and publication in `workflows/story.ts`; isolated Foundry generation and archive/email recovery live in `workflows/foundry.ts`.
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
- Exact current pipeline: OpenAI transcription, Gemini `gemini-3.5-flash-lite` polishing/strict dynamic-scene extraction, OpenAI `tts-1-hd` PCM narration, and OpenAI images (initial model `gpt-image-2.5-sunburst`). Model access requires real verification; never substitute a different model without a recorded choice.
- Enforce five minutes / 20 MB for source recordings, 12,000 characters for typed and polished text, and dynamically planned scenes (1–64). Preserve source language, cultural names, meaning, permission, and attribution; do not invent endorsements or translations.

## Durable processing and publication

- Persist the creation job before dispatch. Use owner-scoped request idempotency and explicit job states: QUEUED, PROCESSING_MEDIA, COMPLETED, FAILED, INDETERMINATE. Persist each completed provider output and asset identity so retries reuse successful work.
- Retry only confirmed transient failures, with bounded backoff. An ambiguous paid request must become INDETERMINATE, not automatically repeat. A new version must be an explicit creator action.
- Source recordings, draft previews, and archives are authenticated Cloudinary assets. Only reviewed complete versions may publish. Generate public playback copies with immutable versioned IDs; never expose private source recordings in catalog responses.
- Derive scene starts/ends from measured 24 kHz mono 16-bit PCM samples. Keep Gemini's proposed times separately. Editing narration/order/prompts creates a new immutable version and requires regenerated media before publishing.
- Package exports only in Foundry from owned persisted projects or existing immutable legacy export requests. New archives use `oralia-foundry-assets-v1`; historical downloaded manifests remain unchanged. Include collection, source context, reference mapping, prompts, timing provenance and checksums. Track archive and notification states independently. Retrying email must not repeat image/audio generation or rebuild a ready archive.
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

## Dynamic generation update — 9 November 2026

Creation is asynchronous: QUEUED → SCRIPT_READY → PROCESSING_MEDIA → COMPLETED, with FAILED/INDETERMINATE error states. Gemini dynamically chooses visual beats at roughly 15–30 seconds of narration per scene, within a safety ceiling of 64 scenes. One-minute narratives target 3–4 scenes; five-minute narratives target 12–20 or more. Historical seeded stories keep their existing four scenes.

Workflow launches at most two narration steps, then two image steps per iteration. Each paid request has its own durable step and bounded retry; completed assets are reused and ambiguous paid outcomes require review. Narration WAV responses stream directly to authenticated Cloudinary upload streams. Image API Base64 JSON requires a bounded per-image decode before upload; no local media files are written. Final assembly measures actual PCM samples. Gemini boundaries remain estimates; GET /api/v1/creations/:id exposes measured boundaries and formatted MM:SS.mmm timestamps when complete.

CreationJob persists totalScenes, processedScenes and independent notificationStatus. The status response includes completionPercentage (up to 95% during media preparation; 100% only after final assembly). COMPLETED means a private draft is ready for review, never automatic publication. Completion email uses real Gmail SMTP; POST /api/v1/creations/:id/notify retries a failed email without regenerating media. Interrupted SENDING notifications require operator reconciliation.

OPENAI_API_KEY is server-only. Unset or blank OPENAI_STT_MODEL, OPENAI_TTS_MODEL and OPENAI_TTS_VOICE default to whisper-1, tts-1-hd and onyx. The existing configurable GPT image model remains selected; no automatic legacy DALL·E substitution occurs. Run db:migrate:turso for the reviewed dynamic-scene migration from the previous production schema, or db:migrate for local SQLite. Cloud verification compares logical column/index definitions, ignoring physical column ordinals after ALTER TABLE.

## Studio Foundry — isolated production workspace

Studio Foundry is a fourth, verified-creator mode. Creator Studio retains recording, generation, revision, review and Publish to Vellum; export controls and export-link handling live only in Foundry. Core generation/provider/publication modules, Prisma models and migrations are unchanged.

Foundry reuses generic CreationJob records with storyId prefixed foundry: and a studio_foundry_v1 input discriminator. StoryExport source identifiers use foundry:<jobId>; MediaAsset slots and private Cloudinary paths are Foundry-specific. Core creation list/detail/retry/revision routes reject these records before invoking core services. Foundry never creates Story, KeyframeScene or StoryVersion rows. Historical export sources are read-only; recovery never regenerates their media.

New projects accept 12,000-character scripts, 1–64 scenes, and up to four JPEG/PNG/WebP references of 3 MiB each, with required per-image instructions of at most 2,000 characters. Source wording is preserved. Gemini receives image bytes and matching notes, selects reference IDs, and supplies estimated continuous timing. OpenAI receives selected references through image edits, or uses text-to-image when none apply. Output is high-quality 1536×1024 PNG.

AI narration is on by default. Bypass AI TTS prevents all voice requests and omits narration from the archive; its timing guide is explicitly estimated for studio recording. With TTS, narration streams privately to Cloudinary and sample-measured boundaries replace estimates. Paid work runs in individual durable steps, at most two operations concurrently. Unknown paid completion is never blindly retried.

Foundry progresses QUEUED → SCRIPT_READY → PROCESSING_MEDIA → COMPLETED. COMPLETED requires a stored, verified archive. Notification status is independent; SMTP failure leaves downloads available and supports email-only retry. No placeholder media, fake email or runtime simulation is permitted.

All new endpoints are under /api/v1/foundry:
- POST /references; POST /references/:id/complete: signed private upload and metadata verification.
- POST /jobs; GET /jobs; GET /jobs/:id; POST /jobs/:id/retry: owner-scoped submissions, progress, previews and safe retries.
- GET /exports; GET /exports/:id; GET /exports/:id/download: owned current/legacy packages and fresh expiring download redirects.
- POST /exports/:id/retry; POST /exports/:id/notify: archive-only recovery or failed-email retry.

POST /api/v1/exports now returns authenticated 410 FOUNDRY_REQUIRED. Previously emailed legacy download URLs remain authorized and compatible. Old ?export= links and new ?foundryExport= / ?foundryJob= links open Foundry and retain that destination through real email sign-in.

The streamed ZIP uses oralia-foundry-assets-v1: generated PNGs unchanged, script, JSON/text timeline, selected-reference IDs/notes, provenance, optional WAV and media checksums. Text/WAV entries use DEFLATE; original reference files are excluded. ZIP download integrity is verified before readiness. Failed uploads retain generated assets for packaging-only recovery; errors distinguish configuration, capacity, source reads, upload, verification and email.

Cloudinary's current account raw-file allowance is checked before submission and enforced on the output stream. The implementation supports larger allowances without a code change; at least 256 MiB is recommended for larger jobs. Do not split packages, downsample generated art or change storage providers to bypass a quota. Isolated tests may mock capacity; real checks must stay below the actual account limit until it is raised. Never claim an earlier failed export has been repaired before successfully storing and downloading that archive.
