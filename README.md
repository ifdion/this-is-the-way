# Show the Path

A desktop-first, browser-local flow diagram builder. Astro serves a landing page at `/` and an interactive React workspace at `/builder`.

## Run

Requires Node >=22.22 and pnpm.

```sh
pnpm install
pnpm exec astro dev --background
```

Open http://localhost:4321. Manage the server with `pnpm exec astro dev status`, `pnpm exec astro dev logs`, and `pnpm exec astro dev stop`.

## Build a flow

- Create a named flow or try the included launch-plan example.
- Select a card. **Add step** inserts a regular card; **Add branch** inserts a rectangular decision card with a solid diamond icon, retaining the existing continuation below. **Convert to decision** changes an existing step in place, preserving its contents, continuation, and incoming references; conversion can be undone.
- **Yes goes down. No goes right.** More outcomes are represented by additional decisions, each with exactly two outcomes. Labels are editable. Terminal steps have the same rounded design as Start and no Step indicator; other step/decision type labels appear on hover or keyboard focus. The **Continue this path** card and its arrow only appear while their owning card is selected.
- Use **Loop to** on an empty path (or the inspector’s **Loop to an existing step** action) to search existing cards by name and path. A translucent alias references the original; it has no independent continuation. Hovering it (or keyboard-focusing it) draws an elbow-shaped reference path — out of the alias’s right edge, around with 60px-rounded corners, into the original’s right edge — while the origin highlights. Clicking an alias highlights it and opens its inspector. Its **↗** button scrolls to and selects the referenced original; **⇄ Change loop target…** reopens the picker to re-point the reference (undoable). A terminal step can become a loop reference with **↩ Convert to loop to…** (undoable, blocked while other aliases reference it).
- Edit a title and optional description in the inspector. Text edits and diagram changes automatically save to IndexedDB, with saving/error feedback and a retry action. **Save changes** also trims the current fields explicitly. Consecutive edits to one field are grouped for undo.
- **Simulate** walks from Start through manual choices and loops. Back and Restart affect only the simulation; returning to Build discards simulation history.
- Card deletion previews its effects. Ordinary-card deletion reconnects the continuation; decision deletion explicitly keeps a path or removes both. External aliases must be resolved first. Undo/redo are available for diagram edits, not whole-flow deletion.
- A clickable, keyboard-navigable minimap appears when the layout exceeds the canvas height or width.
- Collapse the flow library from the top-left toolbar. Inspector controls scroll independently above the pinned advertisement; neither operation moves the ad into the canvas. The minimap tracks the actual scroll viewport and updates after layout changes and resizing.
- Create, rename, duplicate, and delete multiple flows. Whole-flow deletion requires confirmation.

## Storage and limits

Flows are saved in the `show-the-path` IndexedDB database, schema version 1. Saving completes only after the transaction commits. The app warns before leaving with pending or failed writes.

This POC has **no accounts, server backup, cross-device sync, collaboration, or export**. Browser data can be evicted or cleared; private browsing can restrict persistence. Do not use it as the only copy of important work. Use one editing tab per flow; concurrent-tab conflict handling is not implemented. Undo history and simulation history are not persisted.

The diagram is an ownership tree with alias references for loops. Layout never traverses alias targets. Editing, simulation, history, layout, and storage live behind separate modules in `src/lib/` so future backend storage need not change the flow logic.

## AdSense

The right sidebar reserves a fixed 240 × 250 ad-unit area outside the canvas. No Google advertising requests are made by default.

Copy `.env.example` to `.env`, then configure:

```dotenv
PUBLIC_ADSENSE_ENABLED=false
PUBLIC_ADSENSE_CLIENT=ca-pub-YOUR_16_DIGIT_PUBLISHER_ID
PUBLIC_ADSENSE_SLOT=YOUR_NUMERIC_AD_UNIT_ID
```

Only set `PUBLIC_ADSENSE_ENABLED=true` after obtaining real IDs and site approval, placing any required `ads.txt` in `public/`, and configuring the required privacy disclosures and consent system for your audience. These public IDs are not secrets. Restart development or rebuild after changing them. A missing/invalid configuration leaves a placeholder rather than requesting ads. Blocking ads does not affect the builder.

**This POC does not implement a consent-management platform.** Google requires an appropriate certified CMP for affected regions. Do not enable ads in those regions until the necessary CMP and consent gating are in place. No live ad delivery has been verified because no publisher/ad-unit IDs were provided.

References: [AdSense code](https://support.google.com/adsense/answer/9274019), [Google consent requirements](https://support.google.com/adsense/answer/13554116).

## Verify

```sh
pnpm check
pnpm test
pnpm build
pnpm exec playwright install chromium
pnpm exec astro dev --background
pnpm test:e2e
```

Browser tests use an already-running server at `http://localhost:4321`. Override with `TEST_BASE_URL` if needed. The confirmed test boundaries are flow editing/layout/history, simulation, browser storage, and core browser UI/minimap navigation; real AdSense delivery and future backend integration are excluded.

## Next version

Backend saving, login, sharing, and exports to PDF, Mermaid, and Markdown are deliberately deferred. See `.scratch/flow-builder/spec.md` for the agreed POC scope.
