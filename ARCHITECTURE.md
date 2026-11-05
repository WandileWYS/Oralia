# Oralia — Architecture & Blueprint

**Status:** Production blueprint with Phase 1 scaffold and Phase 2 interactive frontend implemented  
**Date:** 4 November 2026  
**Product:** Audio-first visual carousel for African oral storytelling, creator concepts, and curated education feeds.

**Implementation update — 5 November 2026:** The React/Vite frontend includes all three modes, local story fixtures, Zod schemas, a shared audio carousel hook, session-only recording/upload preview, four-tier visual selection, and a real sample ZIP export with simulated email notification. Production AI, API, durable draft storage, queue, authentication, email, discovery pagination, and PWA offline support remain future work. The illustrated sample is original fiction with synthetic English narration, not an attributed traditional story or a dialect transcription.

Frontend `AppMode` uses `social_reel | creator_studio | education`. These UI state identifiers are distinct from the proposed API's mode labels. Frontend `Keyframe.startTime/endTime` represent the same seconds as the proposed API's `startSeconds/endSeconds`; the future API adapter owns that mapping. `Story.tierVariants` holds `StoryVariant` values, and `CreatorAssetBundle` describes the local studio preview/export. The navbar and App own mode/age preferences; the player hook owns media state. No server-state store is needed until the API is connected.

**Phase 2 frontend update — 5 November 2026:** App owns a persisted light/dark appearance preference. `CaptionTranscript` auto-scrolls inside its own pane on cue changes; `KeyframeTimeline` derives thumbnail hover/focus previews from the same audio timeline. English captions are original; isiZulu/Swahili are explicitly pending placeholders. Overlay/language selection never changes the audio or source transcript. Education presentation is scoped per tier, and collection filters exclude the unassigned original fixture from regional traditions.

The studio keeps `StoryboardFrame` values (`Keyframe` plus `prompt`) in local `CreatorAssetBundle` state. Reordering and duration edits use pure helpers to recalculate continuous seconds; studio time is independent of the source audio duration. `ExportModal` shows a native modal dialog and builds a ZIP preview before enabling download. `buildManifest`/`packageStoryboard` export `oralia-storyboard-v2` metadata, ordered assets, prompts, timings, file sizes, and SHA-256 image checksums. Notification status is simulated and no recipient or recording is stored in the archive. AI regeneration, reviewed translations, real regional content, and email transport remain future integrations.

## 1. Architecture goals

- Keep recorded audio as the canonical timeline; show keyframe art in a React carousel without rendering a video file.
- Let the same story carry four editorially distinct age variants: `5-9`, `10-13`, `14-17`, and `18+`.
- Make expensive transcription, image generation, and packaging work asynchronous, resumable, observable, and safe to retry.
- Keep AI, storage, and email credentials behind server-side provider adapters.
- Support weak or interrupted connectivity, user-selected offline stories, captions, dialect metadata, and accessible player controls.
- Preserve storyteller consent, attribution, content ratings, and corrections as first-class data.

## 2. System shape

```mermaid
flowchart LR
  U[React + Vite PWA] -->|HTTPS /api/v1| API[Typed API]
  U -->|Scoped upload URL| OBJ[(Private object storage)]
  API --> DB[(PostgreSQL: stories, jobs, metadata)]
  API --> Q[Durable job queue]
  Q --> W[Workers: transcribe, storyboard, generate, moderate, package, email]
  W --> AI[AI provider adapters]
  W --> OBJ
  W --> DB
  W --> OUT[Transactional email provider]
  U --> CDN[CDN: audio and image renditions]
  CDN --> OBJ
```

### Recommended deployment boundaries

- **Web:** React, TypeScript, Tailwind CSS, Vite. Progressive enhancement for install/offline use.
- **API:** Node.js + TypeScript service, versioned REST endpoints, schema validation at the boundary. Keep this service stateless apart from database/object storage.
- **Persistence:** PostgreSQL for users/consent, stories, tier variants, job state, asset manifests, and email outbox. Use a durable queue with dead-letter handling; queue choice is an infrastructure decision.
- **Media:** Private S3-compatible object storage for originals, renditions, generated images, and ZIP exports; CDN for public/approved playback assets. Do not persist large media blobs in PostgreSQL.
- **Workers:** Separate worker process or managed task service for slow AI/image/ZIP/email jobs. Each job step records state, retry count, timestamps, provider request IDs, and safe error summaries.
- **Provider adapters:** `TranscriptionProvider`, `StoryboardProvider`, `ImageProvider`, `ModerationProvider`, `ObjectStorageProvider`, and `EmailProvider`. Keep model IDs and vendor-specific request fields out of the UI and domain records.

## 3. Main processing flows

### Mode 1 — Core Social Reel

1. Storyteller records locally or uploads a completed audio file. Record MIME type, duration, file size, checksum, consent/rights choice, language hint, and dialect hint.
2. Server creates a story job; audio uploads directly to private storage using a scoped URL.
3. Worker transcribes the original language, identifies useful segment boundaries, and creates a reviewed transcript with timestamped story beats. Reject out-of-range and non-monotonic times.
4. Storyboard step produces an audio-aligned keyframe plan and a separate variant for each requested age tier. A creator/editor can correct transcript, beats, prompts, and audience before generation/publishing.
5. Generate image assets per keyframe/tier; apply text/image moderation and content policy; hold flagged/uncertain output for human review.
6. Publish a story record with audio and images on the media CDN. At playback, a single audio element drives the active keyframe and subtitle cues.

### Mode 2 — Creator & Game Studio

1. Creator records or uploads a pitch and chooses desired output tiers, asset types, and notification email.
2. Create an asynchronous `creatorJob`; return `202` and a status URL immediately.
3. Worker transcribes pitch, creates an editable concept/storyboard, generates requested concept frames, and saves prompts and assets.
4. Packaging worker creates a versioned archive (`README.md`, storyboard JSON, prompt/asset manifest, image files, selected transcript/captions) and records checksum/size/expiry.
5. Mark export ready and enqueue one email notification via a transactional outbox. Email contains a protected application link; the authorized download page mints a short-lived signed object URL.

### Mode 3 — Education & Schooling

1. Curators approve stories and age-specific adaptations; public feed endpoints only return published, reviewed variants for a requested age tier.
2. Feed selects `tierVariants[ageTier]`, including age-appropriate story text/captions, illustration style, content rating, and keyframe assets.
3. Player offers original-language captions, dialect label/overlay, translation where available, and saved-for-offline controls.
4. Educator controls/curation metadata and consent boundaries remain separate from public story content. School-facing use should begin with a privacy and child-safety review.

## 4. Component hierarchy

```text
App
├─ AppShell
│  ├─ Header / ModeSwitcher
│  ├─ ConnectionStatus
│  └─ RouteOutlet
├─ CoreSocialRoute
│  ├─ RecordStoryPage
│  │  ├─ RecorderControls
│  │  ├─ RecordingPermissionHelp
│  │  └─ UploadProgress
│  ├─ StoryReviewPage
│  │  ├─ TranscriptEditor
│  │  ├─ KeyframeTimelineEditor
│  │  └─ TierVariantPreview
│  └─ StoryPlayerPage
│     ├─ AudioController (one HTMLAudioElement)
│     ├─ SyncedCarousel
│     ├─ CaptionTrack / DialectOverlay
│     └─ AccessiblePlayerControls
├─ CreatorStudioRoute
│  ├─ PitchRecorder / PitchUploader
│  ├─ CreatorJobForm
│  ├─ JobProgress
│  └─ ExportReadyPanel
└─ EducationRoute
   ├─ AgeTierSelector
   ├─ CuratedFeed
   ├─ StoryCard
   └─ StoryPlayerPage (same player as Mode 1)
```

Shared UI must not duplicate audio synchronization logic. `SyncedCarousel` accepts a selected `StoryVariant`; it does not own the audio clock. The audio controller should survive slide changes and only be recreated when the audio asset/story changes.

## 5. State management

| State domain | Owner | Update pattern |
|---|---|---|
| Stories, feed pages, job status, export metadata | TanStack Query or equivalent server-state cache | Fetch via typed API client; key by story/job/age tier; invalidate or poll with bounded intervals; treat server as source of truth. |
| Playback clock | `PlaybackController` wrapping one `HTMLAudioElement` | Read `currentTime` in a frame loop while playing; publish only discrete active-frame/subtitle changes. React subscribes through `useSyncExternalStore` or a focused hook. |
| Playback controls | Player component/local reducer | Play/pause, seek drag, selected track, volume, rate. Reconcile with actual media events, not optimistic assumptions. |
| UI preferences | Small Zustand store or local state | Selected mode, non-sensitive preferences, dismissed notices. Keep URL as owner for shareable feed/tier filters. |
| Recording/upload draft | IndexedDB-backed draft service | Persist local recording metadata/blob and upload retry state; recover after reload and show explicit pending status. |
| Offline assets | Service-worker Cache Storage + IndexedDB index | Store app shell, bounded images, and explicitly saved audio; surface download/eviction status. |
| Backend workflow status | PostgreSQL + durable queue | State transitions and retries are server-authoritative; client refresh must safely rejoin an existing job. |

Avoid a single global store for all data. Do not put audio bytes, generated image Base64, signed URL tokens, or full transcripts into local-storage state.

## 6. Shared domain model

### Canonical age tiers

`AgeTier = "5-9" | "10-13" | "14-17" | "18+"`

Every published story has one or more approved `tierVariants`, keyed by these canonical strings. Each variant contains an editorial summary, rating/review state, visual style, captions, and image sequence. Feed filtering uses the requested tier, never an age inferred from a profile. A story without an approved variant is not returned for that tier. Unless there is a separately created narration track with its own alignment, a tier variant changes curation and visuals; it does not rewrite what the storyteller said. Captions remain the original transcript or a faithful, timestamp-aligned translation, with source segment IDs for review.

### Common keyframe and variant contract

```json
{
  "ageTier": "10-13",
  "contentRating": "family-adventure",
  "reviewStatus": "approved",
  "stylePreset": "adventure-graphic-novel",
  "editorialSummary": "A curious child follows a bird toward a river.",
  "captions": [
    {
      "startSeconds": 0.0,
      "endSeconds": 3.8,
      "text": "The river path led to the old baobab.",
      "language": "en",
      "dialect": null,
      "kind": "translation",
      "sourceSegmentIds": ["seg_001"]
    }
  ],
  "keyframes": [
    {
      "id": "kf_001",
      "startSeconds": 0.0,
      "endSeconds": 4.2,
      "imageAssetId": "asset_img_001",
      "imageUrl": "https://media.example.test/stories/story_001/kf_001.webp",
      "altText": "A young traveler follows a river path toward a broad baobab tree.",
      "promptVersion": "oralia-tier-v1"
    }
  ]
}
```

Times are seconds from the start of the canonical audio. `imageUrl` is included here to make mock payloads easy to preview; production should use CDN URLs generated for approved assets. The API validates ordering, duration bounds, uniqueness, MIME types, review state, and every tier's rating.

## 7. Mock JSON payloads

These examples are deliberately small mock records. They show all four tier keys and the distinct data each mode needs; real IDs, URLs, and transcript text come from the server pipeline.

### Mode 1 — Core Social Reel

```json
{
  "mode": "core-social",
  "storyId": "story_001",
  "status": "published",
  "storyteller": { "id": "person_041", "displayName": "Nandi M.", "attribution": "name" },
  "audio": {
    "assetId": "asset_audio_001",
    "url": "https://media.example.test/audio/story_001.mp3",
    "mimeType": "audio/mpeg",
    "durationSeconds": 62.4,
    "language": "zu",
    "dialect": "curator-supplied-label"
  },
  "sourceTranscript": [
    { "startSeconds": 0.0, "endSeconds": 4.2, "text": "Kwathi ngelinye ilanga...", "language": "zu", "dialect": "curator-supplied-label" }
  ],
  "availableTiers": ["5-9", "10-13", "14-17", "18+"],
  "tierVariants": {
    "5-9": { "contentRating": "gentle-folktale", "reviewStatus": "approved", "stylePreset": "soft-fairytale", "editorialSummary": "A child follows a friendly bird along a sunny path.", "captions": [{ "startSeconds": 0.0, "endSeconds": 4.2, "text": "Kwathi ngelinye ilanga...", "language": "zu", "dialect": "curator-supplied-label", "kind": "original", "sourceSegmentIds": ["seg_001"] }], "keyframes": [{ "id": "kf_5_9_001", "startSeconds": 0.0, "imageAssetId": "img_5_9_001", "imageUrl": "https://media.example.test/5-9/001.webp", "altText": "A child follows a bright bird along a sunny path." }] },
    "10-13": { "contentRating": "family-adventure", "reviewStatus": "approved", "stylePreset": "adventure-graphic-novel", "editorialSummary": "A curious child follows a bird toward the river.", "captions": [{ "startSeconds": 0.0, "endSeconds": 4.2, "text": "Kwathi ngelinye ilanga...", "language": "zu", "dialect": "curator-supplied-label", "kind": "original", "sourceSegmentIds": ["seg_001"] }], "keyframes": [{ "id": "kf_10_13_001", "startSeconds": 0.0, "imageAssetId": "img_10_13_001", "imageUrl": "https://media.example.test/10-13/001.webp", "altText": "A curious child follows a bird toward a river." }] },
    "14-17": { "contentRating": "ya-drama", "reviewStatus": "approved", "stylePreset": "cinematic-ya", "editorialSummary": "The bird draws a young traveler toward a hidden crossing.", "captions": [{ "startSeconds": 0.0, "endSeconds": 4.2, "text": "Kwathi ngelinye ilanga...", "language": "zu", "dialect": "curator-supplied-label", "kind": "original", "sourceSegmentIds": ["seg_001"] }], "keyframes": [{ "id": "kf_14_17_001", "startSeconds": 0.0, "imageAssetId": "img_14_17_001", "imageUrl": "https://media.example.test/14-17/001.webp", "altText": "A young traveler watches a bird near a shadowed river crossing." }] },
    "18+": { "contentRating": "adult-historical-drama", "reviewStatus": "approved", "stylePreset": "cinematic-concept", "editorialSummary": "The crossing connects a traveler to a deeper family history.", "captions": [{ "startSeconds": 0.0, "endSeconds": 4.2, "text": "Kwathi ngelinye ilanga...", "language": "zu", "dialect": "curator-supplied-label", "kind": "original", "sourceSegmentIds": ["seg_001"] }], "keyframes": [{ "id": "kf_18_plus_001", "startSeconds": 0.0, "imageAssetId": "img_18_plus_001", "imageUrl": "https://media.example.test/18-plus/001.webp", "altText": "A traveler studies an old river crossing at dusk." }] }
  },
  "publication": { "visibility": "public", "publishedAt": "2026-11-04T08:00:00Z", "consentRecordId": "consent_001" }
}
```

### Mode 2 — Creator & Game Studio

```json
{
  "mode": "creator-studio",
  "jobId": "job_205",
  "status": "generating",
  "createdAt": "2026-11-04T08:15:00Z",
  "request": {
    "projectName": "The Moon Weaver",
    "creatorId": "person_081",
    "notificationEmail": "creator@example.test",
    "audioUploadId": "upload_205",
    "sourceLanguage": "en",
    "targetTiers": ["10-13", "14-17", "18+"],
    "deliverables": ["transcript", "storyboard-json", "generated-images", "prompt-manifest", "zip"]
  },
  "storyboardByTier": {
    "5-9": null,
    "10-13": { "stylePreset": "adventure-graphic-novel", "contentRating": "family-adventure", "frames": [{ "id": "frame_01", "startSeconds": 0.0, "prompt": "A young apprentice discovers a silver thread beneath a moonlit tree." }] },
    "14-17": { "stylePreset": "cinematic-ya", "contentRating": "ya-fantasy", "frames": [{ "id": "frame_01", "startSeconds": 0.0, "prompt": "A determined apprentice discovers a silver thread beneath an ancient tree at night." }] },
    "18+": { "stylePreset": "cinematic-concept", "contentRating": "adult-fantasy", "frames": [{ "id": "frame_01", "startSeconds": 0.0, "prompt": "An adult apprentice discovers an intricately woven silver thread beneath an ancient tree." }] }
  },
  "progress": { "completedSteps": ["upload", "transcription", "storyboard"], "currentStep": "image-generation", "percent": 58 },
  "export": { "status": "not-ready", "exportId": null, "fileName": null, "sizeBytes": null, "sha256": null, "expiresAt": null, "downloadPath": null },
  "notification": { "status": "not-queued", "providerMessageId": null }
}
```

### Mode 3 — Education & Schooling feed

```json
{
  "mode": "education-feed",
  "feedId": "feed_10_13_zu",
  "ageTier": "10-13",
  "language": "zu",
  "dialectOverlay": "curator-supplied-label",
  "generatedAt": "2026-11-04T08:30:00Z",
  "items": [
    {
      "storyId": "story_001",
      "title": "The River Crossing",
      "creatorAttribution": "Nandi M.",
      "contentRating": "family-adventure",
      "curationStatus": "approved",
      "tierVariant": {
        "ageTier": "10-13",
        "stylePreset": "adventure-graphic-novel",
        "editorialSummary": "A curious child follows a bird toward the river.",
        "captions": [{ "startSeconds": 0.0, "endSeconds": 4.2, "text": "...", "language": "zu", "dialect": "curator-supplied-label", "kind": "original", "sourceSegmentIds": ["seg_001"] }],
        "keyframes": [{ "id": "kf_10_13_001", "startSeconds": 0.0, "endSeconds": 4.2, "imageUrl": "https://media.example.test/10-13/001.webp", "altText": "A child follows a bird toward a river." }]
      },
      "offline": { "isSaved": false, "estimatedBytes": 18400000 }
    }
  ],
  "availableAgeTiers": ["5-9", "10-13", "14-17", "18+"]
}
```

## 8. API route structure

All routes are under `/api/v1`; request and response bodies are schema-validated, authenticated routes authorize the resource owner, and long work returns a job ID instead of holding an HTTP request open.

| Method + route | Purpose |
|---|---|
| `POST /uploads` | Create an upload record and return scoped upload URL, constraints, and `uploadId`. |
| `POST /uploads/:uploadId/complete` | Verify uploaded object metadata/checksum and mark it ready for a job. |
| `POST /stories` | Start Mode 1 transcription/storyboard/generation job; accepts idempotency key. |
| `GET /stories/:storyId` | Fetch approved story metadata and variants allowed to the caller. |
| `PATCH /stories/:storyId/review` | Save transcript/keyframe/tier corrections; creator/editor authorization required. |
| `POST /stories/:storyId/publish` | Publish reviewed variants for explicitly selected tiers. |
| `GET /feed?ageTier=10-13&language=zu&cursor=...` | Return only approved feed variants and a cursor. |
| `POST /creator-jobs` | Start Mode 2 job and return `202` plus job ID/status URL. |
| `GET /jobs/:jobId` | Poll job state, progress, and recoverable error summary. |
| `POST /exports/:exportId/download-link` | Authorize owner and mint a short-lived download URL. |
| `POST /jobs/:jobId/retry-notification` | Retry email only; do not rerun generation. |
| `DELETE /stories/:storyId` / `DELETE /creator-jobs/:jobId` | Start deletion/retention workflow for owned content and source assets. |
| `POST /webhooks/email/:provider` | Receive verified delivery/bounce/complaint events idempotently. |

Do not expose raw model provider credentials or accept arbitrary provider URLs. Enforce duration, bytes, MIME, rate, account quota, content ownership, and upload expiry server-side. Avoid returning signed URLs in generic logs or analytics.

## 9. Roadmap and phase exits

### Phase 1 — Scaffolding & Responsive Layout

**Scope:** Vite React TypeScript app shell; Tailwind styles/tokens; responsive mode navigation; placeholders for Mode 1 record/review/player, Mode 2 creator studio/job status, and Mode 3 feed/tier selection; typed mock contracts; accessible empty/loading/error/offline UI.

**Exit:** All three routes are navigable at mobile and desktop widths; tier selector has exactly four canonical values; shared player and cards have accessible names/keyboard focus; frontend has no provider secrets or direct AI calls.

### Phase 2 — Audio Engine & Sync Hook

**Scope:** one audio controller, supported-format detection, recording/upload draft state, cue timeline, frame selection and caption synchronization, image prefetch/decode, seek/visibility/stall handling, manual transcript/keyframe correction surface.

**Exit:** Playback and seeking always derive the visible frame/caption from `currentTime`; switching slides does not recreate audio; failures retain a usable fallback; story timelines reject invalid ordering/out-of-duration keyframes; UI updates only on discrete cue changes.

### Phase 3 — Creator Studio & Export/Email Pipeline

**Scope:** API/job schemas; upload signing; durable queue; provider adapters; transcription/storyboard/image steps; per-step retries; ZIP manifest; protected download-link flow; email outbox, idempotency, provider events, expiry/deletion.

**Exit:** A creator can follow a job through failure/retry to ready, download the complete manifest package through an authorized expiring link, and request a new notification without regenerating assets.

### Phase 4 — Discovery & Multi-Tier Feeds

**Scope:** curated feed API; tier-specific adaptation/review; language/dialect caption selection; content review and publish controls; offline-save UI and bounded service-worker caching; analytics that avoid raw sensitive audio/transcript payloads.

**Exit:** Feed never returns a missing/unreviewed age variant; changing tier changes the selected text, captions, rating, and art variant; an explicitly saved story works offline within documented storage limits; storytellers/curators have consent, attribution, and removal paths.

### Decisions before implementation

- Select production hosting, database/queue, object store/CDN, and transactional email provider.
- Confirm which transcription model/languages meet the dialect requirements and whether timestamps are supplied natively or need a separate alignment workflow.
- Establish maximum recording length, generated frames per story/tier, archive size, retention period, and generation retry/cost budgets.
- Define who can approve each age tier and which regions/school privacy requirements apply to launch.
