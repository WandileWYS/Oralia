---
name: oralia-audit
description: Audit Oralia Vellum interactions, production authentication and creation boundaries, API routes, and populated Prisma/Turso or isolated SQLite data; report observed readiness and verification gaps.
---

# Oralia Audit

Read AGENTS.md, package.json, schema.prisma, server/api.ts, and ARCHITECTURE.md for the current contracts. Audit from the repository root; previous success reports are not fresh evidence.

## Frontend

- Trace VellumFeed, StoryCard, CreatorByline, App/public URL helpers, CreatorProfileModal, and ListeningRoomModal. Every card must open its own story and every byline its database creator; check pointer and keyboard activation.
- Check All Collections, Folk & Fable, Epic & Chronicle, plus region intersections and direct links opened under another collection. The seed baseline is eight stories (6/2), 32 scenes, four editorial profiles; additional legitimate records are allowed.
- Exercise modal close/back/Escape, focus restoration, audio cleanup, bookmarks, both themes and responsive layouts. Guests can browse and listen. Missing media shows retry/transcript access, never timing tones or replacement content.
- Check real email-code UI, cookie-restored header identity, avatar failure, logout and Studio gating through isolated tests. Never accept arbitrary PINs or rely on localStorage bearer credentials.
- Studio must show persisted creation jobs, explicit failures, private previews, immutable revisions, review-gated publication and independent export/email states. A provider failure must not produce fake media or success.

## Server and persistence

- Inspect the Nitro routes/api/v1/[...route].ts adapter and Workflow integration. Verify /api/v1 paths, JSON errors, same-origin mutation checks, static narration and internal Workflow routing. Keep Prisma/provider/Node modules out of browser bundles.
- Call health/catalog, each public story/profile endpoint, missing resources and unauthenticated protected routes. Validate response schemas rather than trusting status 200.
- Query through server/db.ts only. Confirm author relationships, concrete collection keys, four ordered unique scene numbers per seeded story, positive duration and increasing in-range boundaries. Generated versions must use measured sample boundaries and truthful provenance.
- Confirm ownership and verified email for uploads, jobs, revisions, publication and downloads. Source/draft/archive bytes belong in private Cloudinary storage, not database blobs. Public Story rows must not expose unfinished drafts.
- Read counts without printing emails, code/session hashes, tokens or private payloads. Keep the working database unchanged: no seed, migration, db push or reset merely to obtain a passing audit.

## Verification

Use an existing healthy dev server or retain an audit-owned server session and stop only that server afterward. Inspect ignored QA scripts before reuse. If browser tooling is unavailable, mark interaction coverage INCOMPLETE.

Run Prisma validation, npm test, then npm run build sequentially. Tests must explicitly select isolated SQLite; hosted credentials in .env never authorize test writes. Use npm run db:verify:turso for read-only cloud verification. Migration status applies to the CLI's local database, not remote Turso.

Cover code expiry/attempts/replay/resend/rates, SMTP rejection without session issuance, cookie restoration/logout, old credential rejection, owner isolation, schema preservation, provider/schema failures, ambiguous paid calls, completed-stage reuse, immutable publication, archive checksums and email-only retries. Provider mocks belong only in tests. Do not send real email, invoke paid generation, publish or modify real accounts as a side effect of a read-only audit.

Report actual PASS, FAIL or INCOMPLETE with command results, stories/bylines/modals/API queries exercised, viewports/themes, database integrity, warnings/errors and skipped checks. A successful build or mocked test does not verify live model access, inbox receipt, Cloudinary delivery settings or Vercel Workflow operation. Print a verification success statement only for checks actually executed successfully; keep external integration gaps explicit.

## Dynamic generation update — 9 November 2026

Creation is asynchronous: QUEUED → SCRIPT_READY → PROCESSING_MEDIA → COMPLETED, with FAILED/INDETERMINATE error states. Gemini dynamically chooses visual beats at roughly 15–30 seconds of narration per scene, within a safety ceiling of 64 scenes. One-minute narratives target 3–4 scenes; five-minute narratives target 12–20 or more. Historical seeded stories keep their existing four scenes.

Workflow launches at most two narration steps, then two image steps per iteration. Each paid request has its own durable step and bounded retry; completed assets are reused and ambiguous paid outcomes require review. Narration WAV responses stream directly to authenticated Cloudinary upload streams. Image API Base64 JSON requires a bounded per-image decode before upload; no local media files are written. Final assembly measures actual PCM samples. Gemini boundaries remain estimates; GET /api/v1/creations/:id exposes measured boundaries and formatted MM:SS.mmm timestamps when complete.

CreationJob persists totalScenes, processedScenes and independent notificationStatus. The status response includes completionPercentage (up to 95% during media preparation; 100% only after final assembly). COMPLETED means a private draft is ready for review, never automatic publication. Completion email uses real Gmail SMTP; POST /api/v1/creations/:id/notify retries a failed email without regenerating media. Interrupted SENDING notifications require operator reconciliation.

OPENAI_API_KEY is server-only. Unset or blank OPENAI_STT_MODEL, OPENAI_TTS_MODEL and OPENAI_TTS_VOICE default to whisper-1, tts-1-hd and onyx. The existing configurable GPT image model remains selected; no automatic legacy DALL·E substitution occurs. Run db:migrate:turso for the reviewed dynamic-scene migration from the previous production schema, or db:migrate for local SQLite. Cloud verification compares logical column/index definitions, ignoring physical column ordinals after ALTER TABLE.
