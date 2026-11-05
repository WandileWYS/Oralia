# Oralia

> **Built for the Andela × OpenAI Codex Accelerator (Cape Town Cohort)**

Oralia is an audio-first visual carousel platform designed as **Instagram for African oral storytelling**. It turns spoken stories into age-aware, image-synced experiences without rendering a video file for every story.

## About the Project

Oralia helps storytellers share oral histories and folklore through audio, illustrations, captions, and dialect-aware text. A listener hears the original recording while a lightweight carousel presents story images in time with the narration.

The same platform is designed for social discovery, creator prototyping, and curated education feeds. Each mode can preserve a storyteller's original voice while adapting the visual presentation for its intended audience.

## The Problem It Solves

African oral culture and regional folklore are rich, but producing polished video is expensive and resource-intensive for local storytellers. Traditional video workflows require editing skills, rendering time, large media files, and reliable bandwidth. Educational tools can also lack culturally resonant, age-adapted storytelling experiences for learners across Africa.

Oralia is designed to lower those production and access barriers by building a story experience from audio, timed images, and text rather than a pre-rendered video.

## The Technical Approach

Oralia uses an agentic AI pipeline to analyze recordings and prepare story assets. The browser plays the audio and selects images from timestamped cues; it does not need to render a video file.

1. **Audio and keyframe analysis:** Storytellers record or upload audio. A server-side AI workflow transcribes the recording, identifies narrative beats, and proposes timestamped image cues. Creators or editors can review and correct text and timing before publication.
2. **Audio-synced carousel:** The React client uses the HTML audio element as the playback clock. It preloads upcoming images and updates the visible frame when a cue changes, avoiding per-story video rendering. The goal is a visually responsive, near-frame transition when assets are ready; browser scheduling and image loading mean literal zero-latency swaps cannot be guaranteed.
3. **Three core modes:**
   - **Core Social Reel:** An audio-first discovery feed with image carousels, read-along subtitles, and dialect overlays.
   - **Creator & Game Studio:** A voice-pitch workflow that produces storyboards and visual assets, packages them for external production, and notifies the creator with an export link.
   - **Education & Schooling:** Curated feeds for four age tiers—**5–9**, **10–13**, **14–17**, and **18+**—with age-appropriate curation and visual styles ranging from soft fairytale illustration to graphic-novel and cinematic approaches.

## Why Oralia

By replacing rendered video with audio plus time-synced images, Oralia is designed to reduce production cost, file size, and bandwidth needs while keeping storytelling visual. It gives storytellers, educators, and game developers a way to preserve and share oral traditions and locally grounded narratives with audiences around the world.

## Tech Stack

- **Web client:** React, TypeScript, Tailwind CSS, and Vite
- **AI and automation:** OpenAI APIs for transcription and image/storyboard workflows, orchestrated through server-side agentic jobs
- **Playback and synchronization:** HTML5 Audio API with a React playback controller and hooks; React updates when the active image or caption cue changes
- **Planned backend architecture:** TypeScript API and workers, PostgreSQL for story and job metadata, a durable queue for long-running work, and private object storage with CDN delivery for media

AI, email, and storage credentials belong on the server. The browser should receive only authorized media and API responses.

## Getting Started

Use Node.js 22.12 or newer and npm. From the project root:

```bash
npm install
npm run dev
```

Open the local URL printed by Vite (normally `http://127.0.0.1:5173`).

```bash
npm run build   # Strict TypeScript check and production bundle
npm run preview # Serve the production bundle locally
npm test        # Cue selection, schema validation, and storyboard editing checks
```

### Current frontend capabilities

- Three responsive modes with a shared four-tier age selector.
- Persistent dark/light appearance, an Obsidian/Amber/Terracotta design system, a glass navigation bar, and a collapsible mobile mode menu. Theme preference is the only persisted browser setting.
- A playable 53-second original sample story with local illustrations and synthetic English narration. The fixture's scene timestamps come from the actual narration segments.
- Play/pause, seeking, scene navigation, mute, image preloading, and fallback/error states. The keyframe scrubber shows thumbnail/time previews on hover or keyboard focus; an auto-scrolling transcript follows active cues and supports click-to-seek.
- English captions plus synchronized isiZulu/Swahili placeholders and a dialect-overlay toggle. Placeholder selections retain the original English text and visibly state that reviewed translations are pending.
- Creator microphone recording and audio upload/preview. Recordings remain in memory for the current session; switching modes discards the recording draft.
- A simulated animated waveform responds to recording and playback state; it does not analyze live frequency data. Reduced-motion preferences suppress animation.
- Editable storyboard scene order, per-frame durations (1–60 seconds), project name, and prompt text. Timestamps are recalculated continuously after edits. This timeline describes the editable concept storyboard, independently of the original narration.
- An accessible export inspector with package structure, JSON breakdown, ZIP preview construction, and a real download containing four SVGs, `manifest.json`, `storyboard.json`, and a README. Edited prompts/timings/order and SHA-256 image checksums are included. Prompt edits do not regenerate sample art. Email delivery is simulated; nothing is emailed.
- Four education presentation themes: fairytale glow (5–9), comic borders (10–13), dark graphic-novel contrast (14–17), and warm cinematic minimalism (18+). These are frontend samples of the intended style system, not AI-generated outputs or a production content-rating service.
- Region/tradition filter tabs with result counts and clear empty states. West African Folklore, Zulu Mythology, and East African Fables have no reviewed fixtures yet. Original demo fiction is only listed under All stories and Original demos, preserving honest provenance.

AI transcription/generation, authentication, durable uploads/jobs, real email delivery, an infinite discovery feed, and offline PWA downloads are planned backend and later-phase work. The frontend makes no provider API calls and needs no API keys. Saved-story state lasts for the current player session.

### Source layout

`src/components` contains the navbar, shared player, creator studio, and education feed; `src/hooks` owns media synchronization; `src/types` defines shared types and Zod schemas; `src/data` contains validated fixtures. Local demonstration media lives in `public/media`. `tailwind.config.js` and `postcss.config.js` use Tailwind 3 to provide the explicitly configured CSS pipeline.

For the browser-facing models, keyframe `startTime`/`endTime` values are seconds. The proposed API uses `startSeconds`/`endSeconds`; a future API adapter must map those names without changing their meaning. No API adapter is required for the current local fixtures.

## Project Documentation

- [Research and gap analysis](RESEARCH.md)
- [Architecture and implementation roadmap](ARCHITECTURE.md)
- [Agent and contributor rules](AGENTS.md)
