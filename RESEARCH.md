# Oralia — Research & Gap Analysis

**Status:** Research baseline with local Phase 4 implementation notes
**Reviewed:** 5 November 2026
**Scope:** Browser playback and offline behavior, creator exports, age-tier prompt design, and operational gaps. Production recommendations are distinguished from the implemented local system below.

## Local Phase 4 findings

- **Database boundary:** Prisma/SQLite runs in TypeScript Vite dev/preview middleware under /api/v1. React consumes validated JSON; there is no Prisma import or catalog fixture fallback in the browser. Migration, db push and idempotent seeding are part of local setup. The seed preserves user bookmarks/accounts; migration and API tests use a separate temporary database.
- **Authenticity and scope:** Eight abridged English adaptations identify their historical collection, region and cultural limitations. The sources include Barker/Sinclair's [West African Folk-Tales](https://www.gutenberg.org/files/66923/66923-h/66923-h.htm), Honey's [South-African Folk-Tales](https://www.gutenberg.org/cache/epub/38339/pg38339-images.html), and [Swahili Tales](https://en.wikisource.org/wiki/Swahili_Tales). Historical translations are not substitutes for contemporary community review. Do not label the southern African tink-tinkje tale as Zulu merely because both appear in a regional collection. Story-specific source notes travel to the Listening Room and export manifest.
- **Audio provenance:** The bundled speech is Windows-synthesized English, marked STUDIO_AI, with measured PCM cue ranges. No original author microphone recordings or reviewed dialect translations are supplied. Seed age assignments support UI curation and are not formal school approvals. The four visual tiers preserve the same source narration rather than falsely claiming age-specific spoken adaptations.
- **Failure behavior:** A local media availability endpoint avoids requesting a missing audio URL. Web Audio can render a quiet timing tone into a WAV blob; the normal HTML audio element then remains the only clock. Explicitly label the tone as non-narration, cancel stale synthesis work after source changes, and release blob URLs. Image errors preserve narration/transcript and the scene title. A missing database produces a visible retry state, never unrelated stories.
- **Authentication simulation:** The requested email/PIN flow intentionally accepts any six digits and sends no email. Single-use five-minute challenges, hashed seven-day sessions, reserved collection addresses and account-scoped bookmark/voice writes support realistic local behavior; they do not verify email ownership. Persisting this requested simulator session in localStorage is a presentation contract, not a production identity design.
- **Interaction audit:** Include nested Escape behavior, session/bookmark reload recovery, all 32 scene boundaries, both playback voice choices, missing-media tone playback, empty regional intersections, ZIP payload integrity, mobile header width and reduced motion. Offline PWA downloads, durable drafts, AI generation and real transactional email remain separate production work.

## Executive findings

1. Treat the `HTMLAudioElement` timeline as the playback clock. `timeupdate` is adaptive and can arrive only about 4–66 times per second, so it is not precise enough by itself for slide boundaries. Poll `currentTime` with `requestAnimationFrame` while playing, but publish React updates only when the active keyframe changes. With an image already fetched and decoded, the visual can change on the next paint; browser scheduling, timer precision, and image decode mean this is near-frame sync, not a literal zero-latency guarantee. [MDN: `timeupdate`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/timeupdate_event), [MDN: `currentTime`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/currentTime), [MDN: `requestAnimationFrame`](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame), [React: `useSyncExternalStore`](https://react.dev/reference/react/useSyncExternalStore)
2. Make Mode 2 a durable asynchronous job. Store generated assets privately, package them into a ZIP, and email a link that can mint a short-lived download URL. Keep the archive out of the normal email path; MIME encoding increases size and each email provider and recipient mailbox has its own limits. [Cloudflare R2: presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/), [Resend: sending attachments](https://resend.com/docs/api-reference/emails/send-email)
3. Use a shared visual bible and four explicit age-tier style modifiers. Keep visual style separate from story age rating and content safety. Generate and curate each tier variant; do not treat a style prompt or moderation score as proof that content is suitable for children. [OpenAI: Image generation](https://developers.openai.com/api/docs/guides/image-generation), [OpenAI: Moderation](https://developers.openai.com/api/docs/guides/moderation)
4. Offline playback needs an explicit “save story” contract. Cache the app shell and metadata by default, but cache substantial audio only when the user asks for offline access. Bound and expire media caches, check storage estimates, support range requests for cached audio, and show an offline/partial-download state. [Workbox: serving cached audio and video](https://developer.chrome.com/docs/workbox/serving-cached-audio-and-video), [Workbox: storage quota](https://developer.chrome.com/docs/workbox/understanding-storage-quota)

## 1. Audio-image synchronization

### Recommended timing model

- **One clock:** The audio element's `currentTime` is authoritative for playback, seek, playback-rate changes, and resume. Keep keyframe times in seconds relative to the same audio asset. Avoid a second accumulating JavaScript clock; it diverges during pauses, stalls, seeking, backgrounding, and rate changes.
- **Half-open intervals:** Store sorted keyframes with `startSeconds` and optional `endSeconds`; a frame is active on `[startSeconds, endSeconds)`. At any time, select the latest keyframe whose start is at or before `currentTime`. Specify a poster/fallback before the first keyframe and a final-frame behavior after the last one.
- **Two update paths:** While playing in a visible tab, run one `requestAnimationFrame` loop that reads `audio.currentTime` and computes the active keyframe. Publish only when the keyframe index changes. Also recompute on `play`, `pause`, `seeking`, `seeked`, `loadedmetadata`, `durationchange`, `ratechange`, `waiting`, `playing`, and `ended`; recompute on `visibilitychange` when the page becomes visible. Cancel the loop while paused, ended, or unmounted.
- **Do not render the clock:** Avoid `setState(currentTime)` on every animation frame or `timeupdate`. Keep high-frequency clock reads in a playback controller/ref; expose a stable snapshot such as `activeKeyframeId`, playback state, and duration to React. `useSyncExternalStore` is a suitable bridge when using an external controller; its `getSnapshot` must return a cached/stable value when nothing changed.
- **Prepare images ahead:** Fetch the first image before allowing playback to start, then prefetch and decode the next one or two keyframes. Retain the previous image until the next image is ready, rather than flashing an empty frame. Use responsive image sizes and a small placeholder/blur state on slow links.
- **Seek behavior:** A seek immediately reads the destination time and activates the matching frame. Do not wait for a future `timeupdate`. A drag scrubber may update its thumb locally while dragging; on commit, seek the audio element and derive the final slide from the media clock.

`currentTime` is an approximation and its observed update frequency depends on the browser and media pipeline. `timeupdate` frequency varies with system load; `requestAnimationFrame` is paint-aligned and can be throttled in background tabs. Consequently, target a visually correct next paint after a boundary in an active tab, not a hard real-time deadline. Mobile decoding, memory pressure, and a newly fetched image can add visible delay even if the index calculation is exact.

### Timestamp quality is upstream of React

AI-generated story beats should not invent precise timestamps. Start with transcription segments or word-level timestamps where the chosen transcription model supports them, ask the storyboard step to select from/anchor to those time ranges, and validate every keyframe against the audio duration and monotonic ordering. Provide an editor to adjust frame boundaries and transcript captions before publication. Transcription support, formats, model names, and file caps change; the current OpenAI speech-to-text guide lists a 25 MB completed-file cap and supported formats, and describes timestamp granularity and model-specific constraints. [OpenAI: File transcription](https://developers.openai.com/api/docs/guides/speech-to-text)

### Timing edge cases to represent

| Case | Required behavior |
|---|---|
| `duration` is `NaN` or `Infinity` before metadata | Disable duration-dependent controls; initialize only after `loadedmetadata` and handle `durationchange`. |
| Keyframe time is negative, beyond duration, unsorted, or duplicated | Reject/repair during server validation; never let malformed model output reach the player. |
| Gap at the beginning or between frames | Define a poster/hold-last-frame rule. Never render an accidental blank. |
| Seek lands exactly on a boundary | Use `[start,end)` consistently and select the frame beginning at that time. |
| Buffering / `waiting` | Freeze the image; keep it tied to current media time. Resume timing from `playing`. |
| Playback rate changes | Read `currentTime`; do not scale a separate timer. |
| Audio ends or loops | Resolve the final frame, and on loop reset to the frame at time zero. |
| Tab background/foreground or mobile app switch | Stop expensive frame polling when hidden; recompute from `currentTime` on return. |
| Browser pauses audio due to gesture/power policy | Keep a clear user-initiated play affordance and report actual media state. |
| Image request/decode fails | Retain prior frame or show a designed fallback; retry without stopping audio. |
| Audio seek on CDN/storage | Verify byte-range requests (`206 Partial Content`, `Content-Range`) and CORS where cross-origin; otherwise seeking may be slow or unavailable. |

## 2. Creator export and email pipeline

### Proposed job flow

1. The creator submits a pitch and requested deliverables. The API creates a `creatorJob` and an idempotent processing record, then returns `202 Accepted` with the job ID and status URL.
2. Upload the recording to private object storage through a server-minted, short-lived upload URL. Persist the storage key, checksum, content type, consent/rights metadata, and retention deadline; keep provider secrets on the server.
3. A worker transcribes the pitch, extracts a storyboard, creates image prompts and prototype images, and validates the outputs. Store each step's state and retryable error separately so a failed image does not require retranscribing the pitch.
4. A packaging worker creates a versioned ZIP containing the storyboard JSON, transcript/captions (when selected), prompt manifest, generated images, and a short README with asset filenames and usage notes. Include a manifest with content types, sizes, and checksums. Store the ZIP privately.
5. Write an email notification to a transactional outbox in the same database transaction as the job's `ready` transition. A sender worker sends a short message with the project name, expiry, and a link to an authenticated download page. The page checks the creator's authorization and requests a fresh, short-lived signed URL.
6. Record delivery-provider message ID and status. Retry transient rate-limit/server/network failures with bounded exponential backoff and jitter; use a stable idempotency key. Keep a dead-letter/manual-retry state for exhausted failures. Email failure must not erase a ready export.

### Why the link should be the default

Large image bundles can exceed the sender's limit after Base64/MIME overhead, then be rejected by the recipient's mail service. Even when an attachment fits, email is a poor asset store. A signed URL grants time-limited access to one object without exposing storage credentials; protect the ZIP with private-by-default storage, a short expiry, authorization before URL minting, and an explicit deletion/retention policy. Avoid placing a long-lived public URL in email or logs. [Cloudflare R2: presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/)

If a provider such as Resend is selected, keep it behind an `EmailProvider` adapter and re-check its live message-size, attachment, idempotency, and rate-limit rules before launch. Its send API supports attachments and idempotency keys, but that does not remove recipient-side attachment limits. [Resend: send email](https://resend.com/docs/api-reference/emails/send-email), [Resend: API feature overview](https://resend.com/features/email-api)

### Export states and operations

`queued → transcribing → planning → generating → packaging → ready → expired`; any active state may enter `retrying` or `failed`. Keep email status separate: `pending → sent → delivered | bounced | complained | failed`. Store provider event IDs, but do not log signed URLs or raw audio/transcripts by default. Users should be able to retry a notification without rerunning generation, request a fresh download link, and delete a project and its retained source assets.

## 3. Multi-tier age-targeted prompt engineering

### Prompt construction

Build each image prompt from fixed, reviewable fields rather than concatenating raw transcript text without boundaries:

1. **Story beat:** one concise, literal description of the moment, extracted from approved story content.
2. **Cultural and historical grounding:** user/curator-supplied region, community, period, setting, clothing, objects, and language. If unknown, ask for a neutral setting; do not fill gaps with a generic “African” look or invented sacred symbols.
3. **Character/style bible:** approved recurring-character descriptions, age, clothing, key colors, camera distance, lighting, palette, aspect ratio, and image references where available.
4. **Tier modifier:** exactly one of the reviewed style profiles below.
5. **Safety/content envelope:** story rating and allowed/intensity constraints, independent of style. If a story is not appropriate for a tier, exclude it or route it for human adaptation; do not try to make an unsuitable plot safe by changing its art style.
6. **Output constraints:** single carousel image, consistent crop-safe subject placement, no embedded text/logos/watermarks, plus a text alt description generated and reviewed separately.

Use a persistent visual bible or reference image for recurring characters and style continuity. Image generation can still vary character details across generations; the prompt alone does not guarantee a character match. Budget for human review, retries, and corrections. [OpenAI: Image generation limitations and reference images](https://developers.openai.com/api/docs/guides/image-generation)

### Reviewed style modifiers

These are proposed starting modifiers to A/B and curate; they are not a substitute for age-rating rules.

| Tier | Style modifier | Tone and constraints |
|---|---|---|
| **5–9** | “Vibrant picture-book illustration, soft gouache and watercolor textures, rounded readable shapes, warm clear palette, expressive friendly faces, simple uncluttered composition, gentle wonder, soft light.” | Reassuring, concrete, visually legible. Keep peril mild and brief; avoid graphic injury, frightening close-ups, sexualized depictions, or realistic weapons. Prefer a resolved or reassuring image when a beat contains danger. |
| **10–13** | “Adventure graphic-novel / illustrated chapter-book look, confident ink contours, expressive poses, layered but readable setting, energetic framing, bold controlled color palette, cinematic page-illustration composition.” | Curiosity, agency, teamwork, and discovery. Suspense may be moderate, but depict harm non-graphically and avoid adult sexual themes or glamorized violence. |
| **14–17** | “Cinematic YA graphic-novel realism, painterly environmental detail, expressive character acting, nuanced light and shadow, dynamic but coherent framing, emotionally complex mood, grounded visual texture.” | Allow complex stakes and ambiguity while keeping violence non-graphic and sexual content non-explicit/non-exploitative. Avoid presenting stereotypes as shorthand for a character or community. |
| **18+** | “Mature cinematic concept art, high-detail material and environmental rendering, historically grounded props and architecture, deliberate composition, atmospheric lighting, layered visual symbolism, emotionally nuanced adult tone.” | Permit historical depth and difficult themes where separately rated and reviewed. “18+” is not a blanket permission for disallowed sexual, exploitative, or graphic content; keep the platform's safety policy in force. |

### Dialect and subtitle handling

- Keep the original-language transcript, normalized/translated subtitles, dialect label, and editorial corrections as separate fields. Never overwrite the source utterance with a normalized form.
- Let curators tag spelling/pronunciation variants and correct names, proverbs, and culturally specific vocabulary. A language model's confidence is not evidence that a dialect transcription is correct.
- Store caption start/end times in the same audio timeline used by the carousel; provide a transcript correction flow and a visible distinction between original-language text and translation.
- Generate alt text per tier variant and language. Do not use image prompt text as the accessibility description.

## 4. Resilience and offline behavior

### Cache layers and policies

| Data | Suggested storage/policy | Reason |
|---|---|---|
| Hashed JS/CSS/app shell | Service-worker precache; deploy content-hashed assets and prune old cache versions | Allows app launch offline without serving stale unversioned code. |
| Feed/story metadata | IndexedDB or Cache Storage; network-first for discovery, cached snapshot as offline fallback | Fresh feeds when available, readable saved metadata without a connection. |
| Story images | Cache Storage runtime cache with max-entry/age limits; fetch the current and next frame early | Images are reusable but can consume quota quickly. Do not cache unbounded public feed browsing. |
| Audio | Explicit “save for offline” action; store complete media response/blob and metadata in bounded storage; show progress and size | Long audio is large. Cache only assets a user requested or a deliberate small preview. |
| Unsent recording/job draft | IndexedDB outbox with retry state and upload resumption where supported; user can retry when online | `navigator.onLine` is only a hint; the actual request outcome is authoritative. Never silently discard a recording. |
| Auth tokens / secrets | No secrets in Cache Storage, URLs, or persisted client logs | Prevent credential exposure and accidental sharing. |

Use Workbox or equivalent to manage service-worker precaching, runtime cache versions, expiry, and quota cleanup. Storage limits vary by browser and device; inspect `navigator.storage.estimate()` and treat persistence requests as requests, not guarantees. For cached audio/video, configure and verify range handling rather than assuming every cached full response will satisfy a seek request correctly. Cross-origin opaque responses can use unexpectedly large quota accounting. [Workbox: service-worker deployment](https://developer.chrome.com/docs/workbox/service-worker-deployment), [Workbox: audio/video range requests](https://developer.chrome.com/docs/workbox/modules/workbox-range-requests), [Workbox: storage quota](https://developer.chrome.com/docs/workbox/understanding-storage-quota)

### Low-connectivity product behavior

- Offer a lightweight image rendition first; only request higher resolution when appropriate. Compress story art and expose file sizes before offline downloads.
- Prefetch one or two upcoming images, not an entire unbounded feed. Prioritize the audio and current frame.
- Show separate states for offline, queued upload, partial download, unavailable asset, and expired export. Keep player controls usable when art fails.
- For background upload, use a durable local outbox and resume on app focus/network recovery. Browser Background Sync support is uneven, so it must not be the only retry mechanism.
- Preserve an export request if email delivery is unavailable. Let the creator return to a job-status page and retrieve a fresh link.
- Keep object storage and CDN headers correct: media MIME type, byte ranges, cache-control, CORS, and signed-link expiration. Test with a real seek and a cold cache, not just a full download.

## 5. Additional gaps and decisions to close

| Gap | Failure mode | Product/architecture decision |
|---|---|---|
| Recording format differs by browser | Safari/iOS, Chromium, or Firefox may produce different containers/codecs; upload can fail at transcription or replay. | Probe `MediaRecorder.isTypeSupported()` at runtime, record the actual MIME type and extension, retain the original, normalize server-side when needed, and provide a tested fallback. MDN cautions that a supported type does not guarantee recording succeeds under resource pressure. [MDN: `MediaRecorder.isTypeSupported`](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/isTypeSupported_static) |
| Codec/container assumptions | Opus-in-WebM/Ogg support differs across older Safari versions; MP3 playback is broad but WebCodecs encoding support is a different question from HTML audio playback. | Use `canPlayType()`/capability checks for uploaded assets, serve a broadly compatible playback rendition (MP3 or AAC/MP4 as selected after device testing), and retain an original archival object. Offer more than one source when needed. [MDN: audio codecs](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Audio_codecs), [MDN: media containers](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Containers) |
| Transcription size, dialect, and names | A large recording exceeds an API cap; transcription may flatten code-switching, names, or dialects; keyframes then drift from the spoken story. | Upload/compress or split safely at silence/sentence boundaries, preserve chunk offsets, provide language/context hints only where supported, and require correction for publishable captions and timestamps. Current transcription APIs have model-specific formats and limits. [OpenAI: File transcription](https://developers.openai.com/api/docs/guides/speech-to-text) |
| Repeated character drift | Main character clothing, age, body shape, or skin tone changes between images. | Maintain a reusable character bible/reference image, generate/select a key character reference first, keep prompt version and reference IDs in metadata, and allow per-frame human replacement. |
| Unsafe or unsuitable generated image | Tier label is mistaken for content review; model output differs from the prompt. | Moderate text and images, apply an explicit per-tier editorial policy, route uncertain outputs to human review, and hide unreviewed school-feed content. OpenAI states its moderation endpoint does not classify audio and is not a CSAM detection or response system. [OpenAI: Moderation](https://developers.openai.com/api/docs/guides/moderation) |
| Child accounts and school privacy | Audio may identify a child, school, location, or family; recordings and transcripts may be retained longer than intended. | Prefer educator-managed/guardian-approved accounts for school use, collect the minimum identifiers, document consent and deletion/retention controls, and complete jurisdiction-specific child-privacy review before launch. This document does not determine legal compliance. |
| Cultural rights and attribution | Oral stories may be restricted, sacred, community-owned, or shared without permission; AI may invent “authentic” details. | Capture storyteller consent, attribution preference, source community/region when supplied, rights/license, reuse scope, takedown contact, and whether AI adaptation is allowed. Add a curator correction and dispute path. |
| Offline quota, stale data, or token leakage | User storage fills; old tier variant remains cached; a signed URL appears in logs/history. | Bound cache sizes, use content/version keys, expire entries, do not cache signed export URLs, and keep audio and export retention separate. |
| Duplicate/retried jobs | Mobile reconnects resend a pitch; worker/email retry creates duplicate assets or notifications. | Require client idempotency keys, idempotent worker steps, transactional outbox, and deduplication keys for provider calls. |
| Cost and latency runaway | Unbounded keyframe count or repeated image retries multiplies generation cost and delays delivery. | Cap audio length, frame count, output resolution, retry count, and concurrent jobs; expose status and expected next step; allow cancel/delete. |
| Accessibility and presentation | A visual-only carousel excludes users; motion or autoplay is unpleasant or inaccessible. | Provide captions/transcript, narration controls, descriptive alt text, keyboard-accessible previous/next, reduced-motion support, visible focus, and no forced autoplay with sound. |
| API secrets and upload abuse | A browser bundle exposes the model API key or permits oversized uploads. | Keep AI/email/storage credentials server-side; mint scoped uploads; enforce MIME, byte, duration, ownership, rate, and quota checks; scan and validate server-side. |

## References

- [MDN: `HTMLMediaElement.currentTime`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/currentTime)
- [MDN: `timeupdate`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/timeupdate_event)
- [MDN: `requestAnimationFrame`](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame)
- [React: `useSyncExternalStore`](https://react.dev/reference/react/useSyncExternalStore)
- [MDN: `MediaRecorder.isTypeSupported`](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/isTypeSupported_static)
- [MDN: audio codecs](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Audio_codecs)
- [OpenAI: speech-to-text](https://developers.openai.com/api/docs/guides/speech-to-text)
- [OpenAI: image generation](https://developers.openai.com/api/docs/guides/image-generation)
- [OpenAI: moderation](https://developers.openai.com/api/docs/guides/moderation)
- [Workbox: serving cached audio and video](https://developer.chrome.com/docs/workbox/serving-cached-audio-and-video)
- [Cloudflare R2: presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/)
- [Resend: send email API](https://resend.com/docs/api-reference/emails/send-email)
