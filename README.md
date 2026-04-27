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
| `initDataTableWithFilters()` | One-call setup: DataTable + filters + CSV button |
| `createModal()` / `closeModal()` | Bootstrap 5.3 modal factory |
| `DetailModal` | Bootstrap modal wrapper for detail views |
| `StatsModalManager` | Modal for stats/summary popups |
| `setupDataTableExpandHandlers()` | Expand/collapse child rows in a DataTable |
| `createExpandableParentRow()` | Build a parent row element with expand control |
| `downloadTableAsCSV()` / `addCsvDownloadButton()` | CSV export of filtered rows |
| `showToast()` | Slide-up toast notification |
| `escapeHtml()`, `highlightPhrases()` | DOM utilities |

## Pinning a version

Replace `@main` with a commit SHA or tag to pin:

```html
href="https://cdn.jsdelivr.net/gh/abigailhaddad/shared-ui@abc1234/shared.css"
```
