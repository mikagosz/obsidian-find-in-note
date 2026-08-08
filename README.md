# Find in Note

Search the note you are reading and see every match light up in place — without
the note changing shape underneath you.

## Why

Obsidian's built-in Cmd+F lives inside the editor. To put a highlight on a
match, the editor has to expose the raw Markdown of whatever block the match
sits in. In a note with a wide table that means the rendered table collapses
into a wall of pipes and long lines running off the side of the screen, and the
thing you were looking at is gone.

This plugin searches the **rendered** note instead, and paints matches with the
CSS Custom Highlight API — which colours ranges without touching a single DOM
node. Nothing re-renders, nothing reflows, the table stays a table.

## What it does

- **Cmd+F** (Ctrl+F) opens a small bar in the top right of the note.
- Every match is highlighted as you type; the current one is highlighted
  stronger.
- **Enter** / **Shift+Enter** step forward and back. So do the two arrows in the
  bar.
- The note scrolls **only** when the current match is off screen.
- **Esc** closes the bar and clears the highlights.
- Matching is case-insensitive and literal, so `C++` and `(x)` search for
  themselves rather than blowing up as patterns.

Opened while editing, the note switches to reading view for the search and
switches back to exactly the mode it was in when the bar closes.

## One-time setup: freeing Cmd+F

Obsidian's built-in search holds Cmd+F and does not let go — a plugin cannot
take the key from underneath it, and trying only produces two search bars.
Clear the built-in binding once:

**Settings → Hotkeys.** Click the keyboard icon next to the filter box and press
Cmd+F: the list narrows to whatever currently owns that shortcut. Remove the
binding from the built-in search command, and the one this plugin ships with
(**Find in Note: Search the open note**) takes over.

The plugin says this once, in a notice on first load, and then never again. It
does not edit your hotkey settings for you — that file is yours.

Until then the plugin is still fully usable from the command palette
(Cmd+P → *Search the open note*).

## Mobile

The plugin uses no desktop-only APIs, so it installs on mobile — but it was
built and tested on desktop. There is no Cmd+F on a phone, so the command
palette is the way in, and highlighting depends on the CSS Custom Highlight API
being present in the device's web engine. Where it is missing, the plugin says
so instead of failing quietly.

## Known ceiling

Reading view renders long notes in pieces as they scroll into sight, so matches
in a part of the note that has not been rendered yet are not counted at first.
The plugin watches the note and re-counts as more of it arrives, so the number
in the bar settles as you scroll. For a note that fits in a screen or three this
is invisible; on a very long note the total may climb for a moment.

Lifting this would mean forcing the whole note to render up front, which costs
more than it buys on the notes this was written for.

## Development

```
npm install
npm run dev     # watch build
npm run check   # the offset arithmetic behind the highlights
npm run lint    # the Obsidian plugin review rules
npm run build   # typecheck + check + production bundle
```

`npm run check` runs without a browser and without a framework: Node strips the
types and runs `tests/spans.test.ts` directly.

## License

MIT
