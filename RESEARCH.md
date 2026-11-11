# Oralia Research and Gap Analysis

Reviewed **11 November 2026** against repository contracts and the primary references below. [ARCHITECTURE.md](ARCHITECTURE.md) defines current interfaces; [README.md](README.md) covers setup; [AGENTS.md](AGENTS.md) defines the Research–Plan–Implementation workflow. Recommendations here are future work unless explicitly labeled implemented.

## Audio and image precision

**Implemented:** one HTML audio element supplies `currentTime`; a paint-aligned loop derives the active keyframe, while media events update playback/seek/metadata state. Scene intervals are half-open, seeks recompute directly, and prepared images swap without an accumulating application clock. Final synthesized boundaries come from measured 24 kHz PCM samples. Gemini offsets remain estimates; Foundry without TTS retains estimated timings.

`timeupdate` frequency varies with load, so it is unsuitable as the sole image-switch scheduler. Rendering, decoding, background throttling, and output-device latency still prevent a zero-latency guarantee. Preloading/decoding reduces visible stalls but increases memory and bandwidth. [MDN timeupdate](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/timeupdate_event)

**Gaps/tests:** exercise exact-boundary seeks, background/resume, playback rates, image decode failure, Safari codec/recorder variation, and low-memory devices. The phone-only full-screen dialog and touch controls do not replace physical-device keyboard, browser-chrome, or safe-area verification. Keep playback independent of React's render frequency and never replace missing narration with a timing tone.

## Structured production generation

**Implemented:** OpenAI transcribes submitted recordings; typed text bypasses STT. The application's five-minute/20 MiB recording limit is its own admission policy, not a statement of the provider's maximum. [OpenAI transcription guide](https://developers.openai.com/api/docs/guides/speech-to-text)

Gemini's configured `gemini-3.5-flash-lite` planner produces a context-aware `polishedTitle`, target language, ordered narration, and visual prompts. Blank/weak titles are generated; meaningful ones are localized. Original input/transcription remains preserved; the server derives polished/localized text from scenes. Zod checks output, language, lengths, references, and timeline consistency. JSON-schema conformance does not establish semantic or cultural correctness. [Gemini structured outputs](https://ai.google.dev/gemini-api/docs/structured-output)

Scene-count heuristics target roughly 15–30 seconds of narration per visual beat, within 1–64 scenes. Translated length, pronunciation, speech rate, and image complexity can change actual pacing. Measured narration, not planned timestamps, governs published synchronization. Foundry separately conditions planning/image edits on owned references and per-image notes.

## Literary collections and visual continuity

**Implemented:** Folk & Fable (`FOLK_AND_FABLE`) uses a warm illustrated-fable presentation; Epic & Chronicle (`EPIC_AND_CHRONICLE`) uses cinematic-chronicle framing. They are literary collections, separate from regional filters and editorial suitability. Current prompt guidance is not a general multi-style transformation service.

Both workspaces expose English `en`, isiZulu `zu`, isiXhosa `xh`, Swahili `sw`, Yoruba `yo`, Hausa `ha`, Afrikaans `af`, French `fr`, and Portuguese `pt`. Selection/localization does not certify native speech quality. The application flags isiZulu, isiXhosa, Yoruba, and Hausa as unverified; these are absent from OpenAI's published TTS language list. Preserve creator review and truthful AI disclosure. [OpenAI TTS guide](https://developers.openai.com/api/docs/guides/text-to-speech)

**Gap:** evaluate meaning preservation, names, dialect, pronunciation, consent, and visual continuity with qualified reviewers. Record evaluations by model/prompt/language version rather than treating successful requests as quality certification. Do not invent translations, cultural endorsements, or provenance.

## Real authentication and tenant boundaries

**Implemented:** real Gmail STARTTLS email codes, keyed hashes, expiry/attempt/resend limits, persistent email/IP throttling, and opaque HttpOnly cookie sessions. Authenticated operations check record ownership; public discovery requires no login. Turso holds one shared schema. Foundry namespaces and owner checks isolate application workflows, not database schemas.

**Gaps:** make owner-isolation regression coverage systematic across new routes and recovery tools; expand abuse detection and auditability. Institutional tenancy needs an explicit organization model and threat analysis before promising stronger isolation. Provider accounts, environment variables, cookie behavior, and authorization must be verified in the hosted runtime separately.

## Durable storage, publication, and export

**Implemented:** Vercel Workflow executes persisted jobs in durable steps, retaining completed assets and limiting paid media concurrency within each job. Confirmed transient failures have bounded retries; unknown paid outcomes become `INDETERMINATE`. Workflow dispatch, media completion, and email acceptance each need their own recovery interpretation. [Workflow Vite integration](https://workflow-sdk.dev/docs/getting-started/vite)

Cloudinary stores source/draft/export assets privately and published media separately. Audio uses the `video` resource type; archives use `raw`. Signed upload completion is checked server-side. Public IDs and signed URLs are identifiers/capabilities, not substitutes for application ownership checks. [Cloudinary upload parameters](https://cloudinary.com/documentation/upload_parameters)

Foundry bounds every completed ZIP by `min(9 MiB, advertised raw allowance)`. A previous account check reported 10 MiB; that is not a universal plan guarantee. PNG bytes are retained, text/WAV are compressed losslessly, and individually oversized files are byte-chunked. Ordered independent ZIPs carry `oralia-foundry-assets-v2`, inventories, SHA-256 checksums, and reconstruction instructions. Persisted `ExportPart` plans/readiness allow archive-only recovery; parent completion requires verified parts. SMTP mail lists authenticated links, and failed notification does not regenerate ready archives.

Prisma keeps the SQLite provider with a libSQL adapter. Local CLI operations and remote Turso schema deployment are distinct. The repository uses checksummed authenticated SQL for cloud upgrades and refuses unexpected schemas. [Prisma SQLite/Turso guidance](https://docs.prisma.io/docs/orm/v7/core-concepts/supported-databases/sqlite)

**Gaps:** measure archive planning latency/memory, repeated source reads when byte ranges are unavailable, Cloudinary administration quotas, and cost of repeated ready-part verification. Define durable reconciliation for interrupted uploads and stranded SENDING emails. Protect referenced assets from cleanup; exercise restoration rather than equating a backup file with recoverability.

## Connectivity and offline scope

**Implemented:** browser image preloading, media retry/transcript access, device-local guest bookmark IDs, and server-persisted authenticated bookmarks. No service-worker media download, offline guarantee, IndexedDB draft store, or conflict-sync protocol is shipped.

**Future design:** make downloads opt-in and versioned, bound bytes/count/age with eviction, expose partial progress, and verify completion before advertising offline availability. Audio cache delivery must support ranges; partial network responses alone do not populate a complete offline object. [Workbox cached audio/video](https://developer.chrome.com/docs/workbox/serving-cached-audio-and-video)

Keep private responses and expiring URLs out of shared caches. Reauthorize signed-link refresh, clear account-specific local state at logout, and handle quota exhaustion/device eviction. Local-first drafts need version/conflict handling and explicit creator resolution. Connectivity flags do not prove a request will succeed; offline AI generation or automatic publication must not be implied.

## Operational gaps and verification gates

- **Provider lifecycle:** the configured `tts-1-hd` requires a planned migration. Current OpenAI documentation lists a January 6, 2027 shutdown for the existing Speech API models and a different API workflow as replacement. An environment-string substitution alone is insufficient; revalidate voices, streaming, limits, and sample timing. [OpenAI lifecycle guidance](https://developers.openai.com/api/docs/guides/text-to-speech)
- **Resource governance:** admission currently allows two active jobs and ten submissions per user per rolling 24 hours across both workspaces. This counts submissions, not tokens, media spend, retry costs, or global concurrency. There is no implemented usage ledger, global budget, or fair scheduler.
- **Evidence limits:** earlier isolated tests, browser checks, cloud migration verification, and legacy multipart recovery are historical evidence, not a fresh production health certificate. A prior Gemini planning server error left a new Foundry run indeterminate; native Windows migration-CLI checks also reported an engine error. Do not convert these into success claims without new checks.
- **Hosted validation:** model/account access, SMTP inbox receipt, private asset delivery, Workflow availability, deployment routing, physical-device playback, and language quality need separate evidence. Mocked provider tests and builds establish neither live completion nor exactly-once email delivery.

## Production expansion priorities

| Priority | Current gap and proposed direction | Acceptance evidence before claiming readiness |
|---|---|---|
| P0 — Reliability and cost | Add a usage/cost ledger, atomic preflight reservations, per-user and global spend limits, fair queue admission, and reconciliation/refunds for failed or ambiguous operations. Separate operator resolution from automatic retry. Add sanitized correlation IDs, stage latency, failure and notification metrics, asset retention, and restore drills. | Concurrent budget/rate tests, no duplicate paid work after interruption, reconciled actual usage, owner-safe recovery, alert exercises, and successful restore with retained asset references. |
| P1 — Discovery and media scale | Introduce cursor-paginated feed APIs with stable publication/ID ordering and direct indexed story/profile queries. Retain public-link behavior. Cache public responses with validators; add responsive delivery derivatives and compressed playback audio while retaining PNG/WAV export originals. | Query-plan and load measurements, no lost/duplicated page entries, cache invalidation after publication, bounded payloads, and seek/timing tests including encoder delay. |
| P1 — Multi-style adaptation | Define versioned visual/tonal profiles for Folk & Fable and Epic & Chronicle. Generate explicit reviewed adaptations from one source with stable character/reference mappings, localized text, and traceable prompt/model versions. | Source-to-adaptation provenance, visual continuity and language evaluations, creator selection/review, and independent cost accounting per adaptation. |
| P2 — Offline/local-first | Add opt-in PWA downloads with bounded range-aware caching and resumable integrity checks; IndexedDB drafts with versioned synchronization, account cleanup, and explicit conflict resolution. | Airplane-mode seek/playback, partial download/eviction/quota tests, reconnect/conflict tests, and proof that private data cannot cross accounts. |
| P2 — Institutional governance | Introduce organization/workspace ownership, role/permission boundaries, and stronger storage isolation only where the threat model requires it. Add moderation, consent/provenance review, localization quality processes, and operational ownership. | Cross-organization authorization tests, audited role changes, deletion/retention exercises, documented reviewer responsibilities, and representative native-language review. |

These priorities are engineering recommendations, not changes made by this documentation pass. Implement through the RPI workflow with separate migration, cost, rollout, and verification decisions.
