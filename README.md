# Oralia

> **Built for the Andela × OpenAI Codex Accelerator (Cape Town Cohort)**

## About the Project

Oralia is an audio-first visual carousel platform: **Instagram for African Oral Storytelling**. A single narration track drives timestamped illustrations and read-along captions, without rendering a video for each story.

African oral traditions deserve publishing tools that require less editing, rendering, and bandwidth. Oralia brings voice, imagery, and text together while retaining source attribution and cultural context.

## Workspaces

- **Vellum:** Public story discovery, creator profiles, literary collections, and an immersive Listening Room. No account is required to browse or listen.
- **Creator & Game Studio:** Verified creators submit recordings or text, review AI-polished narration and illustrations, publish completed stories, and publish to Vellum.
- **Studio Foundry:** Private script-to-asset production, per-image visual references and instructions, optional TTS bypass, and background ZIP/email delivery.
- **Education & Schooling:** Thematically curated reading and listening with independent regional filters. **Folk & Fable** emphasizes wit, folklore, and reflection; **Epic & Chronicle** emphasizes origin narratives, journeys, and consequence. These labels do not certify classroom suitability.

## Technical Approach

Real recordings pass through OpenAI transcription, then Gemini `gemini-3.5-flash-lite` returns a polished story and dynamically structured scenes. OpenAI `tts-1-hd` produces narration for each scene; OpenAI image generation illustrates the scene prompts. Final boundaries come from measured PCM samples, not estimated model timestamps.

Vercel Workflow runs durable processing stages. Cloudinary stores media bytes; Turso stores ownership, transcripts, versions, asset metadata, and job progress. Draft media and exports remain authenticated. Publication requires explicit creator review and promotes completed media for public playback.

The HTML audio element is the only playback clock. Ready images update on the next available paint; browsers cannot guarantee literal zero-latency synchronization. Missing media and credentials produce actionable errors, never substitute narration or artwork.

## Tech Stack

- **Web:** React, TypeScript, Tailwind CSS, Vite
- **Server:** TypeScript, Nitro, Vercel Node.js 24 functions, Vercel Workflow
- **Database:** Prisma 7, libSQL adapter, Turso; isolated SQLite for tests
- **Providers:** Gmail SMTP through Nodemailer, Gemini, OpenAI, Cloudinary
- **Contracts:** Shared Zod validation; HttpOnly cookie sessions

## Getting Started

Use Node.js 24 and npm. Copy `.env.example` to ignored `.env` and configure server credentials. Never put secrets in `VITE_` variables.

```bash
npm install
npm run db:generate
npm run dev
```

Development listens at `http://127.0.0.1:5173`; set `APP_ORIGIN` to that exact origin. Turso is selected when cloud credentials are present. For a separate local database, explicitly set `DATABASE_URL=file:./prisma/oralia.db`, then run `npm run db:migrate` and `npm run db:seed`. Never point test writes at Turso.

## Environment

| Variable | Purpose |
|---|---|
| `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` | Hosted database; both required on Vercel |
| `APP_ORIGIN` | Exact public origin; HTTPS on Vercel |
| `AUTH_SECRET` | Stable cryptographically random secret of at least 32 characters for code hashes |
| `SMTP_HOST`, `SMTP_PORT` | Gmail SMTP: `smtp.gmail.com`, `587`, required STARTTLS |
| `SMTP_USER`, `SMTP_PASSWORD` | Sender account and Gmail app password; sender display name is Oralia |
| `GEMINI_API_KEY` | Access to the exact `gemini-3.5-flash-lite` model |
| `OPENAI_API_KEY` | Real transcription, narration, and image generation |
| `OPENAI_IMAGE_MODEL` | Initially `gpt-image-2.5-sunburst`; account access must be verified |
| `OPENAI_STT_MODEL`, `OPENAI_TTS_VOICE` | Defaults `whisper-1` and `onyx`; synthesis uses `tts-1-hd` |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Signed source uploads, private drafts, published media, and ZIP delivery |

Missing provider configuration disables the affected operation with an explicit server error. Public editorial browsing remains independent of AI keys. The sourced eight-story catalog remains published legacy content; its photographs are not represented as newly generated artwork.

## Authentication and Creation

Email codes expire after ten minutes, permit five attempts, and have a sixty-second resend cooldown plus persistent email/IP rate limits. Only hashed codes and session credentials are stored. Sessions use HttpOnly, SameSite cookies and Secure cookies in production. No arbitrary PINs or browser bearer credentials are accepted.

Creators may submit audio up to **five minutes / 20 MB**, or text up to **12,000 characters**, with source context and permission. Every generated story has **dynamically planned scenes (1–64)**. The Studio shows persisted progress, private previews, failures, safe retries, new immutable versions, and explicit publication review. Unconfirmed paid-provider results require review rather than automatic regeneration.

Studio Foundry generates private asset packages from persisted projects. The ZIP includes generated images, the script, timeline guides, optional narration, reference instructions and checksums using `oralia-foundry-assets-v2`. Earlier immutable version exports remain available for authorized download and recovery through Foundry. Email links require the owning account before minting a short-lived media download. Email failures do not rebuild completed archives. SMTP is at-least-once delivery; an interrupted send may require operator investigation.

## Database and Vercel Deployment

For a new empty Turso database use `npm run db:deploy:turso`, then `npm run db:seed`. For an existing thematic-schema database use **`npm run db:migrate:turso`** instead: it checks the baseline, saves an ignored backup, preserves accounts/content/bookmarks, revokes old simulated credentials, and records the applied checksum. It refuses incompatible schemas and never resets data. `npm run db:verify:turso` is read-only.

Connect the Git repository to Vercel, select Node.js 24, and use `npm run build`. Nitro emits the Vercel Build Output in `.vercel/output`, including API and Workflow functions. Keep API, static assets, and `/.well-known/workflow/*` routes reachable; do not add a catch-all rewrite over them. Vercel Workflow must be enabled for the project. Configure all production environment variables, with `APP_ORIGIN=https://oralia.vercel.app`, and redeploy after environment changes. Never set a local `DATABASE_URL` or `WORKFLOW_TARGET_WORLD=local` in Vercel.

Schema deployment and seeding are explicit operations, never installation, build, or request side effects. Builds do not contact Turso. A successful build does not verify SMTP inbox delivery, paid-model access, Workflow service availability, or live end-to-end generation.

## Verification

```bash
npx prisma validate
npm test
npm run build
npm run db:verify:turso
```

Tests migrate temporary SQLite databases and mock providers only inside isolated test processes. Production code has no generated-content fallback. Run actual provider integration separately with configured keys; do not infer real generation success from fixtures. See [ARCHITECTURE.md](ARCHITECTURE.md), [RESEARCH.md](RESEARCH.md), and [AGENTS.md](AGENTS.md) for maintained contracts and contributor rules.

## Dynamic generation update — 9 November 2026

Creation is asynchronous: QUEUED → SCRIPT_READY → PROCESSING_MEDIA → COMPLETED, with FAILED/INDETERMINATE error states. Gemini dynamically chooses visual beats at roughly 15–30 seconds of narration per scene, within a safety ceiling of 64 scenes. One-minute narratives target 3–4 scenes; five-minute narratives target 12–20 or more. Historical seeded stories keep their existing four scenes.

Workflow launches at most two narration steps, then two image steps per iteration. Each paid request has its own durable step and bounded retry; completed assets are reused and ambiguous paid outcomes require review. Narration WAV responses stream directly to authenticated Cloudinary upload streams. Image API Base64 JSON requires a bounded per-image decode before upload; no local media files are written. Final assembly measures actual PCM samples. Gemini boundaries remain estimates; GET /api/v1/creations/:id exposes measured boundaries and formatted MM:SS.mmm timestamps when complete.

CreationJob persists totalScenes, processedScenes and independent notificationStatus. The status response includes completionPercentage (up to 95% during media preparation; 100% only after final assembly). COMPLETED means a private draft is ready for review, never automatic publication. Completion email uses real Gmail SMTP; POST /api/v1/creations/:id/notify retries a failed email without regenerating media. Interrupted SENDING notifications require operator reconciliation.

OPENAI_API_KEY is server-only. Unset or blank OPENAI_STT_MODEL, OPENAI_TTS_MODEL and OPENAI_TTS_VOICE default to whisper-1, tts-1-hd and onyx. The existing configurable GPT image model remains selected; no automatic legacy DALL·E substitution occurs. Run db:migrate:turso for the reviewed dynamic-scene migration from the previous production schema, or db:migrate for local SQLite. Cloud verification compares logical column/index definitions, ignoring physical column ordinals after ALTER TABLE.

The Gemini provider returns the complete polished narrative as ordered scene narrations. The server assembles polishedText exactly from those narrations, avoiding divergent duplicate story text. The original transcript remains separately preserved.

## Studio Foundry — isolated production workspace

Studio Foundry is a fourth, verified-creator mode. Creator Studio retains recording, generation, revision, review and Publish to Vellum; export controls and export-link handling live only in Foundry. Foundry remains isolated from Vellum publishing. Localized-title publication and the additive export-part/language-index migration are approved changes to the earlier frozen-core guardrail.

Foundry reuses generic CreationJob records with storyId prefixed foundry: and a studio_foundry_v1 input discriminator. StoryExport source identifiers use foundry:<jobId>; MediaAsset slots and private Cloudinary paths are Foundry-specific. Core creation list/detail/retry/revision routes reject these records before invoking core services. Foundry never creates Story, KeyframeScene or StoryVersion rows. Historical export sources are read-only; recovery never regenerates their media.

New projects accept 12,000-character scripts, 1–64 scenes, and up to four JPEG/PNG/WebP references of 3 MiB each, with required per-image instructions of at most 2,000 characters. Original submissions are preserved separately; processed narration and titles are faithfully localized into the selected target language. Gemini receives image bytes and matching notes, selects reference IDs, and supplies estimated continuous timing. OpenAI receives selected references through image edits, or uses text-to-image when none apply. Output is high-quality 1536×1024 PNG.

AI narration is on by default. Bypass AI TTS prevents all voice requests and omits narration from the archive; its timing guide is explicitly estimated for studio recording. With TTS, narration streams privately to Cloudinary and sample-measured boundaries replace estimates. Paid work runs in individual durable steps, at most two operations concurrently. Unknown paid completion is never blindly retried.

Foundry progresses QUEUED → SCRIPT_READY → PROCESSING_MEDIA → COMPLETED. COMPLETED requires a stored, verified archive. Notification status is independent; SMTP failure leaves downloads available and supports email-only retry. No placeholder media, fake email or runtime simulation is permitted.

All new endpoints are under /api/v1/foundry:
- POST /references; POST /references/:id/complete: signed private upload and metadata verification.
- POST /jobs; GET /jobs; GET /jobs/:id; POST /jobs/:id/retry: owner-scoped submissions, progress, previews and safe retries.
- GET /exports; GET /exports/:id; GET /exports/:id/download: owned current/legacy packages and fresh expiring download redirects.
- POST /exports/:id/retry; POST /exports/:id/notify: archive-only recovery or failed-email retry.

POST /api/v1/exports now returns authenticated 410 FOUNDRY_REQUIRED. Previously emailed legacy download URLs remain authorized and compatible. Old ?export= links and new ?foundryExport= / ?foundryJob= links open Foundry and retain that destination through real email sign-in.

Each bounded ZIP part uses oralia-foundry-assets-v2: generated PNGs unchanged, script, JSON/text timeline, selected-reference IDs/notes, provenance, optional WAV and media checksums. Text/WAV entries use DEFLATE; original reference files are excluded. ZIP download integrity is verified before readiness. Failed uploads retain generated assets for packaging-only recovery; errors distinguish configuration, capacity, source reads, upload, verification and email.

Cloudinary capacity is checked against the actual account allowance. New ZIPs are capped at 9 MiB each and automatically split into independently extractable parts; oversized original files use numbered byte chunks with whole-file/chunk SHA-256 checksums and reconstruction instructions. Do not downsample media. Completed parts are retained for retry; notification retry never repackages assets. Historical downloaded single ZIPs remain unchanged.

## Localized creation and multipart packages

Both creation workspaces use the shared target narration languages: en, zu, xh, sw, yo, ha, af, fr and pt (default en). Blank titles are allowed. New Gemini responses must contain polishedTitle, matching target-language metadata and complete ordered scene narration. Preserve meaningful titles through localization and replace weak/blank titles from narrative context. Assemble final story text from scenes; never truncate oversized translation or fabricate provider output. Original inputs/transcripts remain immutable. Historical plans without new fields use their input title/language. Revisions retain title/language metadata; publication stores the refined title. All audio boundaries remain sample-measured, or explicitly estimated when Foundry bypasses TTS.

isiZulu, isiXhosa, Yoruba and Hausa voice quality is unverified under the configured OpenAI TTS provider. Keep them selectable with a review notice. Do not switch models automatically. Current Speech API models have a documented January 6, 2027 shutdown; track their separate migration. See [OpenAI TTS documentation](https://developers.openai.com/api/docs/guides/text-to-speech).

Vellum's language filter combines with collection/search. GET /api/v1/catalog accepts optional language (nine codes only; omit for all, invalid values return 400), filters Story.language in Prisma, and retains its existing response shape/order without pagination. App retains a separate full catalog for direct story/profile links, while cancellable keyed discovery requests prevent stale results.

Migration 20261109120000_localized_multipart adds Story language/publication indexes and ExportPart rows linked to StoryExport. It preserves existing records and single-file exports. Run db:migrate for local SQLite or db:migrate:turso for checksummed cloud deployment with an ignored backup. Never reset or reseed merely to apply it.

Foundry export responses include parts[] with partNumber, filename, bytes, checksum, status and authorized downloadUrl. GET /api/v1/foundry/exports/:id/parts/:partNumber/download verifies the owner and parent readiness before redirecting. The original download route still serves single ZIPs; multipart exports return 409 MULTIPART_REQUIRED with the part list. Individual durable steps build, upload and verify each ZIP; READY/COMPLETED requires every part. Secure notification links list all parts; no binary email attachments. Legacy failed exports repackage only their immutable media, without generation or publication changes.
