# Oralia Research and Gap Analysis

Maintained production decisions, 8 November 2026. Implementation contracts are in ARCHITECTURE.md; this document records evidence, tradeoffs, and remaining operational verification.

## Audio and image precision

A single `HTMLAudioElement.currentTime` is the clock. Browser `timeupdate` frequency varies with load, typically around 4–66 Hz; it cannot guarantee a boundary update on every display frame. While playing visibly, one `requestAnimationFrame` loop reads the media clock and updates React only when the active scene changes. Media events handle pause, seeking, duration, buffering, and rate changes; foreground return recomputes immediately. Ready, decoded imagery can swap on the next available paint, without a literal zero-latency guarantee. [MDN timeupdate](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/timeupdate_event), [MDN currentTime](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/currentTime), [MDN requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame)

Use continuous half-open scene ranges. Exact-boundary seeking selects the scene beginning there. Prefetch/decode the next images, retain the previous image if loading fails, and keep captions/narration available. Disable duration-dependent controls until finite metadata arrives. Stop the paint loop on unmount/pause/hidden tabs and release recording streams and object URLs.

Gemini's proposed image times are narrative suggestions. Once the polished text replaces the source narration, source timestamps no longer describe the final track. Oralia synthesizes variable-length PCM segments at 24 kHz, mono, 16-bit and measures actual sample counts. Final starts/ends and assembled duration use these samples. Cloudinary may rewrite WAV metadata; sample content and rate must remain intact. Preserve proposed timestamps separately for provenance.

Transcription model capabilities and size/format constraints differ. The application limit is five minutes / 20 MB, below the documented completed-file transcription cap. Transcription is not used to fabricate polished-track timing. [OpenAI speech-to-text](https://developers.openai.com/api/docs/guides/speech-to-text), [OpenAI text-to-speech](https://developers.openai.com/api/docs/guides/text-to-speech)

## Real authentication

Nodemailer provides the Node equivalent of the requested SMTP transport: Gmail `smtp.gmail.com:587`, required STARTTLS, TLS certificate validation, and Oralia display name. Do not report delivery before SMTP acceptance or issue a session after failure. SMTP acceptance does not prove inbox placement. [Nodemailer SMTP transport](https://nodemailer.com/smtp)

Random six-digit codes are keyed-hashed, expire after ten minutes, permit five attempts, and are consumed once. Persist email/IP rate limits and sixty-second resend cooldown in Turso. Database-backed opaque sessions use HttpOnly, SameSite cookies and Secure cookies in production. Legacy simulated credentials are revoked at cutover; browser bearer storage is removed. Stable AUTH_SECRET configuration is necessary across serverless instances/deployments.

## Structured production generation

The exact Gemini `gemini-3.5-flash-lite` model receives culturally conservative instructions and a strict dynamic-scene JSON schema. Reject missing, blocked, empty, inconsistent, or oversized output. Keep original text/transcript, polished text, prompts, language, and provenance. The joined narration must equal the polished story. Structured output still requires runtime semantic validation. [Gemini structured output](https://ai.google.dev/gemini-api/docs/structured-output)

OpenAI provides real transcription, `tts-1-hd` narration, and scene images (initial configured image model `gpt-image-2.5-sunburst`). Missing keys/model access must produce explicit job failures. No sample narration, fabricated success, pre-curated replacement photos, or placeholder illustrations may complete a failed generated story. Provider mocks are restricted to isolated tests. [OpenAI image generation](https://developers.openai.com/api/docs/guides/image-generation)

A confirmed transient failure can retry within a bounded budget. A dropped connection after a potentially accepted paid request is indeterminate: reserve asset identities, recover completed stored results where possible, and require explicit creator review if completion is unknown. Repeating a paid request blindly may duplicate charges. Completed stages remain persisted across workflow restarts.

## Literary collections and visual continuity

| Collection | Prompt direction | Editorial responsibility |
|---|---|---|
| Folk & Fable | Warm illustrated folklore; expressive characters, clear silhouettes, coherent natural light, gentle palette; preserve cultural/source specificity | Review moral claims and historical context; no automatic classroom suitability claim |
| Epic & Chronicle | Cinematic editorial composition, layered environments, considered contrast, historical depth and visual restraint | Review chronology, ancestry, cultural representation, conflict and invented detail |

Apply a common visual bible across all scene prompts: named character descriptions, consistent clothing/environment, palette, medium, perspective and recurring objects. Keep literary collection separate from region, tradition, language, consent, and content review. Do not invent translations or imply endorsement by a community. Existing historical adaptations preserve their sources and the distinction between editorial photographs and newly generated illustrations.

## Durable storage, publication, and export

Vercel Workflow sequences short durable steps; store job IDs and references rather than large binary payloads. Nitro's Vite integration supplies API and internal Workflow routes while producing Vercel Build Output. Do not overlay a SPA rewrite on API or Workflow paths. [Vercel Workflow Vite setup](https://useworkflow.dev/docs/getting-started/vite)

Cloudinary is the selected media provider. Signed direct source uploads use authenticated delivery and reserved owner-scoped IDs. Completion must be verified server-side against actual resource/type/format/size/duration. Draft previews and exports require owner authorization and expiring private delivery; publish complete reviewed media to versioned public playback paths. Test real account ZIP settings, audio byte-range delivery, and source privacy separately. [Cloudinary authenticated delivery](https://cloudinary.com/documentation/control_access_to_media)

Foundry packages immutable submitted scripts and completed assets, with prompts, estimated or audio-measured boundaries, reference instructions and checksums. Existing story-version export requests retain read-only recovery support; new arbitrary version exports are retired. Package once, store the archive, then send a stable owner-authenticated app link that mints an expiring download. Notification failure never changes a ready archive into a failed generation job. SMTP has no provider idempotency contract: concurrent claims reduce duplicates, but an interrupted accepted send needs reconciliation. The earlier R2/Resend research remains a useful comparison, not the selected runtime. [R2 presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/), [Resend email API](https://resend.com/docs/api-reference/emails/send-email)

Prisma retains its SQLite provider with the libSQL adapter. Cloud schema changes use explicit authenticated SQL and checksums; do not expect local Prisma CLI db-push to target remote Turso. Preserve lazy client construction and fail clearly when hosted variables are missing. [Prisma SQLite/Turso](https://docs.prisma.io/docs/orm/v7/core-concepts/supported-databases/sqlite)

## Connectivity and offline scope

Current bookmarks save references, not audio. Offline media downloads and service-worker caching remain deferred. A future explicit save-for-offline flow must bound bytes/entries/age, report partial downloads, handle storage quota/eviction, version caches, and support audio range responses. Never share authenticated responses or signed URLs across accounts. `navigator.onLine` alone is not evidence a request will work. [Workbox cached audio/video](https://developer.chrome.com/docs/workbox/serving-cached-audio-and-video), [Workbox storage quota](https://developer.chrome.com/docs/workbox/understanding-storage-quota)

Network or codec failure displays retry and transcript access, not substitute content. Runtime checks recorder MIME support; original uploads vary across Safari, Chromium and Firefox. Test mobile seeking, background/foreground, output route changes, and constrained memory, particularly for uncompressed narration.

## Operational gaps and verification gates

- A passing isolated suite verifies contracts with mocked providers, not paid account/model access or inbox receipt. A real integration run must cover SMTP verification, STT, structured polishing, all scene images, measured narration, persistence, playback, publication and authorized ZIP download.
- Real OpenAI calls may be deliberately skipped while the user configures credentials; report that gap and fail affected runtime operations clearly. Never mark generation verified based on fixture output.
- Vercel environment secrets, Workflow availability, function limits, and live routing require hosted verification after deployment. Builds and Prisma generation must not contact a database.
- Preserve accounts/bookmarks/catalog during migration, but revoke simulated sessions/challenges. Back up before cloud schema writes and refuse unexpected schemas.
- Retention/cleanup of abandoned private drafts, operator reconciliation of indeterminate provider/dispatch/send outcomes, school editorial processes, and offline PWA delivery need explicit operational ownership.
- Public media promotion can complete before its catalog transaction; failed publication can leave unlisted versioned assets. Retry should recover these copies. Long-term cleanup must avoid removing assets referenced by published versions or completed exports.

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
