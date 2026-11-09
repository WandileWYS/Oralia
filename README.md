# Oralia

> **Built for the Andela × OpenAI Codex Accelerator (Cape Town Cohort)**

## About the Project

Oralia is an audio-first visual carousel platform: **Instagram for African Oral Storytelling**. A single narration track drives timestamped illustrations and read-along captions, without rendering a video for each story.

African oral traditions deserve publishing tools that require less editing, rendering, and bandwidth. Oralia brings voice, imagery, and text together while retaining source attribution and cultural context.

## Three Modes

- **Vellum:** Public story discovery, creator profiles, literary collections, and an immersive Listening Room. No account is required to browse or listen.
- **Creator & Game Studio:** Verified creators submit recordings or text, review AI-polished narration and illustrations, publish completed stories, and request server-generated asset packages by email.
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

Exports are generated from immutable database versions. The ZIP includes narration, all scene images, source transcript, polished text, and the `oralia-storyboard-v4` manifest with checksums. Email links require the owning account before minting a short-lived media download. Email failures do not rebuild completed archives. SMTP is at-least-once delivery; an interrupted send may require operator investigation.

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
