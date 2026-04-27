/**
 * shared-ui — DataTables filtering, modals, CSV export, expandable rows
 * Requires: jQuery, Bootstrap 5.3, DataTables
 */

// ============================================
// Utility Functions
// ============================================

function getCleanURL() {
    const url = new URL(window.location);
    if (url.pathname.endsWith('/index.html')) {
        url.pathname = url.pathname.replace(/\/index\.html$/, '/');
    }
    return url;
}

function updateBrowserURL(newParams) {
    const url = getCleanURL();
    const params = newParams instanceof URLSearchParams ? newParams : new URLSearchParams(newParams);
    url.search = params.toString();
    window.history.replaceState({}, '', url);
}

function escapeHtml(text) {
    if (!text) return '';
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(text).replace(/[&<>"']/g, m => map[m]);
}

function highlightPhrases(text, phrases) {
    if (!text || !phrases || phrases.length === 0) return escapeHtml(text);
    let highlighted = escapeHtml(text);
    const sortedPhrases = [...phrases].sort((a, b) => b.length - a.length);
    sortedPhrases.forEach(phrase => {
        const escapedPhrase = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b${escapedPhrase}\\b|${escapedPhrase}`, 'gi');
        highlighted = highlighted.replace(regex, match => `<span class="highlight">${match}</span>`);
    });
    return highlighted;
}

function buildMultiselectOptionsHtml(sortedValues, options = {}) {
    const { selectedValues = [], maxHeight = '300px', itemStyle = '', scrollHint = false } = options;
    const labelStyle = itemStyle ? ` style="${itemStyle}"` : '';
    return `
        <input type="text" class="filter-search filter-options-search" placeholder="Search options...">
        <div class="filter-options" style="max-height: ${maxHeight}; overflow-y: auto;">
            ${sortedValues.map(val => `
                <label class="filter-option"${labelStyle}>
                    <input type="checkbox" value="${escapeHtml(val)}" ${selectedValues.includes(val) ? 'checked' : ''}${itemStyle ? ' style="margin-right: 8px;"' : ''}>
                    ${escapeHtml(val)}
                </label>
            `).join('')}
        </div>
        ${scrollHint ? '<div class="scroll-hint" style="text-align: center; font-size: 12px; color: #888; padding: 4px 0;">↓ Scroll for more</div>' : ''}
    `;
}

function wireMultiselectSearch(popover, focus = true) {
    const searchInput = popover.querySelector('.filter-options-search');
    if (!searchInput) return;
    searchInput.addEventListener('input', function() {
        const query = this.value.toLowerCase();
        popover.querySelectorAll('.filter-option').forEach(el => {
            el.style.display = el.textContent.toLowerCase().includes(query) ? '' : 'none';
        });
    });
    if (focus) searchInput.focus();
}

// ============================================
// Modal Management (Bootstrap 5.3)
// ============================================

function createModal(options = {}) {
    const modalId = 'modal-' + Math.random().toString(36).substr(2, 9);
    const sizeClass = options.size ? `modal-${options.size}` : '';
    const centeredClass = options.centered !== false ? 'modal-dialog-centered' : '';

    const modal = document.createElement('div');
    modal.className = `modal fade ${options.className || ''}`;
    modal.id = modalId;
    modal.setAttribute('tabindex', '-1');
    modal.setAttribute('aria-hidden', 'true');

    const dialogDiv = document.createElement('div');
    dialogDiv.className = `modal-dialog ${sizeClass} ${centeredClass}`;

    const contentDiv = document.createElement('div');
    contentDiv.className = 'modal-content';

    const bodyDiv = document.createElement('div');
    bodyDiv.className = 'modal-body';

    if (options.content) bodyDiv.innerHTML = options.content;

    contentDiv.appendChild(bodyDiv);
    dialogDiv.appendChild(contentDiv);
    modal.appendChild(dialogDiv);
    document.body.appendChild(modal);

    if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
        const bsModal = new bootstrap.Modal(modal, { backdrop: true, keyboard: true });
        modal._bsModal = bsModal;
        if (options.onClose) modal.addEventListener('hidden.bs.modal', options.onClose);
        modal.addEventListener('hidden.bs.modal', () => modal.remove());
        bsModal.show();
    } else {
        // Bootstrap not available — use CSS-only overlay
        modal.classList.add('modal-fallback');
        modal.style.display = 'flex';
        modal._isFallback = true;
        modal.addEventListener('click', e => { if (e.target === modal) closeModal(modal); });
        const escHandler = e => {
            if (e.key === 'Escape') { closeModal(modal); document.removeEventListener('keydown', escHandler); }
        };
        document.addEventListener('keydown', escHandler);
        if (options.onClose) modal.addEventListener('modal-close', options.onClose);
        requestAnimationFrame(() => modal.classList.add('show'));
    }

    return modal;
}

function closeModal(modal) {
    if (modal && modal._bsModal) {
        modal._bsModal.hide();
    } else if (modal && modal._isFallback) {
        modal.dispatchEvent(new Event('modal-close'));
        modal.classList.remove('show');
        setTimeout(() => modal.remove(), 200);
    } else if (modal && modal.parentNode) {
        modal.remove();
    }
}

// ============================================
// Filter System (legacy, for non-DataTables use)
// ============================================

class FilterManager {
    constructor(options) {
        this.tableId = options.tableId;
        this.filterBarId = options.filterBarId;
        this.columns = options.columns || [];
        this.getRowData = options.getRowData;
        this.filters = [];
        this.allData = [];
        this._registerFilter();
    }

    setData(data) { this.allData = data; }

    _registerFilter() {
        const self = this;
        $.fn.dataTable.ext.search.push(function(settings, data, dataIndex) {
            if (settings.nTable.id !== self.tableId) return true;
            if (self.filters.length === 0) return true;

            const table = $(`#${self.tableId}`).DataTable();
            const row = table.row(dataIndex).node();
            if (!row) return true;

            const rowData = self.getRowData ? self.getRowData(row) : {};
            for (let filter of self.filters) {
                if (filter.type === 'multiselect') {
                    const value = rowData[filter.field] || '';
                    const hasMatch = filter.values.some(v =>
                        typeof value === 'string'
                            ? (value === v || value.toLowerCase().includes(v.toLowerCase()))
                            : value == v
                    );
                    if (!hasMatch) return false;
                } else if (filter.type === 'text') {
                    const value = String(rowData[filter.field] || '').toLowerCase();
                    if (!value.includes(filter.value.toLowerCase())) return false;
                }
            }
            return true;
        });
    }

    openFilterDialog() {
        const content = `
            <div class="filter-popover">
                <div class="filter-title">Add Filter</div>
                <div class="filter-options">
                    ${this.columns.map(col => `
                        <label class="filter-option">
                            <input type="checkbox" value="${col.field}" data-type="${col.type}">
                            ${escapeHtml(col.label)}
                        </label>
                    `).join('')}
                </div>
            </div>
        `;
        const modal = createModal({ content });
        modal.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                closeModal(modal);
                const col = this.columns.find(c => c.field === checkbox.value);
                if (col) this.openFilterInput(col);
            });
        });
    }

    openFilterInput(column) {
        let optionsHtml = '';
        if (column.type === 'multiselect') {
            const values = new Set();
            this.allData.forEach(item => {
                const val = item[column.field];
                if (val && val !== 'null' && val !== null) values.add(val);
            });
            optionsHtml = buildMultiselectOptionsHtml(Array.from(values).sort());
        } else {
            optionsHtml = `<input type="text" class="filter-search filter-text-input" placeholder="Enter ${column.label}...">`;
        }

        const content = `
            <div class="filter-popover">
                <div class="filter-title">Filter by ${escapeHtml(column.label)}</div>
                ${optionsHtml}
                <div class="filter-buttons">
                    <button class="btn btn-clear">Cancel</button>
                    <button class="btn btn-apply">Add Filter</button>
                </div>
            </div>
        `;
        const modal = createModal({ content });
        const popover = modal.querySelector('.filter-popover');
        wireMultiselectSearch(popover);
        popover.querySelector('.btn-clear').addEventListener('click', () => closeModal(modal));
        popover.querySelector('.btn-apply').addEventListener('click', () => {
            if (column.type === 'multiselect') {
                const checked = Array.from(popover.querySelectorAll('input:checked')).map(c => c.value);
                if (checked.length > 0) this.addFilter({ field: column.field, label: column.label, type: column.type, values: checked });
            } else {
                const input = popover.querySelector('.filter-text-input');
                if (input && input.value.trim()) this.addFilter({ field: column.field, label: column.label, type: column.type, value: input.value.trim() });
            }
            closeModal(modal);
        });
        const textInput = popover.querySelector('.filter-text-input');
        if (textInput) textInput.focus();
    }

    addFilter(filter) { this.filters.push(filter); this.updateDisplay(); this.apply(); }
    removeFilter(index) { this.filters.splice(index, 1); this.updateDisplay(); this.apply(); }
    clearFilters() { this.filters = []; this.updateDisplay(); this.apply(); }

    updateDisplay() {
        const filtersBar = document.getElementById(this.filterBarId);
        if (!filtersBar) return;
        const empty = filtersBar.querySelector('.filters-bar-empty');
        filtersBar.querySelectorAll('.filter-chip').forEach(chip => chip.remove());
        if (this.filters.length === 0) {
            if (empty) empty.style.display = '';
        } else {
            if (empty) empty.style.display = 'none';
            this.filters.forEach((filter, index) => {
                const chip = document.createElement('div');
                chip.className = 'filter-chip';
                const displayValue = filter.type === 'multiselect' ? filter.values.join(', ') : filter.value;
                chip.innerHTML = `
                    <span class="filter-chip-label">${escapeHtml(filter.label)}:</span>
                    <span class="filter-chip-value">${escapeHtml(displayValue)}</span>
                    <span class="filter-chip-remove" data-index="${index}">&times;</span>
                `;
                chip.querySelector('.filter-chip-remove').addEventListener('click', () => this.removeFilter(index));
                const addBtn = filtersBar.querySelector('.add-filter-btn');
                if (addBtn) filtersBar.insertBefore(chip, addBtn);
                else filtersBar.appendChild(chip);
            });
        }
    }

    apply() {
        if ($.fn.dataTable.isDataTable(`#${this.tableId}`)) {
            $(`#${this.tableId}`).DataTable().draw();
        }
    }
}

// ============================================
// DataTable Factory
// ============================================

function createDataTable(options) {
    const { tableId, data, columns, pageLength = 25, order = [[0, 'asc']], columnDefs = [] } = options;
    if ($.fn.dataTable.isDataTable(`#${tableId}`)) $(`#${tableId}`).DataTable().destroy();
    return $(`#${tableId}`).DataTable({
        data, columns, pageLength, order, columnDefs,
        language: {
            emptyTable: 'No data available',
            info: 'Showing _START_ to _END_ of _TOTAL_ entries',
            infoEmpty: 'Showing 0 to 0 of 0 entries',
            infoFiltered: '(filtered from _MAX_ total entries)',
            lengthMenu: 'Show _MENU_ entries',
            search: 'Search:',
            zeroRecords: 'No matching records found'
        }
    });
}

function populateTableBody(tbodyId, data, rowRenderer) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="100" style="text-align: center; padding: 20px; color: #999;">No data available</td></tr>';
        return;
    }
    data.forEach((item, index) => {
        const rowHtml = rowRenderer(item, index);
        if (rowHtml) tbody.insertAdjacentHTML('beforeend', rowHtml);
    });
}

// ============================================
// Detail Modal (Bootstrap 5.3)
// ============================================

class DetailModal {
    constructor(options) {
        this.modalId = options.modalId;
        this.titleId = options.titleId;
        this.contentId = options.contentId;
        this.renderContent = options.renderContent;
        this.currentData = null;
        this.bsModal = null;
        this._initBootstrapModal();
    }

    _initBootstrapModal() {
        const modal = document.getElementById(this.modalId);
        if (modal && typeof bootstrap !== 'undefined') this.bsModal = new bootstrap.Modal(modal);
    }

    open(data, title) {
        this.currentData = data;
        const titleEl = document.getElementById(this.titleId);
        const contentEl = document.getElementById(this.contentId);
        if (titleEl) titleEl.textContent = title;
        if (contentEl && this.renderContent) contentEl.innerHTML = this.renderContent(data);
        if (this.bsModal) {
            this.bsModal.show();
        } else {
            const modal = document.getElementById(this.modalId);
            if (modal) modal.classList.add('show');
        }
    }

    close() {
        if (this.bsModal) {
            this.bsModal.hide();
        } else {
            const modal = document.getElementById(this.modalId);
            if (modal) modal.classList.remove('show');
        }
        this.currentData = null;
    }
}

// ============================================
// Stats Display
// ============================================

function updateStats(stats) {
    Object.entries(stats).forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    });
}

// ============================================
// Column Filter Component (DataTables native)
// ============================================

/**
 * ColumnFilterManager — per-column filtering with multiselect, text, and range dialogs.
 * Syncs filter state to URL query params for shareable links.
 *
 * Usage:
 *   const fm = new ColumnFilterManager({
 *     tableSelector: '#myTable',
 *     columns: [
 *       { index: 0, name: 'Status', type: 'multiselect' },
 *       { index: 1, name: 'Name',   type: 'text' },
 *       { index: 2, name: 'Count',  type: 'range' },
 *     ],
 *     filterBarId: 'filtersBar',   // optional
 *   });
 *   fm.init(dataTableInstance);
 */
class ColumnFilterManager {
    constructor(options) {
        this.tableSelector = options.tableSelector;
        this.columns = options.columns || [];
        this.filterBarId = options.filterBarId || null;
        this.syncURL = options.syncURL !== false;
        this.showCopyLinkButton = options.showCopyLinkButton !== false;
        this.table = null;
        this.activeFilters = {};
    }

    init(dataTable) {
        this.table = dataTable;
        this._setupRangeFilterSearch();
        this._setupHeaderClicks();
        if (this.filterBarId) this._setupFilterBar();
        if (this.syncURL) this._applyFiltersFromURL();
    }

    _setupRangeFilterSearch() {
        const self = this;
        $.fn.dataTable.ext.search.push(function(settings, data, dataIndex) {
            if (settings.nTable !== self.table.table().node()) return true;
            for (const colIndex in self.activeFilters) {
                const filter = self.activeFilters[colIndex];
                if (filter.type === 'range') {
                    const cellValue = data[parseInt(colIndex)].replace(/,/g, '');
                    const val = parseFloat(cellValue);
                    if (isNaN(val)) return false;
                    if (filter.min !== null && val < filter.min) return false;
                    if (filter.max !== null && val > filter.max) return false;
                }
            }
            return true;
        });
    }

    _setupFilterBar() {
        const filterBar = document.getElementById(this.filterBarId);
        if (!filterBar) return;

        const buttonContainer = document.getElementById('toolbarButtons') || filterBar;

        let addBtn = buttonContainer.querySelector('.add-filter-btn');
        if (!addBtn) {
            addBtn = document.createElement('button');
            addBtn.className = 'add-filter-btn';
            addBtn.textContent = '+ Add Filter';
            buttonContainer.appendChild(addBtn);
        }
        addBtn.addEventListener('click', () => this._openFilterSelection());

        if (this.syncURL && this.showCopyLinkButton) {
            let copyBtn = buttonContainer.querySelector('.copy-link-btn');
            if (!copyBtn) {
                copyBtn = document.createElement('button');
                copyBtn.className = 'copy-link-btn';
                copyBtn.textContent = '🔗 Copy Link';
                copyBtn.title = 'Copy shareable link with current filters';
                buttonContainer.appendChild(copyBtn);
                copyBtn.addEventListener('click', () => this.copyShareableURL());
            }
        }
    }

    _openFilterSelection() {
        const content = `
            <div class="filter-popover" style="min-width: 280px;">
                <div class="filter-title">Add Filter</div>
                <div class="filter-options" style="max-height: 400px;">
                    ${this.columns.map(col => `
                        <label class="filter-option" style="display: block; padding: 6px 4px; cursor: pointer;">
                            <input type="checkbox" value="${col.index}" data-name="${escapeHtml(col.name)}" data-type="${col.type}" style="margin-right: 8px;">
                            ${escapeHtml(col.name)}
                        </label>
                    `).join('')}
                </div>
            </div>
        `;
        const modal = createModal({ content });
        modal.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                if (checkbox.checked) {
                    closeModal(modal);
                    const colIndex = parseInt(checkbox.value);
                    const col = this.columns.find(c => c.index === colIndex);
                    if (col) this._openFilterDialog(col, colIndex);
                }
            });
        });
    }

    _setupHeaderClicks() {}

    _openFilterDialog(col, colIndex) {
        if (col.type === 'multiselect') this._openMultiselectDialog(col, colIndex);
        else if (col.type === 'range') this._openRangeDialog(col, colIndex);
        else this._openTextDialog(col, colIndex);
    }

    _openMultiselectDialog(col, colIndex) {
        const self = this;
        const values = new Set();
        this.table.column(colIndex).data().each(function(val) {
            const text = $('<div>').html(val).text().trim();
            if (text && text.includes(' | ')) {
                text.split(' | ').forEach(item => {
                    const trimmed = item.trim();
                    if (trimmed && trimmed !== '—') values.add(trimmed);
                });
            } else if (text && text !== '—') {
                values.add(text);
            }
        });

        const sortedValues = Array.from(values).sort(col.sortFn || undefined);
        const selectedValues = (this.activeFilters[colIndex] || {}).values || [];

        const multiselectHtml = buildMultiselectOptionsHtml(sortedValues, {
            selectedValues,
            itemStyle: 'display: block; padding: 6px 4px; cursor: pointer;',
            scrollHint: true
        });

        const content = `
            <div class="filter-popover" style="min-width: 280px;">
                <div class="filter-title">Filter: ${escapeHtml(col.name)}</div>
                ${multiselectHtml}
                <div class="filter-buttons" style="margin-top: 12px;">
                    <button class="btn btn-clear">Clear</button>
                    <button class="btn btn-apply">Apply</button>
                </div>
            </div>
        `;

        const modal = createModal({ content });
        const $popover = $(modal).find('.filter-popover');
        wireMultiselectSearch($popover[0]);

        const optionsEl = $popover.find('.filter-options')[0];
        const hintEl = $popover.find('.scroll-hint')[0];
        if (optionsEl && hintEl) {
            modal.addEventListener('shown.bs.modal', () => {
                if (optionsEl.scrollHeight <= optionsEl.clientHeight) hintEl.style.display = 'none';
            });
            optionsEl.addEventListener('scroll', () => {
                hintEl.style.display = (optionsEl.scrollTop + optionsEl.clientHeight >= optionsEl.scrollHeight - 2) ? 'none' : '';
            });
        }

        $popover.find('.btn-clear').on('click', function() {
            delete self.activeFilters[colIndex];
            self.table.column(colIndex).search('').draw();
            self._updateFilterBar();
            if (self.syncURL) self._updateURL();
            closeModal(modal);
        });

        $popover.find('.btn-apply').on('click', function() {
            const checked = [];
            $popover.find('input[type="checkbox"]:checked').each(function() { checked.push($(this).val()); });
            if (checked.length > 0) {
                self.activeFilters[colIndex] = { type: 'multiselect', values: checked, name: col.name };
                self.table.column(colIndex).search(checked.map(v => escapeRegex(v)).join('|'), true, false, true).draw();
            } else {
                delete self.activeFilters[colIndex];
                self.table.column(colIndex).search('').draw();
            }
            self._updateFilterBar();
            if (self.syncURL) self._updateURL();
            closeModal(modal);
        });
    }

    _openTextDialog(col, colIndex) {
        const self = this;
        const currentValue = (this.activeFilters[colIndex] || {}).value || '';

        const content = `
            <div class="filter-popover" style="min-width: 280px;">
                <div class="filter-title">Filter: ${escapeHtml(col.name)}</div>
                <input type="text" class="filter-text-input filter-search" placeholder="Enter search term..." value="${escapeHtml(currentValue)}">
                <div class="filter-buttons" style="margin-top: 12px;">
                    <button class="btn btn-clear">Clear</button>
                    <button class="btn btn-apply">Apply</button>
                </div>
            </div>
        `;

        const modal = createModal({ content });
        const $popover = $(modal).find('.filter-popover');
        const $input = $popover.find('.filter-text-input');
        $input.focus();
        $input.on('keypress', function(e) { if (e.key === 'Enter') $popover.find('.btn-apply').click(); });

        $popover.find('.btn-clear').on('click', function() {
            delete self.activeFilters[colIndex];
            self.table.column(colIndex).search('').draw();
            self._updateFilterBar();
            if (self.syncURL) self._updateURL();
            closeModal(modal);
        });

        $popover.find('.btn-apply').on('click', function() {
            const value = $input.val().trim();
            if (value) {
                self.activeFilters[colIndex] = { type: 'text', value, name: col.name };
                self.table.column(colIndex).search(value).draw();
            } else {
                delete self.activeFilters[colIndex];
                self.table.column(colIndex).search('').draw();
            }
            self._updateFilterBar();
            if (self.syncURL) self._updateURL();
            closeModal(modal);
        });
    }

    _openRangeDialog(col, colIndex) {
        const self = this;
        const currentFilter = this.activeFilters[colIndex] || {};
        const min = currentFilter.min || '';
        const max = currentFilter.max || '';

        const content = `
            <div class="filter-popover" style="min-width: 280px;">
                <div class="filter-title">Filter: ${escapeHtml(col.name)}</div>
                <div style="margin: 12px 0;">
                    <label style="display: block; margin-bottom: 8px;">
                        <span style="display: block; font-size: 12px; margin-bottom: 4px;">Minimum:</span>
                        <input type="number" class="filter-range-min filter-search" placeholder="Min value" value="${escapeHtml(min)}" style="width: 100%; padding: 6px;">
                    </label>
                    <label style="display: block; margin-bottom: 8px;">
                        <span style="display: block; font-size: 12px; margin-bottom: 4px;">Maximum:</span>
                        <input type="number" class="filter-range-max filter-search" placeholder="Max value" value="${escapeHtml(max)}" style="width: 100%; padding: 6px;">
                    </label>
                </div>
                <div class="filter-buttons" style="margin-top: 12px;">
                    <button class="btn btn-clear">Clear</button>
                    <button class="btn btn-apply">Apply</button>
                </div>
            </div>
        `;

        const modal = createModal({ content });
        const $popover = $(modal).find('.filter-popover');
        const $minInput = $popover.find('.filter-range-min');
        const $maxInput = $popover.find('.filter-range-max');
        $minInput.focus();

        $popover.find('.btn-clear').on('click', function() {
            delete self.activeFilters[colIndex];
            self.table.draw();
            self._updateFilterBar();
            if (self.syncURL) self._updateURL();
            closeModal(modal);
        });

        $popover.find('.btn-apply').on('click', function() {
            const minVal = $minInput.val().trim();
            const maxVal = $maxInput.val().trim();
            if (minVal || maxVal) {
                self.activeFilters[colIndex] = {
                    type: 'range',
                    min: minVal ? parseFloat(minVal) : null,
                    max: maxVal ? parseFloat(maxVal) : null,
                    name: col.name
                };
                self.table.draw();
            } else {
                delete self.activeFilters[colIndex];
                self.table.draw();
            }
            self._updateFilterBar();
            if (self.syncURL) self._updateURL();
            closeModal(modal);
        });
    }

    _updateFilterBar() {
        if (!this.filterBarId) return;
        const filterBar = document.getElementById(this.filterBarId);
        if (!filterBar) return;

        filterBar.querySelectorAll('.filter-chip.column-filter-chip').forEach(c => c.remove());
        const existingLabel = filterBar.querySelector('.bar-label.filter-label');
        if (existingLabel) existingLabel.remove();

        const hasColumnFilters = Object.keys(this.activeFilters).length > 0;
        const hasSearchChip = filterBar.querySelector('#search-chip') !== null;

        if (hasColumnFilters || hasSearchChip) {
            const label = document.createElement('span');
            label.className = 'bar-label filter-label';
            label.textContent = 'Filtered by:';
            filterBar.insertBefore(label, filterBar.firstChild);

            Object.entries(this.activeFilters).forEach(([colIndex, filter]) => {
                const chip = document.createElement('div');
                chip.className = 'filter-chip column-filter-chip';

                let displayValue;
                if (filter.type === 'multiselect') {
                    displayValue = filter.values.join(', ');
                } else if (filter.type === 'range') {
                    const parts = [];
                    if (filter.min !== null) parts.push(`≥ ${filter.min.toLocaleString()}`);
                    if (filter.max !== null) parts.push(`≤ ${filter.max.toLocaleString()}`);
                    displayValue = parts.join(' and ');
                } else {
                    displayValue = filter.value;
                }

                chip.innerHTML = `
                    <span class="filter-chip-label">${escapeHtml(filter.name)}:</span>
                    <span class="filter-chip-value">${escapeHtml(displayValue)}</span>
                    <span class="filter-chip-remove" data-index="${colIndex}">&times;</span>
                `;

                chip.querySelector('.filter-chip-remove').addEventListener('click', () => {
                    delete this.activeFilters[colIndex];
                    this.table.column(parseInt(colIndex)).search('').draw();
                    this._updateFilterBar();
                    if (this.syncURL) this._updateURL();
                });

                filterBar.appendChild(chip);
            });
        }
    }

    clearAll() {
        Object.keys(this.activeFilters).forEach(colIndex => {
            this.table.column(parseInt(colIndex)).search('');
        });
        this.activeFilters = {};
        this._updateFilterBar();
        if (this.syncURL) this._updateURL();
        this.table.draw();
    }

    _saveToSession() {
        try {
            const key = 'columnFilters_' + this.tableSelector;
            if (Object.keys(this.activeFilters).length > 0) {
                sessionStorage.setItem(key, JSON.stringify(this.activeFilters));
            } else {
                sessionStorage.removeItem(key);
            }
        } catch (e) {}
    }

    _loadFromSession() {
        try {
            const key = 'columnFilters_' + this.tableSelector;
            const saved = sessionStorage.getItem(key);
            return saved ? JSON.parse(saved) : null;
        } catch (e) { return null; }
    }

    _updateURL() {
        const url = getCleanURL();

        // Preserve sort state
        const sortVal = url.searchParams.getAll('sort');
        url.search = '';
        if (sortVal.length > 0) sortVal.forEach(v => url.searchParams.append('sort', v));

        Object.entries(this.activeFilters).forEach(([colIndex, filter]) => {
            const paramKey = filter.name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
            if (filter.type === 'multiselect') {
                url.searchParams.set(paramKey, filter.values.join(','));
            } else if (filter.type === 'range') {
                const minStr = filter.min !== null ? filter.min : '';
                const maxStr = filter.max !== null ? filter.max : '';
                url.searchParams.set(paramKey, `${minStr}-${maxStr}`);
            } else {
                url.searchParams.set(paramKey, filter.value);
            }
        });

        window.history.replaceState({}, '', url);
        this._saveToSession();
    }

    _applyFiltersFromState(savedFilters) {
        Object.entries(savedFilters).forEach(([colIndex, filter]) => {
            const idx = parseInt(colIndex);
            this.activeFilters[idx] = filter;
            if (filter.type === 'multiselect') {
                this.table.column(idx).search(filter.values.map(v => escapeRegex(v)).join('|'), true, false);
            } else if (filter.type !== 'range') {
                this.table.column(idx).search(filter.value);
            }
        });
        this._updateFilterBar();
        if (this.syncURL) this._updateURL();
        this.table.draw();
    }

    _applyFiltersFromURL() {
        const params = new URLSearchParams(window.location.search);

        const paramToColumn = {};
        this.columns.forEach(col => {
            const paramKey = col.name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
            paramToColumn[paramKey] = col;
        });

        const hasColumnFilterParams = Array.from(params.keys()).some(k => paramToColumn[k]);

        if (!hasColumnFilterParams) {
            const saved = this._loadFromSession();
            if (saved && Object.keys(saved).length > 0) this._applyFiltersFromState(saved);
            return;
        }

        params.forEach((value, key) => {
            const col = paramToColumn[key];
            if (!col) return;

            if (col.type === 'multiselect') {
                const values = value.split(',').map(v => v.trim()).filter(v => v);
                if (values.length > 0) {
                    this.activeFilters[col.index] = { type: 'multiselect', values, name: col.name };
                    this.table.column(col.index).search(values.map(v => escapeRegex(v)).join('|'), true, false);
                }
            } else if (col.type === 'range') {
                const parts = value.split('-');
                const min = parts[0] ? parseFloat(parts[0]) : null;
                const max = parts[1] ? parseFloat(parts[1]) : null;
                if (min !== null || max !== null) {
                    this.activeFilters[col.index] = { type: 'range', min, max, name: col.name };
                }
            } else {
                if (value) {
                    this.activeFilters[col.index] = { type: 'text', value, name: col.name };
                    this.table.column(col.index).search(value);
                }
            }
        });

        this._updateFilterBar();
        this._saveToSession();
        this.table.draw();
    }

    copyShareableURL() {
        const url = window.location.href;
        navigator.clipboard.writeText(url).then(() => {
            showToast('Link copied to clipboard!');
        }).catch(() => {
            showToast('Failed to copy link', true);
        });
    }
}

// ============================================
// Utilities
// ============================================

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseDate(dateStr) {
    if (!dateStr) return null;
    const dateMatch = dateStr.match(/(\w+)\.\s+(\d+),\s+(\d{4})/);
    if (dateMatch) {
        const abbrevMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const month = abbrevMonths.findIndex(m => m.toLowerCase() === dateMatch[1].toLowerCase());
        const day = parseInt(dateMatch[2]);
        const year = parseInt(dateMatch[3]);
        if (month !== -1 && !isNaN(day) && !isNaN(year)) return new Date(year, month, day);
    }
    return null;
}

function truncateUrl(url, maxLength = 60) {
    if (!url) return '';
    return url.length > maxLength ? url.substring(0, maxLength) + '...' : url;
}

// ============================================
// Config Helper for Column Filters
// ============================================

/**
 * Build ColumnFilterManager column config from a fieldTypes map.
 *
 * @param {Object} fieldTypes - { fieldName: 'multiselect'|'text'|'range' }
 * @param {Array}  columns    - [{ field, label, index? }]
 * @returns {Array} config for ColumnFilterManager
 *
 * Example:
 *   buildColumnFilters({ status: 'multiselect', name: 'text' }, [
 *     { field: 'name',   label: 'Name'   },
 *     { field: 'status', label: 'Status' },
 *   ])
 */
function buildColumnFilters(fieldTypes, columns) {
    const filterColumns = [];
    columns.forEach((col, loopIndex) => {
        const filterType = fieldTypes[col.field];
        if (filterType) {
            const entry = { index: col.index !== undefined ? col.index : loopIndex, name: col.label, type: filterType };
            if (col.sortFn) entry.sortFn = col.sortFn;
            filterColumns.push(entry);
        }
    });
    return filterColumns;
}

// ============================================
// Stats Modal Manager (Bootstrap 5.3)
// ============================================

class StatsModalManager {
    constructor(options) {
        this.modalId = options.modalId;
        this.linkId = options.linkId;
        this.closeId = options.closeId;
        this.bodyId = options.bodyId;
        this.loadContent = options.loadContent;

        this.modal = document.getElementById(this.modalId);
        this.link = document.getElementById(this.linkId);
        this.body = document.getElementById(this.bodyId);
        this.bsModal = null;

        this._initBootstrapModal();
        this._setupEventListeners();
    }

    _initBootstrapModal() {
        if (this.modal && typeof bootstrap !== 'undefined') this.bsModal = new bootstrap.Modal(this.modal);
    }

    _setupEventListeners() {
        if (this.link) {
            this.link.addEventListener('click', e => { e.preventDefault(); this.open(); });
        }
    }

    open() {
        if (this.body) this.body.textContent = 'Loading...';
        if (this.loadContent) this.loadContent(this.body);
        if (this.bsModal) this.bsModal.show();
        else if (this.modal) this.modal.classList.add('active');
    }

    close() {
        if (this.bsModal) this.bsModal.hide();
        else if (this.modal) this.modal.classList.remove('active');
    }

    setContent(html) {
        if (this.body) this.body.innerHTML = html;
    }
}

// ============================================
// Filter Bar Factory
// ============================================

function ensureFilterBar(tableSelector, filterBarId) {
    let filterBar = document.getElementById(filterBarId);
    if (!filterBar) {
        const table = document.querySelector(tableSelector);
        if (table) {
            const container = document.createElement('div');
            container.className = 'filters-bar-container';
            const bar = document.createElement('div');
            bar.className = 'filters-bar';
            bar.id = filterBarId;
            bar.innerHTML = `
                <span class="filters-bar-empty">No filters applied</span>
                <button class="add-filter-btn" id="${filterBarId}AddBtn">+ Add Filter</button>
            `;
            container.appendChild(bar);
            table.parentNode.insertBefore(container, table);
        }
    }
    return filterBarId;
}

/**
 * One-call DataTable + filter setup.
 *
 * @param {Object} options
 * @param {string}   options.tableSelector  - jQuery selector, e.g. '#myTable'
 * @param {Object}   options.tableOptions   - DataTable init options
 * @param {Object}   options.fieldTypes     - { field: 'multiselect'|'text'|'range' }
 * @param {Array}    options.columns        - [{ field, label, index? }]
 * @param {string}   options.filterBarId    - optional; auto-generated if omitted
 * @param {boolean}  options.csvDownload    - default true
 * @param {string}   options.csvFilename    - optional custom filename
 * @param {Array}    options.csvColumns     - optional [{header, getData}]
 * @returns {{ table, filterManager }}
 */
function initDataTableWithFilters(options) {
    const {
        tableSelector, tableOptions, fieldTypes, columns,
        filterBarId, csvDownload = true, csvFilename = null, csvColumns = null
    } = options;

    const finalFilterBarId = filterBarId || 'filtersBar_' + Math.random().toString(36).substr(2, 9);
    ensureFilterBar(tableSelector, finalFilterBarId);

    if ($.fn.dataTable.isDataTable(tableSelector)) $(tableSelector).DataTable().destroy();
    const table = $(tableSelector).DataTable(tableOptions);

    const filterColumns = buildColumnFilters(fieldTypes, columns);
    const filterManager = new ColumnFilterManager({ tableSelector, columns: filterColumns, filterBarId: finalFilterBarId });
    filterManager.init(table);

    if (csvDownload) {
        const tableName = tableSelector.replace(/[#.]/g, '');
        const defaultFilename = `${tableName}_${new Date().toISOString().split('T')[0]}.csv`;
        const csvContainerId = document.getElementById('toolbarButtons') ? 'toolbarButtons' : finalFilterBarId;
        addCsvDownloadButton({ containerId: csvContainerId, table, filename: csvFilename || defaultFilename, columns: csvColumns });
    }

    return { table, filterManager };
}

function openFilterInputDialog(options) {
    const { column, data, getFieldValue, onApply } = options;
    let optionsHtml = '';

    if (column.type === 'multiselect') {
        const values = new Set();
        data.forEach(item => {
            const val = getFieldValue ? getFieldValue(item, column.field) : item[column.field];
            if (val && val !== 'null' && val !== null) values.add(val);
        });
        optionsHtml = buildMultiselectOptionsHtml(Array.from(values).sort());
    } else {
        optionsHtml = `<input type="text" class="filter-search filter-text-input" placeholder="Enter ${column.label}...">`;
    }

    const content = `
        <div class="filter-popover">
            <div class="filter-title">Filter by ${escapeHtml(column.label)}</div>
            ${optionsHtml}
            <div class="filter-buttons">
                <button class="btn btn-clear">Cancel</button>
                <button class="btn btn-apply">Add Filter</button>
            </div>
        </div>
    `;

    const modal = createModal({ content });
    const popover = modal.querySelector('.filter-popover');
    wireMultiselectSearch(popover);
    popover.querySelector('.btn-clear').addEventListener('click', () => closeModal(modal));
    popover.querySelector('.btn-apply').addEventListener('click', () => {
        let filter = null;
        if (column.type === 'multiselect') {
            const checked = Array.from(popover.querySelectorAll('input:checked')).map(c => c.value);
            if (checked.length > 0) filter = { field: column.field, label: column.label, type: column.type, values: checked };
        } else {
            const input = popover.querySelector('.filter-text-input');
            if (input && input.value.trim()) filter = { field: column.field, label: column.label, type: column.type, value: input.value.trim() };
        }
        if (filter && onApply) onApply(filter);
        closeModal(modal);
    });
    const textInput = popover.querySelector('.filter-text-input');
    if (textInput) textInput.focus();
}

function updateFilterDisplay(options) {
    const { filterBarId, filters, onRemove, hasAddButton = false } = options;
    const filtersBar = document.getElementById(filterBarId);
    if (!filtersBar) return;

    const empty = filtersBar.querySelector('.filters-bar-empty');
    filtersBar.querySelectorAll('.filter-chip').forEach(chip => chip.remove());

    if (filters.length === 0) {
        if (empty) empty.style.display = '';
    } else {
        if (empty) empty.style.display = 'none';
        filters.forEach((filter, index) => {
            const chip = document.createElement('div');
            chip.className = 'filter-chip';
            const displayValue = filter.type === 'multiselect' ? filter.values.join(', ') : filter.value;
            chip.innerHTML = `
                <span class="filter-chip-label">${escapeHtml(filter.label)}:</span>
                <span class="filter-chip-value">${escapeHtml(displayValue)}</span>
                <span class="filter-chip-remove" data-index="${index}">&times;</span>
            `;
            chip.querySelector('.filter-chip-remove').addEventListener('click', () => { if (onRemove) onRemove(index); });
            const addBtn = hasAddButton ? filtersBar.querySelector('.add-filter-btn') : null;
            if (addBtn) filtersBar.insertBefore(chip, addBtn);
            else filtersBar.appendChild(chip);
        });
    }
}

// ============================================
// CSV Download
// ============================================

function escapeCsvValue(val) {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
}

function downloadTableAsCSV(options) {
    const { table, filename: rawFilename = 'export', columns = null, filteredOnly = true, onBeforeDownload = null } = options;

    let filename = rawFilename;
    const dateStr = new Date().toISOString().split('T')[0];
    if (!filename.includes(dateStr)) {
        filename = filename.endsWith('.csv') ? filename.replace('.csv', `_${dateStr}.csv`) : `${filename}_${dateStr}`;
    }
    if (!filename.endsWith('.csv')) filename = `${filename}.csv`;

    if (!table) { console.error('downloadTableAsCSV: No table provided'); return; }

    const rowSelector = filteredOnly ? { search: 'applied' } : undefined;
    const rows = table.rows(rowSelector).nodes();
    if (rows.length === 0) { showToast('No rows to export', true); return; }

    let headers = [];
    let csvRows = [];

    if (columns) {
        headers = columns.map(col => col.header);
        Array.from(rows).forEach(rowNode => {
            const rowData = table.row(rowNode).data();
            csvRows.push(columns.map(col => escapeCsvValue(col.getData(rowNode, rowData))).join(','));
        });
    } else {
        const headerCells = $(table.table().header()).find('th');
        headerCells.each(function() {
            const headerText = $(this).text().trim();
            if (headerText) headers.push(headerText);
        });
        Array.from(rows).forEach(rowNode => {
            const rowValues = [];
            $(rowNode).find('td').each(function() {
                let cellText = $(this).text().trim();
                const link = $(this).find('a');
                if (link.length && link.attr('href') && cellText === 'View') cellText = link.attr('href');
                rowValues.push(escapeCsvValue(cellText));
            });
            csvRows.push(rowValues.join(','));
        });
    }

    if (onBeforeDownload) {
        const result = onBeforeDownload({ rows: csvRows, headers });
        if (result === false) return;
    }

    const csvContent = [headers.join(','), ...csvRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    showToast(`Downloaded ${rows.length} rows`);
}

function addCsvDownloadButton(options) {
    const { containerId, table, filename, columns = null, buttonText = '⬇ Download CSV', buttonClass = 'csv-download-btn' } = options;
    const container = document.getElementById(containerId);
    if (!container) { console.error('addCsvDownloadButton: Container not found:', containerId); return null; }
    const existingBtn = container.querySelector('.' + buttonClass);
    if (existingBtn) return existingBtn;
    const btn = document.createElement('button');
    btn.className = buttonClass;
    btn.textContent = buttonText;
    btn.title = 'Download filtered data as CSV';
    btn.addEventListener('click', () => downloadTableAsCSV({ table, filename, columns }));
    container.appendChild(btn);
    return btn;
}

// ============================================
// Toast Notifications
// ============================================

function showToast(message, isError = false) {
    const toast = document.createElement('div');
    toast.className = 'toast' + (isError ? ' toast-error' : ' toast-success');
    toast.textContent = message;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 2000);
}

// ============================================
// Expandable DataTable Rows
// ============================================

/**
 * Set up expand/collapse for DataTable rows using DataTables row().child() API.
 *
 * @param {Object} options
 * @param {string}   options.tableSelector    - jQuery selector for the table
 * @param {Function} options.buildChildContent - (parsedData) => HTML string
 * @param {string}   options.childDataAttr    - attribute storing child JSON (default: 'data-children')
 * @param {string}   options.childRowClass    - class for clickable child rows (default: 'child-doc-row')
 * @param {Function} options.onChildRowClick  - optional callback(rowData) on child row click
 */
function setupDataTableExpandHandlers(options) {
    const {
        tableSelector, buildChildContent,
        childDataAttr = 'data-children',
        childRowClass = 'child-doc-row',
        onChildRowClick = null
    } = options;

    const table = $(tableSelector);
    const dt = table.DataTable();

    table.on('click', 'td.expand-control', function(e) {
        e.stopPropagation();
        const tr = $(this).closest('tr');
        const row = dt.row(tr);
        const expandIcon = tr.find('.expand-icon');

        if (row.child.isShown()) {
            row.child.hide();
            tr.removeClass('shown');
            expandIcon.removeClass('expanded');
        } else {
            const childrenData = tr.attr(childDataAttr);
            if (childrenData) {
                try {
                    const data = JSON.parse(childrenData);
                    row.child(buildChildContent(data)).show();
                    tr.addClass('shown');
                    expandIcon.addClass('expanded');
                } catch (e) {
                    console.error('Error parsing children data:', e);
                }
            }
        }
    });

    if (onChildRowClick && childRowClass) {
        table.on('click', '.' + childRowClass, function(e) {
            if (e.target.tagName === 'A') return;
            const dataAttr = $(this).attr('data-doc') || $(this).attr('data-row');
            if (dataAttr) {
                try { onChildRowClick(JSON.parse(dataAttr)); }
                catch (e) { console.error('Error parsing row data:', e); }
            }
        });
        table.on('mouseenter', '.' + childRowClass, function() { $(this).css('background', '#f0f4f8'); });
        table.on('mouseleave', '.' + childRowClass, function() { $(this).css('background', ''); });
    }
}

/**
 * Create a parent row element for expandable DataTable rows.
 *
 * @param {Object} options
 * @param {string} options.caseDisplayName
 * @param {Object} options.rowData   - stored as data-case-data attribute
 * @param {*}      options.childData - stored as data-children attribute
 * @param {Array}  options.cells     - [{content, style?, element?}] or plain strings
 * @returns {HTMLTableRowElement}
 */
function createExpandableParentRow(options) {
    const { caseDisplayName, rowData, childData, cells } = options;

    const parentRow = document.createElement('tr');
    parentRow.className = 'parent-row';
    parentRow.setAttribute('data-case-name', caseDisplayName);
    if (rowData) parentRow.setAttribute('data-case-data', JSON.stringify(rowData));
    if (childData) parentRow.setAttribute('data-children', JSON.stringify(childData));

    const expandCell = document.createElement('td');
    expandCell.className = 'expand-control';
    const expandSpan = document.createElement('span');
    expandSpan.className = 'expand-icon';
    expandSpan.textContent = '▶';
    expandCell.appendChild(expandSpan);
    parentRow.appendChild(expandCell);

    cells.forEach(cellConfig => {
        const cell = document.createElement('td');
        if (typeof cellConfig === 'string') {
            cell.textContent = cellConfig;
        } else if (cellConfig.element) {
            cell.appendChild(cellConfig.element);
            if (cellConfig.style) cell.style.cssText = cellConfig.style;
        } else {
            cell.textContent = cellConfig.content || '';
            if (cellConfig.style) cell.style.cssText = cellConfig.style;
        }
        parentRow.appendChild(cell);
    });

    return parentRow;
}
