# Oralia — Architecture

## Current application

React, strict TypeScript, Tailwind CSS and Vite form the web client. A shared TypeScript /api/v1 API uses Prisma with Turso/libSQL for hosting and explicit SQLite for isolated local work. Prisma and Node dependencies stay exclusively in server modules; the browser uses a Zod-validated fetch client. Dev/preview middleware and the Vercel Node function supply the API; a static dist deployment alone does not.

## Collections and public contracts

StoryCollection has exactly FOLK_AND_FABLE and EPIC_AND_CHRONICLE, labeled Folk & Fable and Epic & Chronicle. CollectionFilter adds ALL for browsing only. App owns the shared filter and starts at ALL. Navbar, Vellum, public profiles and Education share this state. RegionFilter remains an independent geographic intersection in Education.

Story contains collection, author identity, source metadata, audio and a single presentation. StoryPresentation contains stylePreset, styleLabel, reviewStatus and ordered keyframes. Only approved, nonempty presentations are playable. Literary collection does not establish content suitability. Public story URLs resolve from the full catalog independently of the active filter.

CreatorAssetBundle requires a concrete collection. Creator Studio initializes from the chosen collection or Folk & Fable for ALL, then owns its production selection independently. Changing it resets the storyboard, not the pitch recording. New ZIP manifests use oralia-storyboard-v3 and project.collection; ALL is invalid for bundles and stored stories.

## Persistence and migration

User owns stories, bookmarks and hashed expiring sessions. Story stores one collection plus source/voice/publication metadata. KeyframeScene stores narration, timestamp, ordered scene number and credited image URLs. Bookmark enforces a unique account/story pair. OtpChallenge tracks normalized email, expiry and single use.

The initial migration remains immutable. The subsequent collection migration rebuilds the Story table with backfilled collection values, preserves IDs and related data, and replaces the category/publication index. The eight known stories use an explicit six/two mapping; other existing records receive a compatibility mapping only in migration SQL. Back up SQLite before migrate deploy, regenerate Prisma, then run db push and seed. Never reset user data or accept blanket data loss. Seeds upsert their own catalog records without deleting other accounts, sessions, stories or bookmarks.

## Components and ownership

- App: shared browse collection, mode/theme, persistent creator session, catalog and public URL orchestration.
- VellumFeed / StoryCard / CreatorByline: searchable discovery and explicit creator/profile attribution.
- EducationFeed: two thematic cards and independent regional filters; shared cards and Listening Room.
- ListeningRoomModal / CarouselPlayer: selected StoryPresentation, aligned transcript, four chapter controls, bookmarks and voice selection.
- CreatorStudio: production collection, local pitch/recording, editable prompts/order/durations and export dialogs.
- useDatabaseCatalog: initial/loading/refresh/error/retry state; preserves current data during refresh. Missing profiles wait in CatalogStatusModal instead of becoming false not-found results.
- usePersistentSession: session persistence and header identity, including storage-blocked current-page credentials. Navbar derives avatar/username from this session and falls back to initials if the image fails.

## Audio, presentation and exports

One HTMLAudioElement supplies currentTime; a paint-aligned loop publishes only discrete scene/caption changes. Media events own progress, seek, buffering, volume, end and visibility recovery. No independent accumulating playback clock is used. Frames use half-open ranges; image decode/preload retains the prior image on failure. Missing spoken tracks use an explicitly identified quiet timing tone through the same audio element.

Folk & Fable uses warm illustrated surfaces. Epic & Chronicle uses cinematic editorial contrast. Both retain the warm sand/terracotta palette, rounded geometry, accessible custom dropdowns, modal focus restoration and reduced motion. Scene assets remain the existing credited photographs, not newly generated illustrations.

AudioDraftPlayer wraps the recording hook's ref with themed controls. MediaRecorder MIME is detected at runtime; files and captured blobs remain local to the mounted studio. Unknown recorder durations become seekable after first complete playback. Exports package images, prompts, contiguous edited timings, attribution and SHA-256 checksums. Storyboard time is independent of original narration. AI preparation and email remain explicit simulations.

## Current API

All routes are under /api/v1 with runtime validation and no-store responses.

| Route | Behavior |
|---|---|
| GET /health | Database read health. |
| GET /catalog | All stories/profiles; optional collection query accepts one StoryCollection; invalid values return 400. |
| GET /stories/:id | One story, independent of browsing collection. |
| GET /creators/:username | Public profile without email or credentials. |
| GET /media-status | Bundled static-media manifest availability; no runtime filesystem probing. |
| POST /auth/otp/request | Expiring simulator challenge, enabled only by PRESENTATION_MODE=true. |
| POST /auth/otp/verify | Any six-digit PIN consumes an unused challenge and returns a creator session. |
| GET /auth/session; POST /auth/logout | Restore or revoke current bearer session. |
| POST /images/keyframe | Authenticated, validated collection/scene/prompt; illustrative SVG fallback for demo sessions. |
| PATCH /me/voice | Account-authorized voice preference. |
| GET /bookmarks; PUT/DELETE /bookmarks/:storyId | Account-scoped, idempotent bookmarks. |

The client fetches the full catalog for public-link resolution and filters browsing locally. API consumers may request a filtered catalog directly. No additional route is required for collection switching.

## Production roadmap

1. Responsive layout: preserve all three modes, collection/region discovery, accessibility and explicit errors.
2. Audio engine: recording/upload compatibility, precise seek boundaries, image failure handling and recoverable drafts.
3. Creator pipeline: TypeScript workers, PostgreSQL, durable jobs, server-side transcription/storyboard/image adapters, private storage, protected expiring export links and transactional email outbox. Email failure must not delete completed exports; notification retries do not regenerate images. See [R2 presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/) and [Resend send email](https://resend.com/docs/api-reference/emails/send-email).
4. Discovery and learning: reviewed literary collections, source/dialect overlays, cursor pagination and bounded offline saves with partial-download states. Moderation, source attribution and suitability review remain separate from literary style.

## Hosted runtime and data configuration

Runtime and seed use PrismaLibSql with server-only TURSO_DATABASE_URL and TURSO_AUTH_TOKEN. Explicit file DATABASE_URL selects local development/test SQLite; it is rejected on Vercel. Prisma CLI schema operations retain a local SQLite datasource. Client construction is lazy, so packaging never queries a database. Vite middleware and the Vercel Node entrypoint delegate unchanged /api/v1 paths to handleApi. API code and generated Prisma remain outside the browser graph.

db:deploy:turso generates the current schema SQL, inspects remote structure, initializes only an empty database, verifies matching structures, and records an _oralia_schema checksum. It refuses unexpected structures or changed recorded checksums. Schema application and ledger insertion use one write batch. Existing migration SQL remains immutable; later schema changes require an explicit reviewed migration, not another initializer. Cloud seeds are idempotent and do not copy local sessions or accounts.

Build generates Prisma and a deterministic bundled-media manifest before TypeScript/Vite compilation. Static narration is delivered by Vercel, not a function filesystem. Credentials, local DB files and QA artifacts are excluded from Git and deployment uploads. No migrations or seeds execute during build, cold start or a request.

The hosted creator gate remains a clearly labeled presentation simulator controlled by PRESENTATION_MODE. Images API contracts validate a concrete collection, scene 1–4 and prompt 1–2000. Demo requests always return bundled, collection-themed SVG placeholders with accurate provenance. A separate server-only adapter reads OPENAI_API_KEY and explicitly configured OPENAI_IMAGE_MODEL, validates PNG output and sanitizes provider failures within a bounded timeout. It is tested with mocks and has no public paid execution path. Persisted generated media, production authentication and studio regeneration remain future work.
