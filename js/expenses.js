// ═══════════════════════════════════════════════════════════════
// Expenses Module - Expense List, Filters, Transfer Toggle, CRUD
// ═══════════════════════════════════════════════════════════════

const Expenses = (() => {

    let filters = {
        categoryId: '',
        transferred: null,
        search: '',
        startDate: '',
        endDate: ''
    };

    let selectedIds = new Set();

    function render() {
        const content = document.getElementById('content');
        const categories = Store.getCategories();
        const expenses = Store.getExpenses(null, null, filters);
        const isLoggedIn = typeof GDrive !== 'undefined' && GDrive.isLoggedIn && GDrive.isLoggedIn();

        content.innerHTML = `
            <div class="tab-info">
                <h2 class="tab-info__title">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8"/><path d="M8 17h8"/></svg>
                    지출 내역
                </h2>
                <div class="tab-info__actions">
                    <button class="btn btn--primary" id="btn-add-expense" ${!isLoggedIn ? 'disabled title="구글 로그인이 필요합니다"' : ''}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        지출 추가
                    </button>
                </div>
            </div>
            
            <div class="section-card">
                <!-- Filter Bar -->
                ${renderFilterBar(categories)}

                <!-- Bulk Actions -->
                <div class="bulk-actions hidden" id="bulk-actions">
                    <span class="bulk-actions__count"><span id="selected-count">0</span>건 선택됨</span>
                    <button class="btn btn--sm btn--success" id="btn-bulk-transfer">✅ 일괄 이체완료</button>
                    <button class="btn btn--sm btn--ghost" id="btn-bulk-untransfer">↩ 이체 취소</button>
                    <button class="btn btn--sm btn--danger-ghost" id="btn-bulk-delete">🗑 일괄 삭제</button>
                </div>

                <!-- Table -->
                <div class="section-card__body">
                    ${renderExpenseTable(expenses, categories, isLoggedIn)}
                </div>
            </div>`;
        `;

        bindExpenseEvents();
    }

    function renderFilterBar(categories) {
        const groups = Store.getCategoryGroups();
        const groupMap = {};
        groups.forEach(g => { groupMap[g.id] = { name: g.name, items: [] }; });
        const ungrouped = [];
        categories.forEach(c => {
            if (c.groupId && groupMap[c.groupId]) {
                groupMap[c.groupId].items.push(c);
            } else {
                ungrouped.push(c);
            }
        });

        let catOptions = '';
        groups.forEach(g => {
            const items = groupMap[g.id].items;
            if (items.length > 0) {
                catOptions += `<optgroup label="${g.name}">`;
                items.forEach(c => {
                    catOptions += `<option value="${c.id}" ${filters.categoryId === c.id ? 'selected' : ''}>${c.name}</option>`;
                });
                catOptions += `</optgroup>`;
            }
        });
        if (ungrouped.length > 0) {
            catOptions += `<optgroup label="미분류">`;
            ungrouped.forEach(c => {
                catOptions += `<option value="${c.id}" ${filters.categoryId === c.id ? 'selected' : ''}>${c.name}</option>`;
            });
            catOptions += `</optgroup>`;
        }

        return `
        <div class="filter-bar">
            <div class="filter-group">
                <label class="filter-label">구분/내역</label>
                <select class="filter-select" id="filter-category">
                    <option value="">전체 내역</option>
                    ${catOptions}
                </select>
            </div>
            <div class="filter-group">
                <label class="filter-label">이체상태</label>
                <select class="filter-select" id="filter-transfer">
                    <option value="" ${filters.transferred === null ? 'selected' : ''}>전체</option>
                    <option value="true" ${filters.transferred === true ? 'selected' : ''}>이체완료</option>
                    <option value="false" ${filters.transferred === false ? 'selected' : ''}>미이체</option>
                </select>
            </div>
            <div class="filter-group">
                <label class="filter-label">시작일</label>
                <input type="date" class="filter-input" id="filter-start-date" value="${filters.startDate}">
            </div>
            <div class="filter-group">
                <label class="filter-label">종료일</label>
                <input type="date" class="filter-input" id="filter-end-date" value="${filters.endDate}">
            </div>
            <div class="filter-group">
                <label class="filter-label">검색</label>
                <input type="text" class="filter-input filter-input--search" id="filter-search"
                    placeholder="사용내역, 업체명, 담당자..." value="${filters.search}">
            </div>
            <div class="filter-bar__right">
                <button class="btn btn--sm btn--ghost" id="btn-reset-filters">초기화</button>
            </div>
        </div>`;
    }

    function renderExpenseTable(expenses, categories, isLoggedIn = true) {
        if (expenses.length === 0) {
            return `
            <div class="empty-state">
                <div class="empty-state__icon">📋</div>
                <div class="empty-state__title">지출 내역이 없습니다</div>
                <div class="empty-state__desc">새로운 지출을 추가하여 예산을 관리하세요.</div>
                <button class="btn btn--primary" id="btn-add-expense-empty" ${!isLoggedIn ? 'disabled title="구글 로그인이 필요합니다"' : ''}>+ 지출 추가</button>
            </div>`;
        }

        const groups = Store.getCategoryGroups();
        const catMap = {};
        const catGroupMap = {};
        const groupMap = {};
        groups.forEach(g => { groupMap[g.id] = g.name; });
        categories.forEach(c => {
            catMap[c.id] = c.name;
            catGroupMap[c.id] = c.groupId ? (groupMap[c.groupId] || '미분류') : '미분류';
        });

        const totalAmount = expenses.reduce((s, e) => s + e.amount, 0);
        const transferredAmount = expenses.filter(e => e.transferred).reduce((s, e) => s + e.amount, 0);

        const rows = expenses.map(exp => `
            <tr class="${exp.transferred ? 'row-transferred' : ''}" data-expense-id="${exp.id}">
                <td class="text-center">
                    <input type="checkbox" class="row-checkbox expense-checkbox" data-id="${exp.id}"
                        ${selectedIds.has(exp.id) ? 'checked' : ''} ${!isLoggedIn ? 'disabled' : ''}>
                </td>
                <td style="white-space:nowrap">${exp.date}</td>
                <td>
                    <span style="display:inline-block;padding:2px 8px;background:#eff6ff;color:#1e40af;border-radius:4px;font-size:0.78rem;font-weight:500">
                        ${catGroupMap[exp.categoryId] || '미분류'}
                    </span>
                </td>
                <td>
                    <span style="display:inline-block;padding:2px 8px;background:#f1f5f9;border-radius:4px;font-size:0.78rem;font-weight:500">
                        ${catMap[exp.categoryId] || '미분류'}
                    </span>
                </td>
                <td>
                    <div style="font-weight:500">${escapeHtml(exp.description)}</div>
                    ${exp.invoiceNo ? `<div style="font-size:0.75rem;color:var(--text-muted)">${escapeHtml(exp.invoiceNo)}</div>` : ''}
                </td>
                <td>${escapeHtml(exp.vendor)}</td>
                <td>${escapeHtml(exp.manager)}</td>
                <td class="text-right amount-cell" style="font-weight:600">${Store.formatCurrency(exp.amount)}</td>
                <td class="text-center">
                    <button class="transfer-toggle ${exp.transferred ? 'transferred' : ''}" data-id="${exp.id}" title="${exp.transferred ? '이체완료됨 (클릭하여 취소)' : '클릭하여 이체완료'}" ${!isLoggedIn ? 'disabled style="cursor:not-allowed;opacity:0.55"' : ''}>
                        ${exp.transferred ? 'O' : ''}
                    </button>
                </td>
                <td class="text-center">
                    <button class="btn btn--sm btn--ghost btn-edit-expense" data-id="${exp.id}" title="수정" style="padding:4px 8px" ${!isLoggedIn ? 'disabled' : ''}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button class="btn btn--sm btn--danger-ghost btn-delete-expense" data-id="${exp.id}" title="삭제" style="padding:4px 8px" ${!isLoggedIn ? 'disabled' : ''}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                </td>
            </tr>
        `).join('');

        return `
        <table class="data-table" id="expense-table">
            <thead>
                <tr>
                    <th class="text-center" style="width:40px">
                        <input type="checkbox" class="row-checkbox" id="select-all-expenses">
                    </th>
                    <th style="min-width:100px">결제일자</th>
                    <th style="min-width:90px">구분</th>
                    <th style="min-width:100px">내역</th>
                    <th style="min-width:160px">사용내역 / 계산서번호</th>
                    <th style="min-width:100px">업체명</th>
                    <th style="min-width:70px">담당자</th>
                    <th class="text-right" style="min-width:120px">금액(VAT포함)</th>
                    <th class="text-center" style="width:60px">이체완료</th>
                    <th class="text-center" style="width:80px">관리</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
            <tfoot>
                <tr class="total-row">
                    <td colspan="7" style="font-weight:700">
                        합계 (${expenses.length}건) · 이체완료: ${Store.formatCurrency(transferredAmount)}원
                    </td>
                    <td class="text-right amount-cell">${Store.formatCurrency(totalAmount)}</td>
                    <td></td>
                    <td></td>
                </tr>
            </tfoot>
        </table>`;
    }

    // ── Add / Edit Expense Modal ─────────────────────────────

    function showExpenseModal(expenseId) {
        if (typeof GDrive !== 'undefined' && GDrive.isLoggedIn && !GDrive.isLoggedIn()) {
            if (typeof App !== 'undefined' && App.showToast) {
                App.showToast('⚠️ 구글 로그인이 필요합니다. 먼저 로그인해 주세요.', 'warning');
            }
            return;
        }

        const isEdit = !!expenseId;
        const expense = isEdit ? Store.getExpense(expenseId) : null;
        const categories = Store.getCategories();
        const groups = Store.getCategoryGroups();

        const groupMap = {};
        groups.forEach(g => { groupMap[g.id] = { name: g.name, items: [] }; });
        const ungrouped = [];
        categories.forEach(c => {
            if (c.groupId && groupMap[c.groupId]) {
                groupMap[c.groupId].items.push(c);
            } else {
                ungrouped.push(c);
            }
        });

        let catOptions = '';
        groups.forEach(g => {
            const items = groupMap[g.id].items;
            if (items.length > 0) {
                catOptions += `<optgroup label="${g.name}">`;
                items.forEach(c => {
                    catOptions += `<option value="${c.id}" ${expense && expense.categoryId === c.id ? 'selected' : ''}>${c.name}</option>`;
                });
                catOptions += `</optgroup>`;
            }
        });
        if (ungrouped.length > 0) {
            catOptions += `<optgroup label="미분류">`;
            ungrouped.forEach(c => {
                catOptions += `<option value="${c.id}" ${expense && expense.categoryId === c.id ? 'selected' : ''}>${c.name}</option>`;
            });
            catOptions += `</optgroup>`;
        }

        const today = new Date().toISOString().slice(0, 10);

        const html = `
        <div class="modal__header">
            <h3 class="modal__title">${isEdit ? '지출 수정' : '새 지출 추가'}</h3>
            <button class="modal__close" id="modal-close">&times;</button>
        </div>
        <div class="modal__body">
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">결제일자 *</label>
                    <input type="date" class="form-input" id="exp-date" value="${expense ? expense.date : today}" required>
                </div>
                <div class="form-group">
                    <label class="form-label">구분/내역 *</label>
                    <select class="form-select" id="exp-category" required>
                        <option value="">내역 선택</option>
                        ${catOptions}
                    </select>
                </div>
            </div>
            <div class="form-group">
                <label class="form-label">사용내역 *</label>
                <input type="text" class="form-input" id="exp-description" value="${expense ? escapeHtml(expense.description) : ''}" placeholder="지출 내용을 입력하세요">
            </div>
            <div class="form-group">
                <label class="form-label">계산서번호</label>
                <input type="text" class="form-input" id="exp-invoice" value="${expense ? escapeHtml(expense.invoiceNo) : ''}" placeholder="세금계산서 번호 (선택)">
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">업체명</label>
                    <input type="text" class="form-input" id="exp-vendor" value="${expense ? escapeHtml(expense.vendor) : ''}" placeholder="거래 업체명">
                </div>
                <div class="form-group">
                    <label class="form-label">담당자</label>
                    <input type="text" class="form-input" id="exp-manager" value="${expense ? escapeHtml(expense.manager) : ''}" placeholder="담당자명">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">금액 (VAT포함) *</label>
                    <input type="text" class="form-input" id="exp-amount" value="${expense ? Store.formatCurrency(expense.amount) : ''}" placeholder="0" style="font-variant-numeric:tabular-nums;text-align:right">
                </div>
                <div class="form-group" style="display:flex;align-items:flex-end;padding-bottom:2px">
                    <div class="form-checkbox-row">
                        <input type="checkbox" class="form-checkbox" id="exp-transferred" ${expense && expense.transferred ? 'checked' : ''}>
                        <label for="exp-transferred" style="font-size:0.88rem;font-weight:500;cursor:pointer">이체완료</label>
                    </div>
                </div>
            </div>
        </div>
        <div class="modal__footer">
            <button class="btn btn--ghost" id="modal-cancel">취소</button>
            <button class="btn btn--primary" id="modal-save">${isEdit ? '수정' : '추가'}</button>
        </div>`;

        App.showModal(html);

        // Format amount input on change
        const amountInput = document.getElementById('exp-amount');
        amountInput.addEventListener('input', () => {
            const raw = amountInput.value.replace(/[^0-9]/g, '');
            if (raw) amountInput.value = Store.formatCurrency(parseInt(raw));
        });

        // Save handler
        document.getElementById('modal-save').addEventListener('click', () => {
            const date = document.getElementById('exp-date').value;
            const categoryId = document.getElementById('exp-category').value;
            const description = document.getElementById('exp-description').value.trim();
            const invoiceNo = document.getElementById('exp-invoice').value.trim();
            const vendor = document.getElementById('exp-vendor').value.trim();
            const manager = document.getElementById('exp-manager').value.trim();
            const amount = parseInt(amountInput.value.replace(/[^0-9]/g, '')) || 0;
            const transferred = document.getElementById('exp-transferred').checked;

            if (!date || !categoryId || !description || !amount) {
                App.showToast('필수 항목(*)을 모두 입력해주세요', 'error');
                return;
            }

            if (isEdit) {
                Store.updateExpense(expenseId, { date, categoryId, description, invoiceNo, vendor, manager, amount, transferred });
                App.showToast('지출이 수정되었습니다', 'success');
            } else {
                Store.addExpense({ date, categoryId, description, invoiceNo, vendor, manager, amount, transferred });
                App.showToast('지출이 추가되었습니다', 'success');
            }

            App.closeModal();
            render();
        });

        document.getElementById('modal-cancel').addEventListener('click', App.closeModal);
        document.getElementById('modal-close').addEventListener('click', App.closeModal);
    }

    // ── Event Binding ────────────────────────────────────────

    function bindExpenseEvents() {
        const content = document.getElementById('content');

        // Add expense buttons
        const addBtn = document.getElementById('btn-add-expense');
        if (addBtn) addBtn.addEventListener('click', () => showExpenseModal());

        const addBtnEmpty = document.getElementById('btn-add-expense-empty');
        if (addBtnEmpty) addBtnEmpty.addEventListener('click', () => showExpenseModal());

        // Filter changes
        const filterCat = document.getElementById('filter-category');
        if (filterCat) filterCat.addEventListener('change', (e) => { filters.categoryId = e.target.value; render(); });

        const filterTransfer = document.getElementById('filter-transfer');
        if (filterTransfer) filterTransfer.addEventListener('change', (e) => {
            filters.transferred = e.target.value === '' ? null : e.target.value === 'true';
            render();
        });

        const filterStart = document.getElementById('filter-start-date');
        if (filterStart) filterStart.addEventListener('change', (e) => { filters.startDate = e.target.value; render(); });

        const filterEnd = document.getElementById('filter-end-date');
        if (filterEnd) filterEnd.addEventListener('change', (e) => { filters.endDate = e.target.value; render(); });

        const filterSearch = document.getElementById('filter-search');
        if (filterSearch) {
            let timeout;
            filterSearch.addEventListener('input', (e) => {
                clearTimeout(timeout);
                timeout = setTimeout(() => { filters.search = e.target.value; render(); }, 300);
            });
        }

        const resetBtn = document.getElementById('btn-reset-filters');
        if (resetBtn) resetBtn.addEventListener('click', () => {
            filters = { categoryId: '', transferred: null, search: '', startDate: '', endDate: '' };
            render();
        });

        // Transfer toggle (event delegation on content)
        content.addEventListener('click', (e) => {
            const toggle = e.target.closest('.transfer-toggle');
            if (toggle) {
                if (typeof GDrive !== 'undefined' && GDrive.isLoggedIn && !GDrive.isLoggedIn()) {
                    App.showToast('⚠️ 구글 로그인이 필요합니다.', 'warning');
                    return;
                }
                const id = toggle.dataset.id;
                const newState = Store.toggleTransfer(id);

                // Visual feedback
                toggle.classList.add('just-toggled');
                setTimeout(() => toggle.classList.remove('just-toggled'), 300);

                if (newState) {
                    toggle.classList.add('transferred');
                    toggle.textContent = 'O';
                } else {
                    toggle.classList.remove('transferred');
                    toggle.textContent = '';
                }

                // Update row style
                const row = toggle.closest('tr');
                if (row) row.classList.toggle('row-transferred', newState);

                // Update footer totals
                updateTableFooter();
                return;
            }

            // Edit button
            const editBtn = e.target.closest('.btn-edit-expense');
            if (editBtn) {
                if (typeof GDrive !== 'undefined' && GDrive.isLoggedIn && !GDrive.isLoggedIn()) {
                    App.showToast('⚠️ 구글 로그인이 필요합니다.', 'warning');
                    return;
                }
                showExpenseModal(editBtn.dataset.id);
                return;
            }

            // Delete button
            const deleteBtn = e.target.closest('.btn-delete-expense');
            if (deleteBtn) {
                if (typeof GDrive !== 'undefined' && GDrive.isLoggedIn && !GDrive.isLoggedIn()) {
                    App.showToast('⚠️ 구글 로그인이 필요합니다.', 'warning');
                    return;
                }
                const id = deleteBtn.dataset.id;
                const exp = Store.getExpense(id);
                App.showConfirm(
                    '지출 삭제',
                    `"${exp ? exp.description : ''}" 항목을 삭제하시겠습니까?`,
                    () => {
                        Store.deleteExpense(id);
                        App.showToast('지출이 삭제되었습니다', 'success');
                        render();
                    }
                );
                return;
            }
        });

        // Select all checkbox
        const selectAll = document.getElementById('select-all-expenses');
        if (selectAll) {
            selectAll.addEventListener('change', (e) => {
                const checkboxes = content.querySelectorAll('.expense-checkbox');
                checkboxes.forEach(cb => {
                    cb.checked = e.target.checked;
                    if (e.target.checked) selectedIds.add(cb.dataset.id);
                    else selectedIds.delete(cb.dataset.id);
                });
                updateBulkActions();
            });
        }

        // Individual checkboxes (delegation)
        content.addEventListener('change', (e) => {
            if (e.target.classList.contains('expense-checkbox')) {
                if (e.target.checked) selectedIds.add(e.target.dataset.id);
                else selectedIds.delete(e.target.dataset.id);
                updateBulkActions();
            }
        });

        // Bulk actions
        const bulkTransfer = document.getElementById('btn-bulk-transfer');
        if (bulkTransfer) bulkTransfer.addEventListener('click', () => {
            if (typeof GDrive !== 'undefined' && GDrive.isLoggedIn && !GDrive.isLoggedIn()) {
                App.showToast('⚠️ 구글 로그인이 필요합니다.', 'warning');
                return;
            }
            selectedIds.forEach(id => Store.updateExpense(id, { transferred: true }));
            App.showToast(`${selectedIds.size}건 이체완료 처리`, 'success');
            selectedIds.clear();
            render();
        });

        const bulkUntransfer = document.getElementById('btn-bulk-untransfer');
        if (bulkUntransfer) bulkUntransfer.addEventListener('click', () => {
            if (typeof GDrive !== 'undefined' && GDrive.isLoggedIn && !GDrive.isLoggedIn()) {
                App.showToast('⚠️ 구글 로그인이 필요합니다.', 'warning');
                return;
            }
            selectedIds.forEach(id => Store.updateExpense(id, { transferred: false }));
            App.showToast(`${selectedIds.size}건 이체 취소`, 'success');
            selectedIds.clear();
            render();
        });

        const bulkDelete = document.getElementById('btn-bulk-delete');
        if (bulkDelete) bulkDelete.addEventListener('click', () => {
            if (typeof GDrive !== 'undefined' && GDrive.isLoggedIn && !GDrive.isLoggedIn()) {
                App.showToast('⚠️ 구글 로그인이 필요합니다.', 'warning');
                return;
            }
            App.showConfirm('일괄 삭제', `선택된 ${selectedIds.size}건의 지출을 삭제하시겠습니까?`, () => {
                Store.deleteExpenses([...selectedIds]);
                App.showToast(`${selectedIds.size}건 삭제 완료`, 'success');
                selectedIds.clear();
                render();
            });
        });
    }

    function updateBulkActions() {
        const bar = document.getElementById('bulk-actions');
        const countEl = document.getElementById('selected-count');
        if (bar && countEl) {
            if (selectedIds.size > 0) {
                bar.classList.remove('hidden');
                countEl.textContent = selectedIds.size;
            } else {
                bar.classList.add('hidden');
            }
        }
    }

    function updateTableFooter() {
        const expenses = Store.getExpenses(null, null, filters);
        const totalAmount = expenses.reduce((s, e) => s + e.amount, 0);
        const transferredAmount = expenses.filter(e => e.transferred).reduce((s, e) => s + e.amount, 0);

        const footer = document.querySelector('#expense-table tfoot td');
        if (footer) {
            footer.innerHTML = `합계 (${expenses.length}건) · 이체완료: ${Store.formatCurrency(transferredAmount)}원`;
        }
        const footerAmount = document.querySelector('#expense-table tfoot td.amount-cell');
        if (footerAmount) {
            footerAmount.textContent = Store.formatCurrency(totalAmount);
        }
    }

    // ── Helpers ──────────────────────────────────────────────

    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function resetFilters() {
        filters = { categoryId: '', transferred: null, search: '', startDate: '', endDate: '' };
        selectedIds.clear();
    }

    return { render, resetFilters, showExpenseModal };
})();
