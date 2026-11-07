# Oralia

> **Built for the Andela × OpenAI Codex Accelerator (Cape Town Cohort)**

## About the Project

Oralia is an audio-first visual carousel platform designed as **Instagram for African Oral Storytelling**. It pairs spoken stories with timestamped images and read-along captions, avoiding the rendering overhead of a video file for every story.

## The Problem It Solves

African oral traditions and regional folklore are rich, while video production demands editing skills, rendering time, large files, and reliable bandwidth. Educational tools can also lack culturally resonant, thematically curated storytelling experiences. Oralia brings audio, imagery, and text together to make those narratives easier to explore and share.

## The Technical Approach

1. **Audio and keyframe analysis:** The intended server-side AI workflow transcribes recordings and proposes timestamped narrative beats for creator/editor review. The database catalog already provides measured, narration-aligned scene boundaries.
2. **Zero-video carousel:** One HTML audio element supplies the playback clock. React selects the active image and caption, preloading upcoming scenes. Ready images can change on the next paint; browsers cannot guarantee literal zero-latency updates.
3. **Three modes:**
   - **Vellum:** Public discovery, creator profiles, filtering, and an immersive Listening Room. Readers need no login.
   - **Creator & Game Studio:** Voice recording/upload, editable storyboard prompts, scene reordering and timing, JSON inspection, and a real ZIP asset export. AI generation and email delivery are explicitly simulated.
   - **Education & Schooling:** Two thematic literary collections: Folk & Fable and Epic & Chronicle. The current collection has English captions; the dialect overlay explains when no reviewed dialect track is available.

## Why Oralia

Audio plus timed images can reduce production work and bandwidth compared with a rendered video workflow. Oralia gives storytellers, educators, and game developers a visual format for preserving and sharing locally grounded narratives. Image access still depends on connectivity; saving a bookmark does not download a story for offline use.

## Tech Stack

- **Frontend:** React, strict TypeScript, Tailwind CSS, Vite; accessible custom dropdowns and native modal dialogs.
- **API:** Shared TypeScript `/api/v1` handler, attached to Vite locally and a Node function on Vercel.
- **Database:** Prisma ORM with Turso/libSQL for hosting and SQLite for isolated local work. Prisma runs exclusively in `server/`; React uses a Zod-validated fetch client.
- **State and sync:** HTML5 audio, paint-aligned keyframe selection, React hooks, account bookmarks, and persisted local simulator sessions.
- **Planned integrations:** OpenAI transcription/storyboard/image workflows, durable jobs, private media storage/CDN, and transactional email. No provider keys are required for the local application.

## Getting Started

Use Node.js **22.12 or newer** and npm. For a local SQLite setup, copy .env.example to .env, set DATABASE_URL=file:./prisma/oralia.db and PRESENTATION_MODE=true, then run from the project root. For cloud setup, follow Turso and Vercel below instead:

```bash
npm install
npm run db:generate
npm run db:migrate
npx prisma db push
npx prisma db seed
npm run dev
```

Open the local URL printed by Vite, normally [http://127.0.0.1:5173](http://127.0.0.1:5173).

Without cloud credentials or an explicit local override, the default database is `prisma/oralia.db`. The committed initial migration supports a fresh checkout; the database and generated Prisma client are ignored by Git. `DATABASE_URL` can override the default `file:./prisma/oralia.db` through the process environment. Relative paths resolve from the project root. Reseeding updates the eight catalog stories, 32 scenes, and four editorial profiles without deleting created users, sessions, or bookmarks.

```bash
npm test         # Domain/media checks and isolated SQLite API integration tests
npm run build    # Strict TypeScript check and production client bundle
npm run preview  # Local built-client preview with the same database API
npx prisma migrate status
```

Vite middleware supplies the local API; Vercel deploys the shared handler through its Node function. Deploying only dist to a generic static host does not supply database endpoints. Hosted sign-in remains a labeled presentation demo; verified production authentication is deferred.

## Local Creator Sign-In

1. Choose **Creator sign in** or **Tell your story** and enter an email.
2. Wait for the simulated sending animation; no email is sent.
3. Enter **any six-digit PIN**, including `123456`, to open Creator Studio.

Challenges expire after five minutes and are single-use. The server creates a creator account and a seven-day session, stores a hash of its bearer token, and scopes bookmark/voice writes to that user. The browser persists the requested simulator session in `oralia-creator-session`; reload restores it, and sign-out revokes it. Reserved editorial collection emails cannot be used to impersonate collection profiles. This is an intentional authentication simulation, **not email ownership verification**.

The **Voice Quality Safeguard** saves Original Phone Mic Audio or Studio AI Synthesized Voice as an account preference and includes it in exports. It does not invoke a speech-generation service. Readers can switch playback voice options; when an original recording is absent, the UI explicitly offers a quiet timing tone rather than presenting synthetic narration as the author's voice.

## Catalog and Content Sources

Eight abridged English adaptations span six fables and two origin/adventure narratives. Each has four credited 1920px Unsplash scene photographs, a local synthetic narration track, measured caption cues, and a source/cultural-context note. All seeded narration is marked `STUDIO_AI`; the bundled WAV files use Windows speech synthesis, not community recordings or a live OpenAI request. Photographs convey atmosphere and do not claim to depict the historical episodes.

| Collection | Stories |
|---|---|
| Folk & Fable | Anansi and the pot of wisdom; Tink-tinkje and the highest flight; How stories became Anansi tales; The monkey and the shark; The washerman's donkey; Goso and the chain of blame |
| Epic & Chronicle | The chameleon and the second messenger; Sultan Majnun's date palm |

Adaptations identify the versions they follow: Barker and Sinclair's [West African Folk-Tales](https://www.gutenberg.org/files/66923/66923-h/66923-h.htm), Honey's [South-African Folk-Tales](https://www.gutenberg.org/cache/epub/38339/pg38339-images.html), and the historical [Swahili Tales](https://en.wikisource.org/wiki/Swahili_Tales) collection. These historical collections have translation and editorial limitations; region labels and literary classifications do not imply community certification or school approval. Source details appear in each Listening Room and exported manifest. Photo attribution travels in `CREDITS.txt` and the manifest.

To regenerate the included narration on Windows, run `scripts/generate-demo-narration.ps1` in Windows PowerShell, then reseed. The generator reads `prisma/content/stories.json` and writes measured cues to `prisma/content/narration.json`. Playback elsewhere uses the committed WAV assets and requires no Windows speech engine.

## Current Interaction Boundaries

- All Vellum stories, public profiles, and keyframes load from SQLite. Initial and refresh failures display retry feedback, with no fixture fallback. New creator profiles stay in a loading/retry view while the catalog refreshes after PIN sign-in.
- Listening supports play/pause, waveform and timeline seeking, thumbnail previews, four scene jumps, read-along transcript, CC, volume/mute, source attribution, and bookmarks. Missing audio uses an explicitly labeled Web Audio-generated timing track. Image failure preserves audio and the readable scene identity.
- Signed-in bookmarks live in SQLite. Guest bookmarks store only story IDs on the current device. Neither action downloads media.
- Recording supports a clearly labeled microphone-free practice mode, optional real microphone capture, and local file attachment. The themed draft player provides play/pause, seeking, time, and volume/mute controls around the original audio element. Unknown recorder durations become seekable after the first complete playback. Drafts remain in the current browser session and are released on navigation.
- The signed-in header shows the current username and avatar, with initials if its image fails. Sign-in clears previous sign-out notices; profile refresh and image failure do not change the account identity.
- ZIP export contains four images, edited prompts/order/timings, the voice preference, source attribution, and SHA-256 checksums. Email notification and AI preparation remain labeled simulations; no real email or image-generation call occurs.
- Light/dark atmospheric themes, rounded controls, mobile navigation, keyboard focus, Escape handling, and reduced-motion preferences share the existing editorial design system.

## Project Layout

```text
prisma/                 Schema, immutable local migrations, seed and measured cues
server/                 Prisma client boundary, catalog adapter, HTTP API, Vite plugin, API tests
src/components/         Discovery, profiles, player, Creator Studio, education and dialogs
src/hooks/              Catalog/session/bookmark state, media clock, recording and public views
src/lib/                Validated fetch client, catalog filtering, timing tone and ZIP exports
src/types/              Shared Zod contracts and canonical StoryCollection keys
src/data/presentation.ts Visual collection presets only; no story fixtures
public/media/           Bundled narration assets
```

## Verification

Run npm test, npm run build, npx prisma validate and npx prisma migrate status. The isolated tests cover initial installation, data-preserving collection migration, collection query validation, review gating, geographic intersections, authentication and idempotent reseeding. Browser checks exercise both collection filters plus All Collections, all source narratives and scene boundaries, profiles, and studio exports.

The migration preserves account, session, bookmark, story and scene IDs. Back up the local database before applying it. Existing downloaded archives remain unchanged; new exports use oralia-storyboard-v3 with project.collection.

See [RESEARCH.md](RESEARCH.md), [ARCHITECTURE.md](ARCHITECTURE.md), and [AGENTS.md](AGENTS.md) for research, current contracts, the production roadmap, and contributor standards.

## Turso and Vercel

Copy .env.example to ignored .env and set server-only TURSO_DATABASE_URL and TURSO_AUTH_TOKEN. Runtime and seed commands use Turso when these are configured. An explicit DATABASE_URL=file:./prisma/oralia.db selects local SQLite for development; Vercel rejects local database configuration. Never expose secrets through VITE_ variables.

The libSQL dependencies are already installed. Run npm run db:deploy:turso to inspect and initialize an empty remote schema or verify a compatible existing schema. This command generates SQL from Prisma, records its checksum, and refuses incompatible schemas without resetting data. Prisma CLI schema commands use local DATABASE_URL; prisma db push does not deploy the remote adapter. Local migration history remains unchanged.

Run npx prisma db seed and npm run db:verify:turso with cloud runtime credentials. Repeated seeding upserts eight sourced stories, 32 scenes and four editorial profiles while retaining unrelated users and content. Local demo accounts and sessions are not transferred. Do not run schema deployment or seeding from builds or functions.

For Vercel, use the Vite preset, npm run build and dist output. Configure TURSO_DATABASE_URL, TURSO_AUTH_TOKEN and PRESENTATION_MODE=true in the chosen Vercel environment. api/index.ts serves /api/v1/* as a Node function; narration and fallback images are static public assets. Build generates Prisma and the media manifest, then type-checks and bundles without database access. Runtime media-status uses that manifest rather than filesystem reads. No Vercel project has been published by these scripts.

PRESENTATION_MODE=true enables the explicitly labeled PIN simulator. It accepts any six digits and sends no email; it is not secure email ownership verification. Omit or set false to disable creation of demo challenges and sessions. Demo sessions can never authorize paid image generation.

POST /api/v1/images/keyframe accepts an authenticated request with collection, sceneNumber (1–4) and prompt (1–2000 characters). It returns a bundled illustrative SVG, its MIME type/provenance and fallback reason. OPENAI_API_KEY and OPENAI_IMAGE_MODEL configure the server-only provider adapter; the demo endpoint still uses fallback even when a key exists. Public paid generation, durable generated asset storage and studio integration remain deferred. Existing storyboard and ZIP workflows are unchanged. See [OpenAI image generation](https://developers.openai.com/api/docs/guides/image-generation).

Verification uses isolated SQLite for automated writes. Run npm test and npm run build; use npm run db:verify:turso for read-only remote catalog verification. A successful local build is not a published Vercel deployment.
