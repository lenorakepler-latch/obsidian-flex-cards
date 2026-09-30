'use strict';

/* Flex Cards — a Bases card view that lays properties out in normal flow.

   The built-in Cards view positions every property absolutely at a uniform stride and sizes the card from the MEASURED height of one tester property, so a card has a single line budget that every field shares. That is what clips a long summary at one line, and why a CSS snippet can only move the clipping around: the total is fixed before any field is rendered. Here nothing is absolutely positioned, so each field is as tall as its own clamp and the card is as tall as the sum. */

const obsidian = require('obsidian');

const VIEW_TYPE = 'flex-cards';
const CHUNK = 60;

function resolveId(name, all) {
	if (all.includes(name)) return name;
	return all.find((id) => id.slice(id.indexOf('.') + 1) === name) || null;
}

function slug(text) {
	return String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/** Parse the "property: lines" override list into {propertyId: lines}. */
function parseClamps(lines, all) {
	const out = {};
	for (const line of lines || []) {
		const m = /^\s*(.+?)\s*[:=]\s*(\d+)\s*$/.exec(line);
		if (!m) continue;
		const id = resolveId(m[1], all);
		if (id) out[id] = Number(m[2]);
	}
	return out;
}

/* Parse the editable list into {propertyId: type|null}. A row is a property name, optionally followed by a control type; without one the type is inferred from the value at render time. Only `note.` properties are editable — `file.` and `formula.` are derived, and there is nothing to write back to. */
function parseEditable(lines, all) {
	const out = {};
	for (const line of lines || []) {
		const m = /^(.*?)\s*[:=]\s*(check|checkbox|text|number)$/i.exec(line.trim());
		const id = resolveId(m ? m[1] : line.trim(), all);
		if (!id || !id.startsWith('note.')) continue;
		const type = m ? m[2].toLowerCase() : null;
		out[id] = type === 'checkbox' ? 'check' : type;
	}
	return out;
}

class FlexCardsView extends obsidian.BasesView {
	constructor(controller, containerEl) {
		super(controller);
		this.type = VIEW_TYPE;
		this.rootEl = containerEl.createDiv({ cls: 'flex-cards' });
		this.queue = [];
		this.grids = [];
		// Masonry column count depends on the width, so re-flow when the pane is resized.
		this.resizer = new ResizeObserver(() => {
			if (!this.masonry) return;
			for (const grid of this.grids) if (grid.fcCols && this.columnCount(grid) !== grid.fcColumns) this.layoutGrid(grid);
		});
		this.resizer.observe(this.rootEl);
	}

	onunload() {
		if (this.observer) this.observer.disconnect();
		this.resizer.disconnect();
	}

	get masonry() {
		return this.rootEl.hasClass('is-masonry');
	}

	/* CSS columns fill one column top to bottom before starting the next, so cards read down, not across. Masonry is therefore laid out here: the grid holds real column elements, and each card goes into whichever column is currently shortest — the first row fills left to right, and every later card lands in the next free slot. */
	columnCount(grid) {
		const gap = parseFloat(getComputedStyle(grid).columnGap) || 0;
		const width = Number(this.opt('cardWidth', 300));
		return Math.max(1, Math.floor((grid.clientWidth + gap) / (width + gap)));
	}

	/** (Re)build a masonry grid's columns and deal every card into them in order. */
	layoutGrid(grid) {
		grid.fcColumns = this.columnCount(grid);
		grid.empty();
		grid.fcCols = Array.from({ length: grid.fcColumns }, () => grid.createDiv({ cls: 'flex-cards-column' }));
		for (const card of grid.fcCards) this.dealCard(grid, card);
	}

	dealCard(grid, card) {
		const shortest = grid.fcCols.reduce((a, b) => (b.offsetHeight < a.offsetHeight ? b : a));
		shortest.appendChild(card);
	}

	placeCard(grid, card) {
		if (!this.masonry) return grid.appendChild(card);
		grid.fcCards.push(card);
		if (!grid.fcCols) {
			this.layoutGrid(grid);
		} else {
			this.dealCard(grid, card);
		}
	}

	opt(key, fallback) {
		const value = this.config.get(key);
		return value === undefined || value === null || value === '' ? fallback : value;
	}

	onDataUpdated() {
		if (this.observer) this.observer.disconnect();
		this.rootEl.empty();
		this.queue = [];
		this.grids = [];

		const order = this.config.getOrder();
		const titleId = this.config.getAsPropertyId('titleProp') || 'file.name';
		const props = order.filter((id) => id !== titleId);
		const clamps = parseClamps(this.opt('clamps', []), this.allProperties.concat(['file.name']));

		this.rootEl.className = `flex-cards flex-cards-theme-${this.opt('theme', 'default')}`;
		this.rootEl.toggleClass('is-masonry', this.opt('layout', 'masonry') === 'masonry');
		this.rootEl.style.setProperty('--fc-width', `${this.opt('cardWidth', 300)}px`);
		this.rootEl.style.setProperty('--fc-lines', String(this.opt('lines', 4)));
		const maxHeight = Number(this.opt('maxHeight', 0));
		this.rootEl.style.setProperty('--fc-max-height', maxHeight ? `${maxHeight}px` : 'none');

		this.settings = {
			titleId,
			props,
			clamps,
			labels: this.opt('labels', true),
			hideEmpty: this.opt('hideEmpty', true),
			titleLines: this.opt('titleLines', 2),
			// The stored value may be a full id or a bare property name depending on how it was set; accept either rather than silently rendering no cover.
			coverId: this.config.getAsPropertyId('cover') || resolveId(String(this.opt('cover', '')).trim(), this.allProperties),
			coverHeight: this.opt('coverHeight', 160),
			classProps: (this.opt('cardClasses', []))
				.map((name) => resolveId(name.trim(), this.allProperties))
				.filter(Boolean),
			editable: parseEditable(this.opt('editable', []), this.allProperties),
		};

		for (const group of this.data.groupedData) {
			if (group.hasKey() && group.key) {
				this.rootEl.createDiv({ cls: 'flex-cards-group', text: group.key.toString() || '—' });
			}
			const grid = this.rootEl.createDiv({ cls: 'flex-cards-grid' });
			grid.fcCards = [];
			this.grids.push(grid);
			for (const entry of group.entries) this.queue.push([grid, entry]);
		}

		this.flush();
	}

	/** Render CHUNK cards, then park a sentinel that renders the next chunk when scrolled into view. */
	flush() {
		if (this.sentinel) this.sentinel.remove();
		for (const [grid, entry] of this.queue.splice(0, CHUNK)) this.renderCard(grid, entry);
		if (!this.queue.length) return;

		this.sentinel = this.rootEl.createDiv({ cls: 'flex-cards-sentinel' });
		this.observer = new IntersectionObserver((entries) => {
			if (entries.some((e) => e.isIntersecting)) {
				this.observer.disconnect();
				this.flush();
			}
		}, { root: this.rootEl, rootMargin: '400px' });
		this.observer.observe(this.sentinel);
	}

	/* Turn the chosen properties into classes on the card, so a snippet can style a card by what is in its frontmatter. A truthy value yields `fc-<property>`, and every value also yields `fc-<property>-<value>`; a list contributes one class per item. */
	classesFor(entry) {
		const out = [];
		for (const id of this.settings.classProps) {
			const value = entry.getValue(id);
			if (!value) continue;
			const prop = slug(id.slice(id.indexOf('.') + 1));
			if (!prop) continue;
			if (value.isTruthy()) out.push(`fc-${prop}`);
			for (const part of value.toString().split(',')) {
				const v = slug(part);
				if (v && v.length <= 32) out.push(`fc-${prop}-${v}`);
			}
		}
		return out;
	}

	renderCard(grid, entry) {
		const { titleId, props, clamps, labels, hideEmpty, titleLines } = this.settings;
		// Built detached and placed last, so masonry measures the finished card.
		const card = createDiv({ cls: ['flex-cards-card', ...this.classesFor(entry)] });
		this.renderCover(card, entry);

		const title = card.createDiv({ cls: 'flex-cards-title' });
		title.dataset.property = titleId;
		title.style.setProperty('--fc-lines', String(clamps[titleId] ?? titleLines));
		this.renderValue(title, entry, titleId);
		if (!title.textContent.trim()) title.setText(entry.file.basename);
		this.linkToNote(title, entry.file);

		for (const id of props) {
			const value = entry.getValue(id);
			const editor = this.settings.editable[id];
			// An editable property has to survive `hideEmpty`, or a field that is missing is a field you can never set.
			if (!editor && hideEmpty && (value === null || value.toString() === '')) continue;
			const row = card.createDiv({ cls: 'flex-cards-property' });
			row.dataset.property = id;
			if (id in clamps) row.style.setProperty('--fc-lines', String(clamps[id]));
			if (labels) row.createDiv({ cls: 'flex-cards-label', text: this.config.getDisplayName(id) });
			const cell = row.createDiv({ cls: 'flex-cards-value' });
			if (editor) this.renderEditable(cell, entry, id, editor);
			else this.renderValue(cell, entry, id);
		}
		this.placeCard(grid, card);
	}

	/* Resolve a cover from whatever the property holds: a wikilink or plain path into the vault, or an http URL. Anything that does not resolve is left out rather than rendered as a broken image. */
	renderCover(card, entry) {
		const { coverId, coverHeight } = this.settings;
		if (!coverId) return;
		const raw = (entry.getValue(coverId)?.toString() || '').trim();
		if (!raw) return;

		const link = raw.replace(/^!?\[\[/, '').replace(/\]\]$/, '').split('|')[0].trim();
		let src = null;
		if (/^https?:\/\//.test(link)) {
			src = link;
		} else {
			const file = this.app.metadataCache.getFirstLinkpathDest(link, entry.file.path);
			if (file) src = this.app.vault.getResourcePath(file);
		}
		if (!src) return;

		const img = card.createEl('img', { cls: 'flex-cards-cover' });
		img.style.height = `${coverHeight}px`;
		img.src = src;
		img.loading = 'lazy';
	}

	renderValue(el, entry, id) {
		const value = entry.getValue(id);
		if (value) value.renderTo(el, this.app.renderContext);
	}

	frontmatterOf(file) {
		return this.app.metadataCache.getFileCache(file)?.frontmatter || {};
	}

	/* Editing goes through `processFrontMatter`, the only public write path — the property editors core uses in table cells are not exported, so the controls here are our own. */
	async setProperty(file, name, value) {
		await this.app.fileManager.processFrontMatter(file, (fm) => {
			fm[name] = value;
		});
	}

	renderEditable(el, entry, id, declaredType) {
		const name = id.slice('note.'.length);
		const raw = this.frontmatterOf(entry.file)[name];

		// A list needs a real multi-value control; until there is one, show it rather than let a text box flatten it to a string.
		if (Array.isArray(raw)) return this.renderValue(el, entry, id);

		const type = declaredType || (typeof raw === 'boolean' ? 'check' : typeof raw === 'number' ? 'number' : 'text');
		el.addClass('is-editable');

		if (type === 'check') {
			const box = el.createEl('input', { type: 'checkbox' });
			box.checked = raw === true;
			box.addEventListener('click', (evt) => evt.stopPropagation());
			box.addEventListener('change', () => this.setProperty(entry.file, name, box.checked));
			return;
		}

		this.renderValue(el, entry, id);
		el.addEventListener('click', (evt) => {
			if (evt.target.closest('a') || el.hasClass('is-editing')) return;
			this.openEditor(el, entry, id, name, raw, type);
		});
	}

	openEditor(el, entry, id, name, raw, type) {
		el.addClass('is-editing');
		el.empty();
		const input = type === 'number'
			? el.createEl('input', { type: 'number', value: raw ?? '' })
			: el.createEl('textarea', { text: raw ?? '' });

		let done = false;
		const close = async (save) => {
			if (done) return;
			done = true;
			const text = input.value;
			el.removeClass('is-editing');
			el.empty();
			if (save && type === 'number' && text.trim() !== '' && !Number.isNaN(Number(text))) {
				await this.setProperty(entry.file, name, Number(text));
			} else if (save && type !== 'number' && text !== String(raw ?? '')) {
				await this.setProperty(entry.file, name, text);
			}
			// A save triggers a re-render of the whole view; a cancel does not, so repaint the cell.
			if (el.isConnected && !el.hasChildNodes()) this.renderValue(el, entry, id);
		};

		input.addEventListener('blur', () => close(true));
		input.addEventListener('keydown', (evt) => {
			if (evt.key === 'Escape') { evt.preventDefault(); close(false); }
			if (evt.key === 'Enter' && !evt.shiftKey) { evt.preventDefault(); close(true); }
		});
		input.focus();
		input.select();
	}

	/* Open the card's own note from its title, whatever property the title is mapped to. A rendered value may already contain links of its own — a `link()` formula, or a property holding a wikilink — and those may point somewhere else entirely, so a click or hover that lands on one is left to it. */
	linkToNote(el, file) {
		if (!file) return;
		el.addClass('flex-cards-title-link');
		el.addEventListener('click', (evt) => {
			if (evt.target.closest('a')) return;
			evt.preventDefault();
			this.app.workspace.openLinkText(file.path, '', obsidian.Keymap.isModEvent(evt));
		});
		el.addEventListener('mouseover', (evt) => {
			if (evt.target.closest('a')) return;
			this.app.workspace.trigger('hover-link', {
				event: evt,
				source: VIEW_TYPE,
				hoverParent: this.app.renderContext,
				targetEl: el,
				linktext: file.path,
			});
		});
	}
}

module.exports = class FlexCardsPlugin extends obsidian.Plugin {
	onload() {
		this.registerBasesView(VIEW_TYPE, {
			name: 'Flex cards',
			icon: 'lucide-layout-grid',
			factory: (controller, containerEl) => new FlexCardsView(controller, containerEl),
			options: () => [
				{
					type: 'dropdown',
					key: 'theme',
					displayName: 'Theme',
					default: 'default',
					options: {
						default: 'Default — bordered card',
						plain: 'Plain — no border, spacing only',
						compact: 'Compact — tight, labels inline',
						paper: 'Paper — serif, roomy leading',
						index: 'Index card — ruled, accent edge',
						callout: 'Callout — tinted panel',
					},
				},
				{ type: 'slider', key: 'cardWidth', displayName: 'Card width', default: 300, min: 180, max: 700, step: 10 },
				{ type: 'property', key: 'cover', displayName: 'Cover image property', placeholder: 'None' },
				{ type: 'slider', key: 'coverHeight', displayName: 'Cover height', default: 160, min: 60, max: 400, step: 10 },
				{
					type: 'dropdown',
					key: 'layout',
					displayName: 'Layout',
					default: 'masonry',
					options: { masonry: 'Masonry (each card its own height)', grid: 'Grid (equal height per row)' },
				},
				{
					type: 'group',
					displayName: 'Text',
					items: [
						{ type: 'slider', key: 'lines', displayName: 'Lines per property', default: 4, min: 1, max: 30, step: 1 },
						{ type: 'slider', key: 'titleLines', displayName: 'Lines in title', default: 2, min: 1, max: 10, step: 1 },
						{
							type: 'multitext',
							key: 'clamps',
							displayName: 'Per-property lines',
							placeholder: 'claude_summary: 8',
						},
						{ type: 'slider', key: 'maxHeight', displayName: 'Max card height (0 = none)', default: 0, min: 0, max: 1200, step: 20 },
					],
				},
				{
					type: 'group',
					displayName: 'Content',
					items: [
						{ type: 'property', key: 'titleProp', displayName: 'Title property', placeholder: 'File name' },
						{ type: 'toggle', key: 'labels', displayName: 'Show property names', default: true },
						{ type: 'toggle', key: 'hideEmpty', displayName: 'Hide empty properties', default: true },
						{
							type: 'multitext',
							key: 'cardClasses',
							displayName: 'Properties to expose as card classes',
							placeholder: 'Final Postdoc',
						},
						{
							type: 'multitext',
							key: 'editable',
							displayName: 'Editable properties',
							placeholder: 'Will Apply: check',
						},
					],
				},
			],
		});
	}
};
