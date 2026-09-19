# shared-ui

Reusable DataTables filtering, modals, CSV export, and expandable rows.  
Requires Bootstrap 5.3, jQuery, and DataTables.

## Usage

Add to any project via jsDelivr (no npm, no build step):

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/abigailhaddad/shared-ui@main/shared.css">
<script src="https://cdn.jsdelivr.net/gh/abigailhaddad/shared-ui@main/shared.js"></script>
```

### Theming

Set just two variables and everything derives automatically (chip backgrounds, hover states, focus rings, button shades):

```html
<style>
  :root {
    --color-primary: #1a1a2e;   /* dark: headings, nav backgrounds */
    --color-accent:  #e94560;   /* interactive: buttons, chips, links */
  }
</style>
```

Optional extras:

```css
--color-danger: #f97316;   /* default: red */
--color-bg:     #f8f9fa;   /* default: white */
--color-bg-alt: #eef2f7;   /* default: light gray */
```

Full list is at the top of `shared.css`. Lighter/darker variants (`--color-accent-light`, etc.) are computed automatically via `color-mix()` — override them only if you need exact control.

### Custom fonts

```html
<style>
  :root {
    --font-sans:    'Inter', sans-serif;
    --font-display: 'Libre Baskerville', serif;
  }
</style>
```

## Main components

| Class / Function | What it does |
|---|---|
| `ColumnFilterManager` | Multiselect / text / range column filters with URL sync and filter chips |
| `ColumnFilterManager#setMultiselect(colIndex, values)` | Sets a multiselect column's filter programmatically (e.g. from a chart click), replacing any existing filter on that column |
| `initDataTableWithFilters()` | One-call setup: DataTable + filters + CSV button |
| `createModal()` / `closeModal()` | Bootstrap 5.3 modal factory |
| `DetailModal` | Bootstrap modal wrapper for detail views |
| `StatsModalManager` | Modal for stats/summary popups |
| `setupDataTableExpandHandlers()` | Expand/collapse child rows in a DataTable |
| `createExpandableParentRow()` | Build a parent row element with expand control |
| `downloadTableAsCSV()` / `addCsvDownloadButton()` | CSV export of filtered rows |
| `showToast()` | Slide-up toast notification |
| `escapeHtml()`, `highlightPhrases()` | DOM utilities |

### Filter persistence

By default, `ColumnFilterManager` (and `initDataTableWithFilters`) remembers the
last-applied filters in `sessionStorage` and restores them when the page is
reopened in the same tab with no filter params in the URL. Pass
`persistFilters: false` to turn this off -- a bare URL then always means "no
filter", and filters are never read from or written to `sessionStorage`:

```js
initDataTableWithFilters({
  tableSelector: '#myTable',
  fieldTypes: { status: 'multiselect' },
  columns: [{ field: 'status', label: 'Status' }],
  persistFilters: false,
});
```

## Pinning a version

Replace `@main` with a commit SHA or tag to pin:

```html
href="https://cdn.jsdelivr.net/gh/abigailhaddad/shared-ui@abc1234/shared.css"
```
