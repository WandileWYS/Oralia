# Oralia Agent & Contributor Rules

Current implementation is documented in [ARCHITECTURE.md](ARCHITECTURE.md); setup is in [README.md](README.md); evidence and proposed work are in [RESEARCH.md](RESEARCH.md). Keep the documents synchronized with code, not with unverified deployment assumptions.

## Research, Plan, Implementation

1. **Research:** inspect repository instructions, package/configuration, contracts, route handlers, migrations, and applicable primary provider documentation. Distinguish shipped behavior, historical test evidence, and proposals; resolve factual contradictions before changing code.
2. **Plan:** define behavior, ownership/interfaces, compatibility, failure/retry semantics, required data changes, acceptance checks, and explicit scope. Preserve the user's architectural choices and authorization boundaries.
3. **Implementation:** complete the authorized change, validate relevant contracts and behavior, and report fresh PASS/FAIL/INCOMPLETE evidence with limitations. Commits, pushes, and deployment require task authorization; builds/tests do not establish live provider success.

## Stack and boundaries

- Use React, strict TypeScript, Tailwind CSS, Vite, Nitro, Node.js 24, Vercel Workflow, npm, and the committed lockfile. Preserve the editorial palette, CSS tokens, pill geometry, and accessible custom dropdowns.
- Keep Prisma, provider SDKs, secrets, and Node built-ins out of browser imports. React uses validated API clients; server domain/provider modules own external operations. Accept `unknown` at untrusted boundaries and validate with shared Zod contracts.
- Preserve the Fetch-to-Node `/api/v1` adapter, status/JSON/cookie/origin semantics, static media, and Workflow internal routes. Do not restore obsolete catch-all rewrites or silently replace configured provider models.
- No fake runtime authentication, placeholder generated content, synthetic timing tones, or successful fallback jobs. Isolated test fixtures/provider mocks are permitted only within tests.

## Data and state ownership

- Turso/Prisma owns identity, bookmarks, jobs, versions, transcripts, and media/export metadata. Cloudinary owns media bytes. Do not persist media binaries/Base64 in database or workflow state.
- One shared Prisma schema is implemented. Enforce verified ownership for every private upload, job, revision, publication, export, part download, and recovery path. Namespaces and signed URLs do not themselves provide tenant authorization.
- Use `FOLK_AND_FABLE` / `EPIC_AND_CHRONICLE`; `ALL` is browsing-only. Keep region/tradition and narration language separate. Do not infer educational suitability from a collection.
- App owns workspace, collection, Vellum language filter, theme, and sign-in visibility. Preserve full-catalog direct links independently of keyed/cancellable discovery requests and URL/history state.
- Restore identity from HttpOnly cookie sessions; do not store bearer credentials in browser storage. Guest bookmarks store references, not offline media. Preserve avatar fallback and loading/retry before declaring a profile unavailable.

## Authentication and providers

- Preserve random six-digit email codes, keyed hashes, ten-minute expiry, five verification attempts, sixty-second resend cooldown, and persistent email/IP limits. Failed attempts must commit counters; SMTP failure must not issue a session.
- Gmail SMTP uses Nodemailer with required STARTTLS and certificate validation. Preserve seven-day database-backed sessions, HttpOnly/SameSite cookies, Secure cookies in production, and mutation origin checks.
- New Gemini output requires `polishedTitle`, matching target language, and complete ordered scenes. Assemble final text from narration segments; reject invalid/oversized output instead of truncating or fabricating content. Preserve original inputs, names, meaning, attribution, and permission context.
- Target choices are `en`, `zu`, `xh`, `sw`, `yo`, `ha`, `af`, `fr`, `pt` (default UI `en`). Keep the unverified TTS-quality notice for `zu`, `xh`, `yo`, and `ha`; never certify native quality from a successful request or invent dialect translations.
- Preserve current defaults and overrides documented in README. Account access, model lifecycle, linguistic quality, and provider compatibility require explicit verification; do not silently switch models.

## Durable processing and publication

- Persist jobs before dispatch with owner-scoped idempotency. Preserve `QUEUED → SCRIPT_READY → PROCESSING_MEDIA → COMPLETED`, plus FAILED/INDETERMINATE outcomes and persisted progress/assets.
- Enforce current limits: recordings five minutes/20 MiB, text 12,000 characters, 1–64 scenes, two active jobs and ten submissions per user per rolling 24 hours across both workspaces. Per-workflow concurrency is at most two paid media operations; do not call it a global budget or token limit.
- Retry confirmed transient failures within bounded attempts. Reuse completed assets; reconcile ambiguous paid/dispatch outcomes rather than blindly repeating them. Keep immutable versions and require creator review before publishing.
- Creator Studio owns generation, revision, review, and Publish to Vellum. Foundry owns private reference-conditioned generation and packaging; preserve its `foundry:` identifiers and separate contracts/handlers. Foundry must not create public Story/KeyframeScene/StoryVersion records or enter core generation routes.
- Foundry defaults to TTS; bypass makes no narration calls and labels timing estimated. Generated audio uses measured sample boundaries. References are owned/verified JPEG/PNG/WebP: four maximum, 3 MiB/25 MP each, with individual instructions up to 2,000 characters.
- Keep archive parts at most 9 MiB and below actual raw-file allowance. Preserve PNG/WAV bytes, lossless compression, ordered oversized-file chunks, reconstruction instructions, and SHA-256 checksums under `oralia-foundry-assets-v2`. Never omit/downsample assets to disguise quota errors.
- Persist and verify every ExportPart before parent completion. Archive retry reuses completed parts/media; legacy recovery reads immutable snapshots. Email retry never regenerates/repackages ready content. SMTP acceptance is not inbox proof; investigate stranded SENDING state before an uncertain resend.

## Playback, accessibility, and phone styling

- One HTML audio element is the story clock. Derive frames from sorted half-open intervals and currentTime using the existing paint loop/media events; never accumulate an independent timer or force React renders every paint.
- Use measured 24 kHz mono 16-bit PCM boundaries for generated narration. Model timestamps remain estimates. Preserve seek/end/buffering/background behavior, prepared-image swapping, retry/transcript access, and truthful photo/AI attribution.
- Detect recorder MIME support; visualize real sampled input; stop streams, close AudioContexts, and revoke object URLs. Preserve themed transport controls, keyboard operation, reduced motion, focus restoration, and modal scroll locking.
- Keep the phone overhaul exclusively inside `@media (max-width: 480px)`. Preserve larger layouts and all shared color variables. Verify full-screen dialog bounds, safe-area padding, popover access, 44px touch targets where applicable, 16px form text, wrapping content, and no horizontal overflow. Fix intrinsic overflow before relying on clipping.
- No service-worker downloads or local-first draft synchronization are implemented. Any future caching must be opt-in, bounded, range-aware, versioned, and account-isolated; never promise offline AI generation or automatic publication.

## Database, deployment, and verification

- Preserve lazy cached Prisma initialization and installed adapter compatibility. Vercel requires both Turso credentials and ignores legacy DATABASE_URL; local SQLite must be explicit outside hosting. Do not fall back to a local database in production.
- Keep historical migrations immutable. Use reviewed additive upgrades, ignored backups, checksum/schema validation, and refusal of unexpected schemas. Do not reset/reseed user data merely to pass a check. The current cloud upgrade script targets a specific baseline, not every historical schema.
- Generate Prisma/media manifests before applicable tests/builds. Keep builds independent of database credentials/connectivity; database deployment and seeding remain explicit operations outside installation/build/request handlers.
- `.env`, local databases, generated output, dependencies, and `.qa` remain ignored. Environment examples contain names/defaults only; never use `VITE_` for secrets. Never log credentials, raw provider errors, SQL, private payloads, or connection strings; use sanitized categories/correlation data.
- For backend/domain changes run `npm test`, then `npm run build` sequentially, with explicit temporary SQLite for tests. Exercise ownership, OTP/cookies, historical contracts, timing, provider failures, interrupted parts, reconstruction checksums, and independent email retries.
- For phone CSS, compare 320–480px in both themes and guest/signed-in states, plus unchanged baselines at 481px/tablet/desktop widths. Distinguish browser emulation from real-device keyboard/safe-area checks.
- Validate documentation links, commands, JSON examples, route/type names, and scope. Report what was actually checked; do not reuse historical passes as fresh evidence or hide unresolved CLI/provider/hosted verification failures. Paid calls, email dispatch, publication, migrations, commits, pushes, and deployment must stay within the task's authorization.
