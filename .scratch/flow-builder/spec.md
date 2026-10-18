# Flow builder POC

Status: ready-for-agent

Source: user decisions in the idea-to-build conversation. Review baseline: `15f7018` (user confirmed).

## Product scope

1. A public landing page describes the app's features and opens the builder.
2. Desktop-only editing for one user, with multiple flows and no collaboration.
3. Build mode automatically arranges the happy path in one vertical column. Two buttons: Add step and Add branch. Inserting either retains the existing continuation below it.
4. A branch is a diamond-shaped boolean decision with exactly two outcomes. Yes/happy path goes below; No/alternative goes right. Multiple alternatives use multiple diamonds to the right, never a multi-output diamond. Labels can be renamed.
5. Steps have a plain-text title and optional description.
6. Loop to an existing card by searching its name, with path context for duplicate names. Show a semi-transparent alias card, not a copy. Aliases have no independent contents or continuation; simulation jumps to the referenced original.
7. One Start per flow. Reaching a missing next connection in simulation reports No next step rather than an error; no End card is required.
8. Simulation manually advances and chooses boolean outcomes, follows aliases, and offers Back and Restart. It never runs external actions. Leaving simulation discards position/history, not the diagram.
9. Editing includes titles, descriptions, labels, undo/redo, and safe deletion. Ordinary deletion reconnects predecessor and continuation. Decision deletion requires an explicit path-to-keep or downstream-removal choice. Preview affected cards and resolve aliases before deleting their targets. Card deletion is undoable.
10. Flow management includes create, rename, duplicate, and delete, with browser-local IndexedDB saving and visible saving/saved/error feedback.
11. A minimap appears whenever diagram height or width exceeds the visible canvas, shows the viewport, and supports navigation.
12. Reserve an advertising container outside the canvas. Provider: AdSense. No IDs are available, so leave a placeholder and configurable integration. Do not claim live ads are working without real IDs and site approval.

## Workspace refinements

User-requested follow-up, superseding the diamond-shaped card presentation in requirement 4:

- Collapse/expand the left flow library.
- Keep the advertisement pinned below independently scrollable inspector controls.
- Reduce card padding and vertical/horizontal spacing.
- Show Step/Decision labels only on hover or keyboard focus. Render decisions as rectangular cards with a solid diamond at the top-left.
- Give terminal steps the same rounded styling as Start.
- Give Loop to the same button treatment as Step and Branch in empty-path placeholders; open its picker directly.
- Clicking an alias highlights it and opens its inspector; its separate arrow button scrolls to the referenced original. The inspector exposes a change-target action that reopens the target picker to re-point the reference.
- Hovering or keyboard-focusing an alias shows an elbow-shaped reference path (right edge of alias to right edge of the origin, 60px-rounded corners) while the origin highlights, without changing selection or the saved flow. The landing-page preview matches the current compact cards and always shows the same reference path.
- Convert a step to a decision in place, preserving content, connections, aliases, and undo support. Terminal steps can additionally convert in place to a loop reference through the picker.
- Show the Continue-this-path placeholder card and its incoming arrow only while the owning card is selected in Build mode.
- Match minimap highlights to actual canvas scroll bounds; update on scroll, layout, sidebar, and viewport changes.

## Later, not POC

Backend storage, login, sharing, and export to PDF, Mermaid, and Markdown.

## Confirmed test boundaries

- Flow editing: insertion, binary branches, aliases/loops, deletion, undo/redo, automatic layout. Not visual styling.
- Simulation: choices, loops, Back and Restart. Not external execution.
- Browser storage: saving/reopening multiple flows. Not future backend sync.
- Browser UI: core editing and minimap navigation. Not live AdSense delivery.
