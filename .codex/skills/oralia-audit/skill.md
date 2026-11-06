---
name: oralia-audit
description: Audit Oralia frontend interactions, Vellum author bylines and listening/profile modals, server API routes, and populated Prisma/SQLite data. Use for an Oralia verification or readiness report.
---

# Oralia Audit

Run a fresh audit from the repository root and report observed results. Read `AGENTS.md`, `package.json`, and the current schema/routes first; do not reuse a previous success report as evidence.

## Checks

### Frontend and Vellum

- Trace `src/components/VellumFeed.tsx`, `StoryCard.tsx`, `CreatorByline.tsx`, `CreatorProfileModal.tsx`, and `ListeningRoomModal.tsx` through `src/App.tsx`, `src/hooks/usePublicView.ts`, and `src/lib/catalog.ts`.
- Verify every Vellum card resolves `Story.creatorId` to the correct database creator. A plain-text fallback author, empty link, missing creator, or byline pointing to another profile fails this check.
- In a browser, visit All Collections, Folk & Fable, and Epic & Chronicle. Verify the seeded result counts are eight, six and two, including Featured Vellum and Recent Chronicles placements.
- Activate each author byline and confirm the public creator modal shows the matching username/bio and author-scoped, collection-filtered stories. Activate each card and confirm its Listening Room shows the selected story, scenes, and transcript. Check pointer and keyboard activation.
- Check modal close buttons, Escape, and Back to Vellum feed. Closing must restore usable focus and stop/unmount the player; public navigation must not mount overlapping dialogs or audio players. Missing or unreviewed stories and unknown public links must show actionable unavailable states.
- Check mode navigation, collection filters, and the audited cards/modals at mobile and desktop widths in both themes. Capture unexpected console errors, failed API requests, and visible broken controls. Browsing, profiles, and listening must remain available without login.

Reuse a healthy local dev server when available. Otherwise start `npm run dev` in a retained session and use its printed URL. Stop only servers started for this audit. Use available browser tooling; if unavailable, mark interaction checks **NOT CHECKED**, not passed. Existing ignored `.qa` artifacts may help, but inspect scripts before reuse and do not assume they are present or current.

### Server and Prisma boundary

- Inspect `server/api.ts`, `server/catalog.ts`, `server/plugin.ts`, `src/lib/api.ts`, and the shared response schemas. Inventory current routes rather than relying on a fixed historical list.
- Confirm Prisma, database adapters, and server modules remain outside the browser import graph and client bundle. Node-based test files under `src` are not browser entrypoints.
- Call `GET /api/v1/health` and `GET /api/v1/catalog`. For every returned story and creator, check `/api/v1/stories/:id` and `/api/v1/creators/:username` against the catalog. Validate bodies with the existing Zod schemas; a status 200 alone is insufficient.
- Verify unknown resources return the intended errors and protected routes reject unauthenticated access. Use existing isolated API tests for OTP, voice preference, bookmark writes, session expiry, and logout; do not modify real accounts or send email during an audit.

### Populated configured database

Run validation and isolated tests; Prisma migration status applies to the local CLI database, not Turso. Use npm run db:verify:turso for read-only configured cloud verification. Record exit codes:

```bash
npx prisma validate
npx prisma migrate status
npm test
npm run build
```

Use the existing server-side Prisma client from `server/db.ts` in a temporary Node/TypeScript check, never a React component. Query model counts and stories with their author and ordered scenes; always disconnect afterward. Verify:

- The database is populated, both canonical collections are represented, and the catalog's stories, authors, and keyframes agree with actual Prisma query results.
- Seed records expected by `prisma/content/stories.json` exist with four scenes each. Report current counts rather than assuming exactly eight stories or four creators forever; additional legitimate records are allowed.
- Story authors exist; scene numbers are unique and ordered; timestamps are finite, nonnegative, increasing, and within the positive audio duration. Shared story schemas accept the adapted records.
- Relevant model reads and relational queries complete without Prisma errors. Read counts for users, stories, scenes, bookmarks, challenges, and sessions without exposing email addresses, tokens, or private record contents.

Keep the real database unchanged. Do not run `db push`, migrations that apply changes, seed, reset, or destructive cleanup merely to obtain a passing report. Existing `npm test` API coverage uses an isolated temporary SQLite database; verify that isolation before running changed test scripts. If setup is missing or a check fails, report the command/error and needed setup instead of silently repairing it.

## Verification report

Return **Oralia audit: PASS** only when all required checks were executed successfully. Otherwise use **FAIL** for observed failures or **INCOMPLETE** for unexecuted checks, preserving any failures in the report.

Include:

- Frontend/card coverage: stories, rendered placements, author links, profile/listening modals, collections, viewports, and themes checked.
- API coverage: routes exercised, expected error cases, and response validation results.
- Database verification: actual model counts, collection coverage, relationship/timeline integrity, and executed Prisma query results.
- Validation commands with pass/fail results, TypeScript/bundle warnings, and unexpected browser errors.
- Findings with file/route references, skipped checks or limitations, and any audit-owned resources cleaned up.

For a complete pass, finish with: **Verification successful: audited Vellum author bylines and modal triggers work, the configured catalog is populated, and all executed Prisma/API checks passed.** Never print that success statement after a failed or skipped required check. Save a report file only when requested; otherwise report in the conversation.
