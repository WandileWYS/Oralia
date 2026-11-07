# Oralia Research and Gap Analysis

Maintained production decisions, 8 November 2026. Implementation contracts are in ARCHITECTURE.md; this document records evidence, tradeoffs, and remaining operational verification.

## Audio and image precision

A single `HTMLAudioElement.currentTime` is the clock. Browser `timeupdate` frequency varies with load, typically around 4–66 Hz; it cannot guarantee a boundary update on every display frame. While playing visibly, one `requestAnimationFrame` loop reads the media clock and updates React only when the active scene changes. Media events handle pause, seeking, duration, buffering, and rate changes; foreground return recomputes immediately. Ready, decoded imagery can swap on the next available paint, without a literal zero-latency guarantee. [MDN timeupdate](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/timeupdate_event), [MDN currentTime](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/currentTime), [MDN requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame)

Use continuous half-open scene ranges. Exact-boundary seeking selects the scene beginning there. Prefetch/decode the next images, retain the previous image if loading fails, and keep captions/narration available. Disable duration-dependent controls until finite metadata arrives. Stop the paint loop on unmount/pause/hidden tabs and release recording streams and object URLs.

Gemini's proposed image times are narrative suggestions. Once the polished text replaces the source narration, source timestamps no longer describe the final track. Oralia synthesizes four PCM segments at 24 kHz, mono, 16-bit and measures actual sample counts. Final starts/ends and assembled duration use these samples. Cloudinary may rewrite WAV metadata; sample content and rate must remain intact. Preserve proposed timestamps separately for provenance.

Transcription model capabilities and size/format constraints differ. The application limit is five minutes / 20 MB, below the documented completed-file transcription cap. Transcription is not used to fabricate polished-track timing. [OpenAI speech-to-text](https://developers.openai.com/api/docs/guides/speech-to-text), [OpenAI text-to-speech](https://developers.openai.com/api/docs/guides/text-to-speech)

## Real authentication

Nodemailer provides the Node equivalent of the requested SMTP transport: Gmail `smtp.gmail.com:587`, required STARTTLS, TLS certificate validation, and Oralia display name. Do not report delivery before SMTP acceptance or issue a session after failure. SMTP acceptance does not prove inbox placement. [Nodemailer SMTP transport](https://nodemailer.com/smtp)

Random six-digit codes are keyed-hashed, expire after ten minutes, permit five attempts, and are consumed once. Persist email/IP rate limits and sixty-second resend cooldown in Turso. Database-backed opaque sessions use HttpOnly, SameSite cookies and Secure cookies in production. Legacy simulated credentials are revoked at cutover; browser bearer storage is removed. Stable AUTH_SECRET configuration is necessary across serverless instances/deployments.

## Structured production generation

The exact Gemini `gemini-3.5-flash-lite` model receives culturally conservative instructions and a strict four-scene JSON schema. Reject missing, blocked, empty, inconsistent, or oversized output. Keep original text/transcript, polished text, prompts, language, and provenance. The joined narration must equal the polished story. Structured output still requires runtime semantic validation. [Gemini structured output](https://ai.google.dev/gemini-api/docs/structured-output)

OpenAI provides real transcription, `tts-1-hd` narration, and scene images (initial configured image model `gpt-image-2.5-sunburst`). Missing keys/model access must produce explicit job failures. No sample narration, fabricated success, pre-curated replacement photos, or placeholder illustrations may complete a failed generated story. Provider mocks are restricted to isolated tests. [OpenAI image generation](https://developers.openai.com/api/docs/guides/image-generation)

A confirmed transient failure can retry within a bounded budget. A dropped connection after a potentially accepted paid request is indeterminate: reserve asset identities, recover completed stored results where possible, and require explicit creator review if completion is unknown. Repeating a paid request blindly may duplicate charges. Completed stages remain persisted across workflow restarts.

## Literary collections and visual continuity

| Collection | Prompt direction | Editorial responsibility |
|---|---|---|
| Folk & Fable | Warm illustrated folklore; expressive characters, clear silhouettes, coherent natural light, gentle palette; preserve cultural/source specificity | Review moral claims and historical context; no automatic classroom suitability claim |
| Epic & Chronicle | Cinematic editorial composition, layered environments, considered contrast, historical depth and visual restraint | Review chronology, ancestry, cultural representation, conflict and invented detail |

Apply a common visual bible across four prompts: named character descriptions, consistent clothing/environment, palette, medium, perspective and recurring objects. Keep literary collection separate from region, tradition, language, consent, and content review. Do not invent translations or imply endorsement by a community. Existing historical adaptations preserve their sources and the distinction between editorial photographs and newly generated illustrations.

## Durable storage, publication, and export

Vercel Workflow sequences short durable steps; store job IDs and references rather than large binary payloads. Nitro's Vite integration supplies API and internal Workflow routes while producing Vercel Build Output. Do not overlay a SPA rewrite on API or Workflow paths. [Vercel Workflow Vite setup](https://useworkflow.dev/docs/getting-started/vite)

Cloudinary is the selected media provider. Signed direct source uploads use authenticated delivery and reserved owner-scoped IDs. Completion must be verified server-side against actual resource/type/format/size/duration. Draft previews and exports require owner authorization and expiring private delivery; publish complete reviewed media to versioned public playback paths. Test real account ZIP settings, audio byte-range delivery, and source privacy separately. [Cloudinary authenticated delivery](https://cloudinary.com/documentation/control_access_to_media)

Exports come from immutable database versions, with prompts, measured boundaries, media, transcripts and checksums. Package once, store the archive, then send a stable owner-authenticated app link that mints an expiring download. Notification failure never changes a ready archive into a failed generation job. SMTP has no provider idempotency contract: concurrent claims reduce duplicates, but an interrupted accepted send needs reconciliation. The earlier R2/Resend research remains a useful comparison, not the selected runtime. [R2 presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/), [Resend email API](https://resend.com/docs/api-reference/emails/send-email)

Prisma retains its SQLite provider with the libSQL adapter. Cloud schema changes use explicit authenticated SQL and checksums; do not expect local Prisma CLI db-push to target remote Turso. Preserve lazy client construction and fail clearly when hosted variables are missing. [Prisma SQLite/Turso](https://docs.prisma.io/docs/orm/v7/core-concepts/supported-databases/sqlite)

## Connectivity and offline scope

Current bookmarks save references, not audio. Offline media downloads and service-worker caching remain deferred. A future explicit save-for-offline flow must bound bytes/entries/age, report partial downloads, handle storage quota/eviction, version caches, and support audio range responses. Never share authenticated responses or signed URLs across accounts. `navigator.onLine` alone is not evidence a request will work. [Workbox cached audio/video](https://developer.chrome.com/docs/workbox/serving-cached-audio-and-video), [Workbox storage quota](https://developer.chrome.com/docs/workbox/understanding-storage-quota)

Network or codec failure displays retry and transcript access, not substitute content. Runtime checks recorder MIME support; original uploads vary across Safari, Chromium and Firefox. Test mobile seeking, background/foreground, output route changes, and constrained memory, particularly for uncompressed narration.

## Operational gaps and verification gates

- A passing isolated suite verifies contracts with mocked providers, not paid account/model access or inbox receipt. A real integration run must cover SMTP verification, STT, structured polishing, four images, measured narration, persistence, playback, publication and authorized ZIP download.
- Real OpenAI calls may be deliberately skipped while the user configures credentials; report that gap and fail affected runtime operations clearly. Never mark generation verified based on fixture output.
- Vercel environment secrets, Workflow availability, function limits, and live routing require hosted verification after deployment. Builds and Prisma generation must not contact a database.
- Preserve accounts/bookmarks/catalog during migration, but revoke simulated sessions/challenges. Back up before cloud schema writes and refuse unexpected schemas.
- Retention/cleanup of abandoned private drafts, operator reconciliation of indeterminate provider/dispatch/send outcomes, school editorial processes, and offline PWA delivery need explicit operational ownership.
- Public media promotion can complete before its catalog transaction; failed publication can leave unlisted versioned assets. Retry should recover these copies. Long-term cleanup must avoid removing assets referenced by published versions or completed exports.
