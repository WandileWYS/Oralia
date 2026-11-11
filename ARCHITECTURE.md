# Oralia Architecture

Repository contracts reviewed **11 November 2026**. Product/setup overview: [README.md](README.md). Evidence and expansion priorities: [RESEARCH.md](RESEARCH.md). Contribution workflow: [AGENTS.md](AGENTS.md).

## System and runtime

React/TypeScript/Tailwind is built by Vite. Nitro provides local Node development and Vercel Node.js 24 functions; the Workflow Vite plugin compiles durable jobs. The Fetch-to-Node adapter preserves `/api/v1` paths, JSON status/body semantics, cookies, and origin checks. Vite is configured for port 5173; hosted functions have a 300-second limit, while work is divided into durable steps.

Prisma 7 uses the libSQL adapter and generated server-only client. Turso holds structured records; Cloudinary holds media bytes. Gmail SMTP/Nodemailer, Gemini, and OpenAI adapters are server-only. Keep API, static assets, and `/.well-known/workflow/v1/*` endpoints distinct from frontend rendering. The Vercel entry uses Fetch format plus the srvx Node bridge; do not restore obsolete SPA catch-all rewrites or the old raw-Node entry.

## Component hierarchy and state

```text
App → Navbar; VellumFeed; CreatorStudio; StudioFoundry; EducationFeed
VellumFeed → StoryCard / CreatorByline → public story/profile selection
ListeningRoomModal → CarouselPlayer → timeline, captions, volume, scenes
CreatorAccessGate / CreatorSignInModal → verified cookie session
```

| Owner | Responsibility |
|---|---|
| App | Workspace, collection, Vellum language filter, theme, sign-in visibility |
| `useDatabaseCatalog` | Full public catalog plus separate keyed/cancellable discovery requests; loading, refresh, errors |
| `usePublicView` | Public story/profile URLs and history; direct links work independently of browsing filters |
| `usePersistentSession` | Server-cookie identity restoration and logout; no JavaScript bearer-token storage |
| `useStoryBookmark` | Device-local guest IDs or authenticated account bookmarks; no media download |
| HTML audio / `useAudioCarousel` | One audio clock; derived scene index, playback controls, buffering, volume, and paint-aligned updates |
| Creator/Foundry components | Unsaved form edits, selected persisted job, polling, previews; Creator Studio also owns review confirmation |
| Turso / Cloudinary | Durable ownership, jobs, versions and asset metadata / actual asset bytes |

Phone styling is isolated to `@media (max-width: 480px)`: full-screen native Listening Room dialog, compact header, stacked forms, and single-column discovery. Existing rules above 480px remain unchanged. Preserve modal focus restoration, scroll locking, safe-area padding, and accessible popovers.

## Shared contracts

Zod contracts in [src/types](src/types) validate requests, provider output, and API responses. Literary keys are `FOLK_AND_FABLE` and `EPIC_AND_CHRONICLE`; `ALL` is browsing-only. Region/tradition is independent. Target languages are `en`, `zu`, `xh`, `sw`, `yo`, `ha`, `af`, `fr`, `pt`; default UI selection is `en`. Historical snapshot readers accept earlier plan shapes, while new provider output requires refined title and matching target language.

### Creator job submission

`CreationInput` accepts exactly one of text or an owned verified source asset, optional/blank title, concrete collection, region, language, and permission/source context. Example request to `POST /api/v1/creations`:

```json
{
  "requestKey": "64ad4200-a053-4d39-833d-4389a69b47e5",
  "input": {
    "title": "",
    "text": "A traveler learns to listen beside a river.",
    "collection": "FOLK_AND_FABLE",
    "region": "originals",
    "language": "en",
    "provenance": "Original narrative submitted with permission."
  }
}
```

### Structured planning

New Creator Studio Gemini wire responses contain `polishedTitle`, `language`, and scenes with title, narration, image prompt, and proposed boundaries. The server assembles `polishedText` from ordered narration. Example provider response:

```json
{
  "polishedTitle": "The River That Taught Listening",
  "language": "en",
  "scenes": [{
    "title": "Beside the river",
    "narration": "A traveler learns to listen beside a river.",
    "imagePrompt": "A traveler beside an African river, warm illustrated fable, consistent character design.",
    "proposedStartSeconds": 0,
    "proposedEndSeconds": 20
  }]
}
```

Foundry uses separate input/plan contracts: discriminator `studio_foundry_v1`, script, language, collection, provenance, `bypassTts` (default false), and owned reference IDs/instructions. Its Gemini scenes contain narration, `imagePrompt`, selected `referenceIds`, `startSeconds`, and `endSeconds`; the server assembles `localizedScript`. Timing is `estimated` until sample-measured narration replaces it with `audio_measured`.

### Limits and models

| Boundary | Implemented limit/default |
|---|---|
| Source recording | Five minutes; 20 MiB |
| Typed/localized text | 12,000 characters; 1–64 scenes; narration up to 2,000 characters per scene |
| Foundry references | Four JPEG/PNG/WebP images; 3 MiB and 25 megapixels each; required instructions up to 2,000 characters each |
| Admission | Two active jobs and ten submissions per user per rolling 24 hours, across both workspaces |
| Paid media concurrency | At most two operations within a workflow, not a global cap |
| AI defaults | STT `whisper-1`; Gemini `gemini-3.5-flash-lite`; TTS `tts-1-hd` / `onyx`; image `gpt-image-2.5-sunburst` |
| Images | Creator: 1024×1024 medium-quality PNG; Foundry: 1536×1024 high-quality PNG, edits when selected references apply |
| Archive parts | At most 9 MiB and never above the account's advertised raw-file allowance |

Environment overrides apply to OpenAI STT/TTS/voice/image settings. Defaults do not prove provider-account access or native-language quality. Source wording is preserved in the submission, while processed narration is localized; reviewed dialect translations are not fabricated.

## Database and safe cutover

There is **one shared Prisma schema**, with application-level owner authorization rather than separate tenant schemas or database-enforced row policies. `User` owns sessions, jobs, versions, assets, exports, and bookmarks; public stories reference authors. `Story` stores the published refined title, language, collection, media location, provenance, and publication time; ordered `KeyframeScene` rows drive playback.

`CreationJob` stores immutable input, transcription/plan, workflow identity, progress, and failure state. `StoryVersion` stores the immutable review/publication snapshot. `MediaAsset` tracks owned upload/generation slots. `StoryExport` separates archive readiness from notification state; related `ExportPart` rows hold ordered filenames, planned entries, private public IDs, bytes, SHA-256, and readiness.

Foundry jobs use `storyId=foundry:<uuid>` and `studio_foundry_v1`; exports use `versionId=foundry:<jobId>`. Core creation handlers exclude/reject those jobs. Foundry creates no `Story`, `KeyframeScene`, or `StoryVersion` rows; legacy recovery reads existing snapshots without modifying them.

Indexes cover language/publication, language/collection/publication, collection/publication, and author. Catalog filtering is applied in Prisma before reading scenes, but returns the full matching set without cursors/pages. Current individual public story/profile handlers still derive results from a catalog read; direct lookup optimization is future work.

Hosted runtime requires both Turso variables, with precedence over `DATABASE_URL`, and never silently falls back to SQLite. Outside Vercel, an explicit `file:` URL selects local SQLite. Local Prisma CLI schema commands operate on SQLite; remote Turso changes use explicit authenticated SQL and checksums.

| Command | Intended use |
|---|---|
| `npm run db:generate` | Generate the ignored Prisma client |
| `npm run db:migrate` | Deploy committed migrations to explicitly configured local SQLite |
| `npm run db:deploy:turso` | Initialize an empty cloud schema or verify a matching one; refuse incompatible schema |
| `npm run db:migrate:turso` | Apply/verify the current reviewed localized/multipart upgrade from its expected baseline, with an ignored backup |
| `npm run db:seed` | Explicit idempotent editorial seeding; preserve unrelated user content |
| `npm run db:verify:turso` | Read-only cloud catalog/seed integrity verification |

Do not use remote `db push`, reset data, edit historical migrations, or treat the current upgrade script as a universal migration orchestrator. Earlier baselines need a reviewed upgrade path. Native Windows migration-CLI errors require diagnosis; successful SQL-based tests do not establish that the CLI works on every host.

## Authentication

Real SMTP delivers random six-digit verification codes; only keyed hashes are stored. Codes expire in ten minutes, allow five attempts, and have sixty-second resend cooldown plus persistent email/IP limits. Failed attempts commit counters. SMTP failure invalidates the challenge without issuing a session.

Verified sessions are opaque database-backed credentials in HttpOnly, SameSite=Lax cookies, Secure in production, with seven-day expiry. Mutations check origin and protected handlers verify ownership. Source/draft/archive media are private; only reviewed published copies receive public delivery. The core and Foundry APIs have bounded JSON bodies and sanitized errors. Provider adapters fail explicitly without mock runtime substitutions.

## Durable creation lifecycle

`QUEUED → SCRIPT_READY → PROCESSING_MEDIA → COMPLETED`, with `FAILED` and `INDETERMINATE` outcomes:

1. Persist an owner-scoped idempotent job; verify uploaded audio before transcription. Typed text is an explicit alternative.
2. Gemini generates/refines a contextual title, translates to the selected language, and segments narration into visual beats. Validate content shape, limits, language, references, and estimated timeline; preserve original input/transcript.
3. Durable media steps generate audio and imagery in bounded batches. Foundry sends selected reference bytes/instructions to image edits; scenes without selected references use text-to-image. Completed assets are reused, confirmed transient failures have bounded retries, and ambiguous paid outcomes require reconciliation.
4. Combine 24 kHz mono 16-bit PCM segments and derive scene boundaries from sample counts. Store narration and immutable Creator Studio snapshot; only explicit reviewed publication updates the public story. Revisions regenerate affected media/timing.
5. Foundry instead packages private assets. With TTS bypass, no narration request/asset is required and timings stay estimated. A Foundry job completes only after all archive parts are verified. Notification failure remains independent of completion.

## API inventory

All routes below are relative to `/api/v1`. Catalog/direct public reads and bundled-media checks are public; other operations require the appropriate verified owner except OTP requests/verification.

| Routes | Purpose |
|---|---|
| `GET /health`, `/catalog`, `/stories/:id`, `/creators/:username`, `/media-status` | Database health, discovery, public links, bundled-media availability |
| `POST /auth/otp/request`, `/auth/otp/verify`; `GET /auth/session`; `POST /auth/logout` | Email-code and cookie-session lifecycle |
| `PATCH /me/voice`; `GET /bookmarks`; `PUT/DELETE /bookmarks/:storyId` | Account preference and bookmarks |
| `POST /uploads`, `/uploads/:id/complete` | Signed source audio upload and verified completion |
| `GET/POST /creations`; `GET/PATCH /creations/:id`; `POST /creations/:id/retry`, `/creations/:id/notify` | Creator jobs, revisions, safe recovery, completion notification |
| `POST /versions/:id/publish` | Reviewed Creator Studio publication |
| `POST /exports` | Retired creation endpoint: authenticated `410 FOUNDRY_REQUIRED` |
| `GET /exports/:id`, `/exports/:id/download`; `POST /exports/:id/notify` | Legacy compatibility and authorized recovery routing |
| `POST /foundry/references`, `/foundry/references/:id/complete` | Owned reference uploads |
| `GET/POST /foundry/jobs`; `GET /foundry/jobs/:id`; `POST /foundry/jobs/:id/retry` | Isolated Foundry processing |
| `GET /foundry/exports`, `/foundry/exports/:id`, `/foundry/exports/:id/download`, `/foundry/exports/:id/parts/:partNumber/download` | Owned current/legacy packages and signed part redirects |
| `POST /foundry/exports/:id/retry`, `/foundry/exports/:id/notify` | Archive-only or failed-email recovery |

`GET /catalog` accepts optional `collection` and `language`; omit to browse all, and reject invalid values with `400`. Search remains client-side. No paginated response or paid image-generation endpoint is advertised beyond the implemented job APIs.

## Export/email separation

ZIP planning first attempts one archive, then partitions when necessary. A bounded buffer checks final ZIP size before upload. PNG entries retain bytes; text/WAV use lossless DEFLATE. Oversized files become ordered byte chunks with whole-file/chunk SHA-256 and PowerShell/macOS/Linux reconstruction instructions. `oralia-foundry-assets-v2` includes scripts, timeline JSON/text, provenance, reference mapping, part inventory, and checksums; original reference files are excluded.

Parts are named `foundry-export-part1.zip`, `foundry-export-part2.zip`, etc.; a fitting single package is `foundry-export.zip`. Actual raw-file allowance is queried rather than assuming all Cloudinary accounts have a fixed quota. Prior integration encountered a 10 MiB allowance; the application uses a 9 MiB ceiling as headroom. Individual durable steps build, privately upload, and verify parts. Resume uses persisted plans/ready parts without regenerating media. Parent READY requires every part; email retry never repackages.

Export responses include `parts[]` with number, filename, bytes, checksum, status, and authorized link. Single downloads remain compatible; multipart parent download returns `409 MULTIPART_REQUIRED` with the part list. Owner-checked download routes mint expiring Cloudinary redirects. Completion mail lists links, not attachments. `?export=`, `?foundryExport=`, and `?foundryJob=` open Foundry and preserve sign-in intent. SMTP acceptance is not inbox proof; interrupted SENDING state needs reconciliation.

## Delivery and verification roadmap

The RPI cycle is repository/provider research, a decision-complete plan with acceptance boundaries, implementation, then evidence-based verification; see [AGENTS.md](AGENTS.md#research-plan-implementation). Builds generate Prisma/media manifests and compile API/Workflow bundles without database access. Environment changes require hosted redeployment; schema/seeding are never build/request side effects.

Future extension points are a shared usage ledger/admission layer, dedicated paginated discovery queries, versioned style profiles, distribution-media derivatives, an explicit offline/download and draft-sync layer, and organization-aware authorization. These are proposals detailed in [RESEARCH.md](RESEARCH.md#production-expansion-priorities), not implemented services.
