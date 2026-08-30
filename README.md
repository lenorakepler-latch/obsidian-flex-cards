# Flex Cards for Obsidian Bases

A Bases card view whose property values wrap. Give each property its own line count and the card grows to fit.

## Why

Obsidian's built-in Cards view positions every property absolutely at a uniform stride, and sizes the card from the measured height of a single tester property. One line budget, shared by every field. That is why a long summary clips after a few words, and why a CSS snippet can only move the clipping around — the total is fixed before any value is rendered.

Flex Cards registers its own Bases view type, so it owns its DOM. Nothing is absolutely positioned: each property is as tall as its own clamp, and the card is as tall as the sum of them.

## Options

Set per view, from the Bases toolbar. They persist in the `.base` file.

| Option | Default | What it does |
| --- | --- | --- |
| Card width | 300 | Minimum column width, in pixels |
| Layout | Masonry | `masonry` gives every card its natural height; `grid` makes each row equal |
| Lines per property | 4 | Default clamp for any property without an override |
| Lines in title | 2 | Clamp for the title |
| Per-property lines | — | One `property: lines` per row, e.g. `claude_summary: 8`. Accepts a bare name or a full id (`formula.Paper`, `file.name`) |
| Max card height | 0 | 0 leaves cards unbounded; any other value caps them and scrolls the overflow |
| Title property | File name | Which property renders as the card title. It is dropped from the body list, so it never appears twice — and it renders as the title whether or not it is in the view's property order |
| Show property names | on | Small uppercase label above each value |
| Hide empty properties | on | Skip a property on cards where it has no value |

## Styling

Every property div carries `data-property` — `note.<name>`, `formula.<Name>`, or `file.name` — so a CSS snippet can target one field:

```css
.flex-cards-property[data-property="note.claude_summary"] {
  --fc-lines: 8;
  font-style: italic;
}
```

`--fc-lines` is the clamp, and unsetting it lets a value run to full length. The classes are `.flex-cards`, `.flex-cards-group`, `.flex-cards-grid`, `.flex-cards-card`, `.flex-cards-title`, `.flex-cards-property`, `.flex-cards-label`, `.flex-cards-value`.

## Notes

Values render through the Bases `renderTo` API rather than `toString()`, so links, dates, checkboxes, and hover previews behave as they do elsewhere in Obsidian.

Cards render 60 at a time, with an `IntersectionObserver` appending the next batch as you scroll. A base over a few thousand notes opens without rendering every value up front.

There is no build step. `main.js` is plain CommonJS — edit it and reload Obsidian.

## Install

With [BRAT](https://github.com/TfTHacker/obsidian42-brat): add this repository as a beta plugin.

By hand: copy `main.js`, `manifest.json`, and `styles.css` into `<vault>/.obsidian/plugins/flex-cards/`, then enable it under Community plugins.

## Prior art

[EzraMarks/obsidian-bases-css-guide](https://github.com/EzraMarks/obsidian-bases-css-guide) reaches the same diagnosis and works around it from the CSS side — packing every value into one `html()` formula, plus hidden spacer formulas for vertical room. Worth reading if you would rather not install a plugin. [Advanced Bases](https://github.com/brightwav3/advanced-bases) and [Grid Card View](https://github.com/mafflerbach/obsidian-grid-card-view) add card views of their own, but size cards globally rather than per property.

## License

MIT
