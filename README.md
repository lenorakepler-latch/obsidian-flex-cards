# Flex Cards for Obsidian Bases

A Bases card view whose property values wrap. Give each property its own line count and the card grows to fit. A companion table view shares its checkbox filters, group hiding, and class hooks.

## Why

Obsidian's built-in Cards view positions every property absolutely at a uniform stride, and sizes the card from the measured height of a single tester property. One line budget, shared by every field. That is why a long summary clips after a few words, and why a CSS snippet can only move the clipping around — the total is fixed before any value is rendered.

Flex Cards registers its own Bases view type, so it owns its DOM. Nothing is absolutely positioned: each property is as tall as its own clamp, and the card is as tall as the sum of them.

## Options

These are the card view's options; the table view's are under [Table view](#table-view). Set per view, from the Bases toolbar. They persist in the `.base` file.

| Option | Default | What it does |
| --- | --- | --- |
| Theme | Default | Card look, chosen per view — see below |
| Card width | 300 | Minimum column width, in pixels |
| Cover image property | — | A property holding an image: a wikilink, a vault path, or an http URL. Rendered full-bleed at the top of the card |
| Cover height | 160 | How tall that image is, in pixels |
| Layout | Masonry | `masonry` gives every card its natural height; `grid` makes each row equal |
| Lines per property | 4 | Default clamp for any property without an override |
| Lines in title | 2 | Clamp for the title |
| Per-property lines | — | One `property: lines` per row, e.g. `claude_summary: 8`. Accepts a bare name or a full id (`formula.Paper`, `file.name`) |
| Max card height | 0 | 0 leaves cards unbounded; any other value caps them and scrolls the overflow |
| Title property | File name | Which property renders as the card title. It is dropped from the body list, so it never appears twice — and it renders as the title whether or not it is in the view's property order. Whatever it points at, the title opens that card's note: click to open, Cmd or Ctrl to open in a new tab, hover for a preview. If the property is empty on a given note, the title falls back to the file name |
| Show property names | on | Small uppercase label above each value |
| Hide empty properties | on | Skip a property on cards where it has no value |
| Hidden properties | — | One property name per row. Removed from the visible card but kept in each card's DOM — see below |
| Properties to expose as card classes | — | One property name per row. Each becomes a class on the cards — see below |
| Editable properties | — | One property name per row, optionally `: check`, `: text`, or `: number`. Those fields become editable on the card — see below |
| Checkbox filters | — | One property name per row. Each gets a column of checkboxes, one per value, above the cards — see below |
| Show filter checkboxes | on | Turn the whole checkbox panel off without clearing the list |

## Themes

Set per view, so one base can hold a dense triage grid and a roomy reading grid over the same notes.

| Theme | Looks like |
| --- | --- |
| Default | Bordered card on the page background |
| Plain | No border or fill — just spacing and a rule between properties |
| Compact | Tight padding, small type, labels beside their values in an aligned column |
| Paper | Serif, generous leading and padding, a soft shadow. For reading rather than scanning |
| Index card | Alt background, accent edge down the left, monospace labels, dotted rules |
| Callout | Tinted panel, round corners, accent title |

Every theme is a block of custom-property overrides, so writing your own is the same job. Add a snippet under Settings → Appearance:

```css
.flex-cards-theme-paper {
  --fc-card-shadow: none;
  --fc-value-font: Bitter;
}
```

The variables are `--fc-gap`, `--fc-card-{bg,border,radius,pad,shadow,accent}`, `--fc-title-{font,size,weight,color,gap}`, `--fc-label-{font,size,color,weight,transform,width}`, `--fc-value-{font,size,color}`, `--fc-leading`, `--fc-prop-gap`, and `--fc-prop-rule`. They are declared with their defaults at the top of `styles.css`.

## Editing from a card

Obsidian's table view lets you edit a property in place; its card view does not, and the property editors core uses in table cells are not part of the public API. The write path is, though — so the controls here are this plugin's own, and deliberately cover only the two cases worth doing without a widget toolkit.

List a property under **Editable properties**:

```
Will Apply: check
Final Postdoc: check
Thoughts
Priority Score: number
```

A checkbox is live — click it and the frontmatter is written. Text and numbers are click-to-edit: the value renders normally until you click it, then becomes a box. Enter saves, Shift+Enter adds a line, Escape cancels, and clicking away saves.

Without an explicit type the control is inferred from the value already in the file — a boolean gets a checkbox, a number a number box, anything else a text box. Give the type explicitly for a property that is often missing, since an absent value has nothing to infer from and would otherwise get a text box.

Details worth knowing:

- Editable properties ignore **Hide empty properties**, or a field that is missing would be a field you could never set.
- Only `note.` properties can be edited. `file.` and `formula.` values are derived, with nothing to write back to, and are skipped if listed.
- A list-valued property falls back to read-only rather than let a text box flatten it into a string.
- Writes go through `app.fileManager.processFrontMatter`, the same path Obsidian's own property editor uses. That re-serializes the frontmatter block, so a folded `>-` scalar may come back as a quoted string. Obsidian does this whenever you edit properties in its own UI; it is a formatting change, not a content one.

## Filtering with checkboxes

The card view and the table view share this. List properties under **Checkbox filters** and a collapsible **Filters** panel appears above the cards. Each property gets a column with one checkbox per distinct value and a count beside it. Uncheck a value to hide the cards that have it; **All** and **None** flip a whole column.

- With several properties, a card must pass all of them to stay visible.
- A list property such as tags contributes each item, so a card tagged `a, b` stays visible while either is checked. A card with no value counts as `—`.
- Names match case-insensitively, and a full id (`note.status`) or the display name shown in the base also works. A name that matches nothing is reported in red at the top of the panel instead of being dropped.
- Counts update as you check and uncheck. Each is how many cards (or rows) that value would show given every other filter and the group checkboxes, so an unchecked value still says how many it would bring back. A value that no remaining card has stays listed, dimmed, at 0.
- The panel's title line shows the total, `Filters · 456 total` or `Filters · 120 of 456 shown`, and stays visible when the panel is collapsed.
- If the view is grouped, the panel also gets a **Group** column that hides whole groups.
- Unchecked values are saved in the `.base` file, so they survive a reload.

This filters rather than groups: the cards (or rows) stay in the view's own grouping and sort order.

## Hidden properties

Bases searches the properties a view lists, not what a card happens to display. To make a field searchable without cluttering the card, keep it in the view's property list and add it under **Hidden properties**. It is taken off the visible card and rendered into a hidden element inside it, so it is also present in the HTML for snippets or other plugins that read the page. It is rendered even if it is not in the property list, but then Bases search will not see it.

## Styling

Every property div carries `data-property` — `note.<name>`, `formula.<Name>`, or `file.name` — so a CSS snippet can target one field:

```css
.flex-cards-property[data-property="note.claude_summary"] {
  --fc-lines: 8;
  font-style: italic;
}
```

`--fc-lines` is the clamp, and unsetting it lets a value run to full length. The classes are `.flex-cards`, `.flex-cards-group`, `.flex-cards-grid`, `.flex-cards-card`, `.flex-cards-title`, `.flex-cards-property`, `.flex-cards-label`, `.flex-cards-value`.

### Styling a card by its frontmatter

List a property under **Properties to expose as card classes** and every card gains classes derived from its value. A truthy value gives `fc-<property>`, and the value itself gives `fc-<property>-<value>`. A list contributes one class per item, so `tags: [paper, zotero]` yields `fc-tags`, `fc-tags-paper`, and `fc-tags-zotero`. Names are lowercased with runs of punctuation collapsed to hyphens, so `Final Postdoc` becomes `final-postdoc`. Values longer than 32 characters are skipped, since a summary makes a useless class name.

```css
.flex-cards-card.fc-final-postdoc {
  --fc-card-accent: 3px solid var(--color-green);
}

.flex-cards-card.fc-has-pdf-false {
  opacity: 0.6;
}
```

Only listed properties produce classes — every property on every card would otherwise be a lot of markup for nothing.

## Table view

**Flex table** is a second view type, for when you want rows instead of cards. It shows the view's properties as columns, one row per note, and takes its grouping and sort order from the base like any other view.

| Option | Default | What it does |
| --- | --- | --- |
| Checkbox filters | — | As on cards: a column of checkboxes per property, above the table |
| Show filter checkboxes | on | Turn the whole checkbox panel off without clearing the list |
| Lines per cell | 3 | Default clamp for a cell's text |
| Per-property lines | — | One `property: lines` per row, as on cards |
| Properties to expose as cell classes | — | One property name per row. Each of those columns' cells gains classes from its own value — see below |

- Groups appear as banner rows inside one table, not as separate tables, so columns stay aligned across groups. The **Group** checkbox column hides whole groups, as on cards.
- The header row stays at the top, and the first column at the left, while you scroll. The table scrolls inside its own box, at most 85% of the window height; set `--fc-table-max-height` to change that.
- Drag the right edge of a header to resize that column. The first drag pins every column at its current width and makes the table as wide as its columns, so the pane scrolls sideways if they add up to more than fits. Widths are saved in the `.base` file under `columnSize`, the same key and format the built-in table uses, so they survive a reload and carry over if you switch the view to the built-in table. Double-click a header edge to clear them and go back to fitting the pane.
- A `file.name` column opens that row's note on click (Cmd or Ctrl for a new tab), with hover preview.
- Like the cards, rows render 60 at a time as you scroll.

### Styling a cell by its value

List a property under **Properties to expose as cell classes** and each cell in that column gains classes from the cell's own value, using the same rule as card classes: a truthy value gives `fc-<property>`, the value gives `fc-<property>-<value>`, and a list contributes one class per item. A `Status` cell holding "Done" becomes `td.fc-status.fc-status-done`.

```css
.flex-table td.fc-status-done {
  color: var(--color-green);
}

.flex-table td.fc-status-blocked {
  background: color-mix(in srgb, var(--color-red) 15%, transparent);
}
```

To style a whole row from one column's value, use `:has()`:

```css
.flex-table tr:has(> .fc-status-done) {
  opacity: 0.6;
}
```

Every cell carries `data-property`, as card properties do, and the classes on the table are `.flex-table`, `.flex-table-cell`, `.flex-table-group-row`, and `.flex-cards-value` (the cell's content, which holds the line clamp).

The table has no themes, labels, hidden properties, or editing; for in-place editing, use the built-in table or the card view.

## Notes

Values render through the Bases `renderTo` API rather than `toString()`, so links, dates, checkboxes, and hover previews behave as they do elsewhere in Obsidian.

Cards render 60 at a time, with an `IntersectionObserver` appending the next batch as you scroll. A base over a few thousand notes opens without rendering every value up front.

There is no build step. `main.js` is plain CommonJS — edit it and reload Obsidian.

## Install

With [BRAT](https://github.com/TfTHacker/obsidian42-brat): add this repository as a beta plugin.

By hand: copy `main.js`, `manifest.json`, and `styles.css` into `<vault>/.obsidian/plugins/flex-cards/`, then enable it under Community plugins.

## Credits and prior art

No code from another plugin is vendored here. What follows is where the ideas and the diagnosis came from.

**Obsidian's built-in Cards view** (core Bases plugin, Obsidian 1.12.x). The account of the layout above — uniform stride, `top` and `height` set inline per property, card height derived from one measured property — is what its shipped code does, read to work out whether CSS alone could fix this. It cannot, and that is why this is a plugin. The `data-property` attribute this plugin puts on each property div is that view's convention, kept deliberately so snippets written against the built-in cards keep working.

**[EzraMarks/obsidian-bases-css-guide](https://github.com/EzraMarks/obsidian-bases-css-guide)** — the fullest writeup of the problem, and it reaches the same diagnosis independently. It solves it from the CSS side instead: pack every value into one `html()` formula so card height depends on a single property, add hidden `spacer_` formulas for coarse vertical room, and style the result. Two findings from it that shaped this plugin: that a formula's *original* name is the one that lands in `data-property`, and that packing costs you frontmatter pre-population on the "+ New" button. If you would rather not install anything, read that guide first.

**[Advanced Bases](https://github.com/brightwav3/advanced-bases)** by Brightwav3 (MIT) — Cards Compact, Feed, and Timeline views. Its Feed view lazy-renders notes as they scroll in and unmounts them as they leave; the chunked `IntersectionObserver` rendering here is the same idea in a simpler form.

**[Grid Card View](https://github.com/mafflerbach/obsidian-grid-card-view)** by mafflerbach (MIT) — a custom grid card view with card width and height sliders and scroll-on-overflow. The "max card height, scroll the overflow" option here is that behaviour, offered per view alongside clamping rather than as the only mode.

### Forum threads

This is a well-known limitation, and the people below described it before this plugin existed. If any of it lands in core, most of this plugin becomes unnecessary.

- [Bases: word wrap in cards / multiple lines](https://forum.obsidian.md/t/bases-word-wrap-in-cards-multiple-lines/103846) — the feature request this plugin answers: set a property's height in card view, and let its value wrap. Still open.
- [Improve compatibility of Bases Cards with CSS snippets](https://forum.obsidian.md/t/improve-compatibility-of-bases-cards-with-css-snippets/104590) — why snippets against the built-in cards fight the layout, including hiding labels and showing longer text without clipping. The label toggle and the `data-property` hook here both come out of what that thread asks for.
- [Bases: support CSS customizations for properties](https://forum.obsidian.md/t/bases-support-css-customizations-for-properties/104752) — the request for per-property styling hooks.
- [How change cards height in bases](https://forum.obsidian.md/t/how-change-cards-height-in-bases/105618) — card height growing with each added field, and the snippets people tried against it.
- [Text wrap feature for bases](https://forum.obsidian.md/t/text-wrap-feature-for-bases/104422) — the same complaint from the table side.
- [Card view size](https://forum.obsidian.md/t/card-view-size/98043) and [Card view for Bases with no header](https://forum.obsidian.md/t/card-view-for-bases-with-no-header/106615) — sizing and title requests that shaped the card width and title property options.
- [dsebastien/obsidian-kanban-action-planner#6](https://github.com/dsebastien/obsidian-kanban-action-planner/issues/6) — the same wrap-or-truncate choice, posed for a kanban card.

### API

**[Build a Bases view](https://docs.obsidian.md/plugins/guides/bases-view)** and the `BasesView` / `BasesViewRegistration` / `Value.renderTo` declarations in [obsidian-api](https://github.com/obsidianmd/obsidian-api) are the API this is written against.

## License

MIT
