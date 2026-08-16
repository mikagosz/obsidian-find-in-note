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

The plugin uses no desktop-only APIs, and the mobile case is built for rather
than merely allowed:

- The bar shrinks to the width it is given instead of running off the edge — the
  same rule that fixes a narrow side pane on the desktop.
- Buttons get finger-sized targets, and the field is set at 16px so iOS does not
  zoom the page the moment it is focused.
- Autocapitalise and autocorrect are off, so the phone stops turning the query
  into a different word.
- The hotkey notice is desktop-only. There is no shortcut to argue over on a
  phone, so nothing is said; the command palette is the way in.

Highlighting still depends on the CSS Custom Highlight API being present in the
device's web engine. Where it is missing, the plugin says so rather than failing
quietly.

Honest limit: this has not been run on a physical phone. The code paths above are
deliberate, not incidental, but a real device test is still owed.

## Installing

**Settings → Community plugins → Browse**, search for *Find in Note*, install and
enable it. Then free Cmd+F as described above — the plugin works from the command
palette until you do.

<details>
<summary>Installing by hand, for a pre-release build</summary>

1. Download `main.js`, `manifest.json` and `styles.css` from the latest release.
2. Put them in `<your vault>/.obsidian/plugins/find-in-note/`.
3. Enable **Find in Note** in Settings → Community plugins.

A copy installed this way does not update itself.
</details>

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
