# Oralia

> **Built for the Andela × OpenAI Codex Accelerator (Cape Town Cohort)**

## About the Project

Oralia is an audio-first visual carousel platform: **Instagram for African Oral Storytelling**. Spoken narration drives timestamped illustrations and read-along captions without a video-rendering pipeline. Original submissions, source attribution, and cultural context remain part of the production record.

This documentation describes the checked repository, reviewed **11 November 2026**. Implementation, hosted availability, and independently verified provider quality are different claims.

## Workspaces

| Workspace | Implemented behavior |
|---|---|
| Vellum | Public discovery by collection/language, creator profiles, bookmarks, and the Listening Room; browsing/listening requires no account. |
| Creator Studio | Verified creators record/upload audio or submit text, review localized narration and illustrations, create revisions, and explicitly **Publish to Vellum**. |
| Studio Foundry | Private script/reference-image production, per-image instructions, optional TTS bypass, background asset packaging, authenticated ZIP downloads, and email notifications; no publication action. |
| Education & Schooling | Thematic discovery with independent regional filters. Collections are literary classifications, not certifications of classroom suitability. |

**Folk & Fable** (`FOLK_AND_FABLE`) emphasizes folklore, animal tales, wit, and reflection. **Epic & Chronicle** (`EPIC_AND_CHRONICLE`) emphasizes origin narratives, memory, journeys, and consequence.

Target narration/translation choices are **English (`en`), isiZulu (`zu`), isiXhosa (`xh`), Swahili (`sw`), Yoruba (`yo`), Hausa (`ha`), Afrikaans (`af`), French (`fr`), and Portuguese (`pt`)**; default `en`. isiZulu, isiXhosa, Yoruba, and Hausa carry an unverified TTS-quality notice. A selectable language is not proof of native pronunciation or translation fidelity.

## Technical Approach

OpenAI transcribes uploaded audio. Gemini returns `polishedTitle`, matching target-language metadata, ordered narration segments, and visual prompts. Blank/weak titles are generated from the narrative; meaningful titles are localized. Original inputs remain preserved. OpenAI generates scene narration/images; final playback boundaries use measured audio samples rather than Gemini's estimates.

Durable jobs report progress and retain completed assets. Creator Studio completion means a private version is ready for review; Foundry completion requires verified archive parts. Email failure does not invalidate ready downloads. Missing configuration, rejected output, and ambiguous provider outcomes never become fabricated success.

A single HTML audio element is the playback clock. Image changes are paint-aligned, not hard real-time. Phone layouts are scoped to `@media (max-width: 480px)`, including a full-screen Listening Room; larger layouts retain their existing rules.

## Tech Stack

| Layer | Current implementation |
|---|---|
| Web | React, TypeScript, Tailwind CSS, Vite |
| Server/execution | Nitro, Vercel Node.js 24 functions, Vercel Workflow |
| Persistence | Prisma 7, libSQL adapter, Turso; explicit local SQLite for isolated work |
| AI | OpenAI transcription/narration/images; Google Gemini structured planning/localization |
| Media/delivery | Cloudinary images, audio, private ZIP assets; Gmail SMTP through Nodemailer |
| Contracts/auth | Shared Zod validation; verified email and HttpOnly cookie sessions |

## Getting Started

Use Node.js 24 and npm. Copy [.env.example](.env.example) to ignored `.env` and configure the server variables below. The configured database must already have the expected schema; development does not deploy or seed it automatically.

```bash
npm ci
npm run db:generate
npm run dev
```

Development listens at `http://127.0.0.1:5173`; set `APP_ORIGIN` to that exact origin. For local SQLite, explicitly set `DATABASE_URL` to a `file:` URL; prefer an absolute path to avoid CLI/runtime relative-path differences. Cloud configuration and database operations are detailed in [ARCHITECTURE.md](ARCHITECTURE.md#database-and-safe-cutover).

## Environment

All credentials are server-only; never expose them through `VITE_` variables.

| Variables | Purpose/default |
|---|---|
| `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` | Both required for hosted Turso; Vercel ignores a legacy `DATABASE_URL`. |
| `APP_ORIGIN`, `AUTH_SECRET` | Exact application origin; stable cryptographically random authentication secret of at least 32 characters. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` | Gmail `smtp.gmail.com:587`, required STARTTLS, sender account/app password; display name Oralia. |
| `GEMINI_API_KEY` | Access to the configured `gemini-3.5-flash-lite` model. |
| `OPENAI_API_KEY`, `OPENAI_IMAGE_MODEL` | Real AI operations; configured image default `gpt-image-2.5-sunburst`. |
| `OPENAI_STT_MODEL`, `OPENAI_TTS_MODEL`, `OPENAI_TTS_VOICE` | Defaults `whisper-1`, `tts-1-hd`, `onyx`. |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Signed uploads, media delivery, and authenticated archives. |

These model names describe code defaults, not guaranteed access for every provider account. Missing credentials fail the affected operation explicitly. Public catalog browsing does not require AI keys. Provider lifecycle and quality risks are tracked in [RESEARCH.md](RESEARCH.md#operational-gaps-and-verification-gates).

## Authentication and Creation

Email codes expire after ten minutes, permit five attempts, and have a sixty-second resend cooldown with persistent email/IP limits. Sessions use opaque credentials in HttpOnly/SameSite cookies, Secure in production. No arbitrary-PIN acceptance or browser bearer credentials are used.

Creation accepts recordings up to five minutes / 20 MiB or text up to 12,000 characters, with source/permission context. Plans contain 1–64 scenes. Existing admission limits are two active jobs and ten submissions per user per rolling 24 hours, shared across the creation workspaces. At most two paid media operations run concurrently within each workflow; this is not a global provider concurrency or spending cap.

Foundry accepts up to four owned JPEG/PNG/WebP references, each at most 3 MiB, with individual instructions. Its `oralia-foundry-assets-v2` packages contain scripts, timeline guides, generated images, optional narration, reference mappings, and checksums. ZIPs are capped at **9 MiB each**, bounded by actual account allowance. Oversized files use lossless byte chunks and reconstruction instructions. Email lists owner-authenticated links, not binary attachments. Historical single ZIPs and failed-export recovery remain supported.

## Database and Vercel Deployment

Turso uses one shared Prisma schema with owner-scoped application authorization. There is no schema-per-tenant isolation. Language/collection/publication indexes support discovery; catalog responses currently have no pagination.

Build with `npm run build`; Nitro creates `.vercel/output` with API and Workflow functions. Preserve API, static assets, and Workflow internal routing. Configure Vercel's production variables, HTTPS `APP_ORIGIN`, and Workflow service; redeploy after environment changes. Database deployment/seeding are separate explicit operations, never build or request side effects.

## Verification

```bash
npx prisma validate
npm test
npm run build
npm run db:verify:turso
```

Run tests and build sequentially. Tests use temporary SQLite and isolated provider fixtures; cloud verification is read-only. Builds/fixtures do not establish live model access, inbox receipt, native-language quality, or hosted end-to-end success. Prior Windows native migration-CLI failures and a provider-error Foundry run must not be relabeled as fresh passes without new evidence.

## Documentation and Expansion

- [ARCHITECTURE.md](ARCHITECTURE.md): contracts, state ownership, routes, workflows, and deployment boundaries.
- [RESEARCH.md](RESEARCH.md): evidence, tradeoffs, verification gaps, and [production expansion priorities](RESEARCH.md#production-expansion-priorities).
- [AGENTS.md](AGENTS.md): Research–Plan–Implementation workflow and contributor constraints.

Expansion priorities are resource accounting and operational recovery, paginated discovery and efficient media, versioned multi-style adaptation, opt-in offline/local-first delivery, and institutional tenancy/editorial governance. These are roadmap items, not shipped guarantees.
