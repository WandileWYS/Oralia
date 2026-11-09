# Oralia Architecture

## System and runtime

Oralia has three client modes: `vellum`, `creator_studio`, and `education`. Public discovery and listening require no login. Creation uses real verified email and an owner-authorized persisted workflow.

The React/TypeScript/Tailwind client is built by Vite. Nitro supplies local Node development and Vercel Node.js 24 serverless packaging. `routes/api/v1/[...route].ts` bridges the Fetch entry to the Node HTTP `server/api.ts` handler; Workflow's Vite plugin compiles `workflows/story.ts` into durable functions. Keep API, static assets, and Workflow's `/.well-known/workflow/v1/*` routes distinct from the SPA renderer. The old Vite middleware/hand-written Vercel catch-all entrypoint is superseded. Use Nitro’s Fetch-format entry on Node.js 24 with the srvx Node-handler bridge: the installed Nitro raw-Node entry mutates a socket property and fails on reused HTTP connections. The Fetch entry avoids this mutation while preserving body/header/cookie semantics.

Prisma 7 uses the libSQL driver adapter. Turso is the hosted source of truth; explicit file SQLite URLs are for local/isolated work. Cloudinary stores actual media, while Turso and Workflow state hold references and progress. Gmail STARTTLS/Nodemailer, Gemini, and OpenAI remain server-only provider adapters.

## Component hierarchy and state

```text
App
  Navbar — mode, collection, theme, session avatar
  VellumFeed — Featured Vellum / Trending Voices / Recent Chronicles
    StoryCard / CreatorByline
  CreatorAccessGate / CreatorSignInModal
  CreatorStudio
    useStudioRecording / AudioDraftPlayer
    persisted job status, scene editor, review, export status
  EducationFeed — collection presentation + independent region tabs
  ListeningRoomModal
    CarouselPlayer — useAudioCarousel / usePlaybackSource
      KeyframeTimeline / PlaybackWaveform / CaptionTranscript / VolumeControl
      SceneThumbnail / bookmark controls
  CreatorProfileModal / CatalogStatusModal / UnavailablePublicViewModal
```

| Owner | State |
|---|---|
| App | `AppMode`, shared `CollectionFilter`, theme, sign-in visibility |
| `usePublicView` | URL-based public story/profile selection and browser history |
| `useDatabaseCatalog` | Whole public catalog, loading/error/refresh/retry |
| `usePersistentSession` | Cookie-restored verified identity and logout feedback; no browser bearer token |
| `useStoryBookmark` | Guest device IDs or authenticated account bookmarks |
| HTML audio element | Actual time, playback, duration, rate, buffering, volume |
| `useAudioCarousel` | Derived active scene and event-driven controls; one paint loop for frame boundaries |
| Studio | Unsaved source/scene edits, selected persisted job, review checkbox, polling |
| Turso | Identity, hashes, sessions, story/version/job/asset/export metadata |
| Cloudinary | Private source/draft/archive bytes and public published-media copies |
| Workflow | Durable ordered execution with IDs, not media buffers |

The UI never substitutes a catalog fixture when fetch fails. Direct story/profile links resolve against the full catalog even when a browsing collection differs. Creator profile filtering uses the same collection state.

## Shared contracts

`StoryCollection` is exactly `FOLK_AND_FABLE | EPIC_AND_CHRONICLE`. `CollectionFilter` additionally allows UI-only `ALL`. Region/tradition is independent. One `Story.presentation` contains approved style metadata and keyframes; collection is literary character, not an audience rating.

`CreationInput`, `PolishedPlan`, `CreationJob`, and export responses are validated by `src/types/creation.ts`. Untrusted provider JSON must match all variable scene records; joined scene narration must equal the polished text, within 12,000 characters. Proposed times start at zero and increase, but are not authoritative playback boundaries.

Illustrative request/response examples below are documentation, never runtime fallback data.

### Vellum public story

```json
{
  "mode": "vellum",
  "filter": "ALL",
  "story": {
    "id": "anansi-wisdom",
    "collection": "FOLK_AND_FABLE",
    "creatorId": "editorial-akan",
    "region": "west-africa",
    "audio": { "url": "/audio/anansi-wisdom.wav", "durationSeconds": 72.5, "mimeType": "audio/wav", "language": "en" },
    "presentation": {
      "stylePreset": "FOLK_AND_FABLE",
      "styleLabel": "Warm illustrated folklore",
      "reviewStatus": "approved",
      "keyframes": [
        { "id": "s1", "startTime": 0, "endTime": 18, "caption": "Anansi sets out to gather wisdom.", "imageUrl": "https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=1920" },
        { "id": "s2", "startTime": 18, "endTime": 37, "caption": "He places what he learns inside a pot.", "imageUrl": "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=1920" },
        { "id": "s3", "startTime": 37, "endTime": 55, "caption": "A child sees a simpler way.", "imageUrl": "https://images.unsplash.com/photo-1472396961693-142e6e269027?w=1920" },
        { "id": "s4", "startTime": 55, "endTime": 72.5, "caption": "Wisdom belongs among the people.", "imageUrl": "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1920" }
      ]
    }
  }
}
```

### Creator job submission

```json
{
  "requestKey": "c916975a-a585-48a1-87c9-04f187474d06",
  "input": {
    "title": "The River Remembers",
    "collection": "EPIC_AND_CHRONICLE",
    "region": "originals",
    "language": "en",
    "text": "A traveler returns to the river where her family once gathered.",
    "provenance": "Original narrative submitted with the author's permission."
  }
}
```

Use either `text` or a verified owned `sourceAssetId`, never both. Creator Studio's production selection is concrete and defaults to Folk & Fable when browsing All Collections. Export manifest version is `oralia-storyboard-v4`, with immutable `versionId`, concrete `collection`, narration filename/duration/checksum, ordered scene prompts, proposed and measured boundaries, image filenames/checksums, and provenance.

### Education browsing

```json
{
  "mode": "education",
  "collectionFilter": "FOLK_AND_FABLE",
  "regionFilter": "east-africa",
  "collectionChoices": ["ALL", "FOLK_AND_FABLE", "EPIC_AND_CHRONICLE"],
  "presentation": {
    "FOLK_AND_FABLE": "Warm illustrated folklore, wit, and reflection",
    "EPIC_AND_CHRONICLE": "Cinematic editorial journeys, origin narratives, and consequence"
  },
  "captions": { "enabled": true, "language": "en", "dialectOverlay": false }
}
```

Do not invent translated captions or make collection-based school-suitability claims. Captions reflect actual narration and available source-language metadata.

## Database and safe cutover

| Model | Responsibility |
|---|---|
| User | Unique email/username, public identity, role, verified-email timestamp |
| OtpChallenge | Keyed code hash, expiry, attempts, delivery timestamp, consumed state |
| AuthRateLimit | Persistent keyed email/IP counters and reset times |
| Session | Hashed opaque credential, owner, expiry, verified flag |
| Story | Published catalog projection, author, concrete collection, source context, audio/duration, version reference |
| KeyframeScene | Unique story/scene number, narration, image, measured start timestamp |
| Bookmark | Unique owner/story relationship |
| CreationJob | Owner/request idempotency, logical story/version, input/transcript/plan, stage/status, workflow run |
| MediaAsset | Owner/job slot, Cloudinary identity/type/format, checksum/sample count, processing status |
| StoryVersion | Immutable snapshot, owner/job, logical story/version number, publication time |
| StoryExport | Unique owner/version archive, recipient, independent notification and archive status |

Drafts do not become public Story rows until publication. Source and draft assets require Cloudinary authenticated delivery; owner-checked API responses mint ten-minute signed downloads. Publication uses immutable public version paths and transactional catalog updates. Existing sourced stories retain `LEGACY_EDITORIAL` provenance and accurate photographic attribution.

The production migration adds columns/tables without rebuilding/deleting stories or scenes. It invalidates old simulated sessions/challenges; real owners must verify again. Cloud application checks the pre-production baseline, writes a local ignored backup, applies an atomic batch, and records migration/schema checksums. A repeated command verifies the same result. Unexpected schemas stop without reset. Test writes always use separate SQLite files.

## Authentication

1. Validate and normalize email; reserve editorial addresses.
2. Persist rate counters and a random six-digit code hash. Ten-minute expiry, five attempts, sixty-second resend cooldown; hourly request caps per email/IP and verification IP cap.
3. Send through Gmail port 587 with required STARTTLS. Failed SMTP invalidates the challenge and never authenticates.
4. Constant-time hash verification and atomic consumption create/update verified identity plus a seven-day opaque session.
5. Return identity and HttpOnly/SameSite=Lax cookie, Secure in production. No token enters JavaScript storage. Cookie authorization verifies expiry and email ownership; logout revokes the database session.

## Durable creation lifecycle

`QUEUED → PROCESSING_MEDIA → COMPLETED`; errors become `FAILED` with an explicit retry classification or `INDETERMINATE` for an unknown paid result. Persist progress before/after each bounded provider operation. Dispatch claims prevent duplicate initial starts; unique owner/request and job/asset-slot keys protect retries. Workflow steps have at most two automatic retries.

1. Signed direct upload; server verifies Cloudinary identity, authenticated delivery, actual format, size, duration, and ownership. Audio input limit is five minutes / 20 MB. Typed text is an explicit alternative.
2. OpenAI transcription (`whisper-1` default), or persist submitted text.
3. Exact Gemini `gemini-3.5-flash-lite`: strict polished text plus dynamically planned scenes (1–64), cultural/source-preserving instructions, reject blocked/empty/malformed output.
4. Variable-length `tts-1-hd` requests with one voice (`onyx` default), raw 24 kHz mono 16-bit PCM. Store each completed scene privately.
5. Variable-length OpenAI images (`gpt-image-2.5-sunburst` initially), validated PNGs uploaded privately. Missing config or rejection fails the job, never a placeholder.
6. Fetch completed audio segments, count samples, assemble WAV, calculate continuous authoritative boundaries, save immutable snapshot, mark COMPLETED.
7. Creator edits create a fresh immutable job/version with affected media invalidated. Explicit review is required for publication; reject stale versions and foreign owners.

Network failures after potentially accepted paid requests are ambiguous: keep known assets, attempt recovery by reserved Cloudinary identity, otherwise require creator review. Never repeat an uncertain charge automatically. Completed versions remain private until promotion. Storage cleanup/retention of abandoned drafts and operator reconciliation of interrupted dispatch/sends remain operational responsibilities.

## API inventory

All routes are under `/api/v1`. Successful protected operations require the verified cookie, persisted owner checks, and same-origin mutations. Unknown API routes return JSON 404, never the SPA.

| Method / route | Behavior |
|---|---|
| GET `/health` | Database query health |
| GET `/catalog?collection=...` | All published stories if omitted; invalid or `ALL` value returns 400 |
| GET `/stories/:id`, `/creators/:username` | Public record independent of browse filters |
| GET `/media-status?url=...` | Generated manifest lookup for bundled narration |
| POST `/auth/otp/request`, `/auth/otp/verify` | Actual SMTP code request and verification |
| GET `/auth/session`; POST `/auth/logout` | Cookie identity and revocation |
| PATCH `/me/voice` | Persist owner voice preference |
| GET `/bookmarks`; PUT/DELETE `/bookmarks/:storyId` | Account bookmarks |
| POST `/uploads`; POST `/uploads/:id/complete` | Signed recording reservation and verified completion |
| GET/POST `/creations` | Owner jobs / persist and dispatch new job (202) |
| GET/PATCH `/creations/:id` | Owner status / immutable scene revision (202) |
| POST `/creations/:id/retry` | Confirmed retryable failure only (202) |
| POST `/versions/:id/publish` | `{ "reviewed": true }`; queue promotion (202) |
| POST `/exports` | Owned version archive request (202) |
| GET `/exports/:id` | Archive and notification status |
| GET `/exports/:id/download` | Owner authorization, then expiring media redirect |
| POST `/exports/:id/notify` | Retry failed notification without regeneration (202) |

The former standalone placeholder-image endpoint is removed. Generation occurs only inside an authorized creation job. Provider and configuration errors return sanitized structured responses; unexpected database failures return JSON 503.

## Export/email separation

Workflow packages an owned immutable snapshot into ZIP, stores it privately, marks READY, then notifies. Manifest checksums describe actual downloaded bytes. A stable `/?export=:id` link opens Creator Studio and requires the owner before redirecting to a fresh signed archive URL. Email status is separate (`QUEUED`, `SENDING`, `SENT`, `FAILED`); failure leaves READY intact. Concurrent send claims prevent parallel duplicates; SMTP cannot guarantee exactly-once delivery. Investigate a stranded SENDING state before another send.

## Delivery and verification roadmap

1. **Layout:** Responsive Vellum, Studio, Education, creator/profile navigation, both themes, keyboard and focus behavior.
2. **Audio engine:** Single media clock, exact scene seeks, source replacement, format variation, buffering, image failure and explicit media errors; no timing-tone substitutions.
3. **Studio production:** Real SMTP/cookies, signed uploads, durable generation, measured scenes, immutable review/publication, server archive and email-only retry. Verify interrupted workflows and ambiguous paid outcomes separately.
4. **Discovery and curation:** Shared collections/region intersections, direct links, creator ownership, published catalog refresh. Offline/partial-download UI and bounded PWA storage remain future work; bookmarks do not cache audio.

Run Prisma validation, isolated migration/domain/API/provider tests, then build sequentially. Validate actual packaged Node handlers plus API/static/Workflow routing. Check 320/390/768/1440 px in both themes, all seeded bylines and listening rooms, scene boundaries, OTP/header restoration, errors and export access. Real integration must separately prove inbox receipt, exact model access, media delivery/seeking, Workflow execution, and paid generation; compilation alone cannot establish these.

## Dynamic generation update — 9 November 2026

Creation is asynchronous: QUEUED → SCRIPT_READY → PROCESSING_MEDIA → COMPLETED, with FAILED/INDETERMINATE error states. Gemini dynamically chooses visual beats at roughly 15–30 seconds of narration per scene, within a safety ceiling of 64 scenes. One-minute narratives target 3–4 scenes; five-minute narratives target 12–20 or more. Historical seeded stories keep their existing four scenes.

Workflow launches at most two narration steps, then two image steps per iteration. Each paid request has its own durable step and bounded retry; completed assets are reused and ambiguous paid outcomes require review. Narration WAV responses stream directly to authenticated Cloudinary upload streams. Image API Base64 JSON requires a bounded per-image decode before upload; no local media files are written. Final assembly measures actual PCM samples. Gemini boundaries remain estimates; GET /api/v1/creations/:id exposes measured boundaries and formatted MM:SS.mmm timestamps when complete.

CreationJob persists totalScenes, processedScenes and independent notificationStatus. The status response includes completionPercentage (up to 95% during media preparation; 100% only after final assembly). COMPLETED means a private draft is ready for review, never automatic publication. Completion email uses real Gmail SMTP; POST /api/v1/creations/:id/notify retries a failed email without regenerating media. Interrupted SENDING notifications require operator reconciliation.

OPENAI_API_KEY is server-only. Unset or blank OPENAI_STT_MODEL, OPENAI_TTS_MODEL and OPENAI_TTS_VOICE default to whisper-1, tts-1-hd and onyx. The existing configurable GPT image model remains selected; no automatic legacy DALL·E substitution occurs. Run db:migrate:turso for the reviewed dynamic-scene migration from the previous production schema, or db:migrate for local SQLite. Cloud verification compares logical column/index definitions, ignoring physical column ordinals after ALTER TABLE.

The Gemini provider returns the complete polished narrative as ordered scene narrations. The server assembles polishedText exactly from those narrations, avoiding divergent duplicate story text. The original transcript remains separately preserved.
