// ═══════════════════════════════════════════════════════════════
// Projects Module - Project/Year/Category Management
// ═══════════════════════════════════════════════════════════════

const Projects = (() => {

    // ── Add Project Modal ────────────────────────────────────

    function showAddModal() {
        const html = `
        <div class="modal__header">
            <h3 class="modal__title">새 과제 추가</h3>
            <button class="modal__close" id="modal-close">&times;</button>
        </div>
        <div class="modal__body">
            <div class="form-group">
                <label class="form-label">과제명 *</label>
                <input type="text" class="form-input" id="proj-name" placeholder="정부과제 이름을 입력하세요">
            </div>
            <div class="form-group">
                <label class="form-label">지원기관</label>
                <input type="text" class="form-input" id="proj-institution" placeholder="예: 한국연구재단, 산업통상자원부 등">
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">수행 시작일</label>
                    <input type="date" class="form-input" id="proj-start">
                </div>
                <div class="form-group">
                    <label class="form-label">수행 종료일</label>
                    <input type="date" class="form-input" id="proj-end">
                </div>
            </div>

            <div style="margin-top:8px">
                <label class="form-label">연차 구성</label>
                <div class="form-hint" style="margin-bottom:8px">수행 기간에 맞춰 연차를 추가하세요. 각 연차별로 기본 비목이 자동 생성됩니다.</div>
                <div id="year-list-container" class="year-list"></div>
                <button class="btn btn--sm btn--ghost" id="btn-add-year-entry" style="margin-top:8px">+ 연차 추가</button>
            </div>
        </div>
        <div class="modal__footer">
            <button class="btn btn--ghost" id="modal-cancel">취소</button>
            <button class="btn btn--primary" id="modal-save">과제 생성</button>
        </div>`;

        App.showModal(html);

        let yearEntries = [
            { label: '1차년도', startDate: '', endDate: '' }
        ];

        renderYearEntries(yearEntries);

        document.getElementById('btn-add-year-entry').addEventListener('click', () => {
            yearEntries.push({ label: `${yearEntries.length + 1}차년도`, startDate: '', endDate: '' });
            renderYearEntries(yearEntries);
        });

        document.getElementById('modal-save').addEventListener('click', () => {
            const name = document.getElementById('proj-name').value.trim();
            if (!name) {
                App.showToast('과제명을 입력해주세요', 'error');
                return;
            }

            // Collect year data from DOM
            const years = collectYearEntries(yearEntries);
            if (years.length === 0) {
                App.showToast('최소 1개의 연차를 추가해주세요', 'error');
                return;
            }

            const project = Store.addProject({
                name,
                institution: document.getElementById('proj-institution').value.trim(),
                startDate: document.getElementById('proj-start').value,
                endDate: document.getElementById('proj-end').value,
                years
            });

            Store.setCurrentProject(project.id);
            App.closeModal();
            App.refresh();
            App.showToast(`"${name}" 과제가 생성되었습니다`, 'success');
        });

        document.getElementById('modal-cancel').addEventListener('click', App.closeModal);
        document.getElementById('modal-close').addEventListener('click', App.closeModal);
    }

    // ── Edit Project Modal ───────────────────────────────────

    function showEditModal() {
        const project = Store.getCurrentProject();
        if (!project) {
            App.showToast('편집할 과제가 없습니다', 'error');
            return;
        }

        const html = `
        <div class="modal__header">
            <h3 class="modal__title">과제 편집</h3>
            <button class="modal__close" id="modal-close">&times;</button>
        </div>
        <div class="modal__body">
            <div class="form-group">
                <label class="form-label">과제명 *</label>
                <input type="text" class="form-input" id="proj-name" value="${escapeHtml(project.name)}">
            </div>
            <div class="form-group">
                <label class="form-label">지원기관</label>
                <input type="text" class="form-input" id="proj-institution" value="${escapeHtml(project.institution)}">
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">수행 시작일</label>
                    <input type="date" class="form-input" id="proj-start" value="${project.startDate}">
                </div>
                <div class="form-group">
                    <label class="form-label">수행 종료일</label>
                    <input type="date" class="form-input" id="proj-end" value="${project.endDate}">
                </div>
            </div>

            <div style="margin-top:8px">
                <label class="form-label">연차 관리</label>
                <div class="form-hint" style="margin-bottom:8px">⚠ 연차를 삭제하면 해당 연차의 비목과 지출 데이터가 모두 삭제됩니다.</div>
                <div id="year-list-container" class="year-list"></div>
                <button class="btn btn--sm btn--ghost" id="btn-add-year-entry" style="margin-top:8px">+ 연차 추가</button>
            </div>

            <div style="margin-top:20px;border-top:1px solid var(--border-color);padding-top:16px">
                <label class="form-label">구분/내역 관리 (현재 연차)</label>
                <div class="form-hint" style="margin-bottom:8px">구분(대분류)과 내역(세부항목)을 관리합니다. 배정예산은 대시보드에서도 직접 수정 가능합니다.</div>
                <div id="cat-list-container" class="cat-list"></div>
                <div style="display:flex;gap:8px;margin-top:10px;padding-top:10px;border-top:1px dashed var(--border-color)">
                    <input type="text" class="form-input" id="new-group-name" placeholder="새 구분명 (예: 연구활동비)" style="flex:1;padding:6px 10px;font-size:0.85rem">
                    <button class="btn btn--sm btn--ghost" id="btn-add-group">+ 구분 추가</button>
                </div>
            </div>
        </div>
        <div class="modal__footer">
            <button class="btn btn--ghost" id="modal-cancel">취소</button>
            <button class="btn btn--primary" id="modal-save">저장</button>
        </div>`;

        App.showModal(html);

        // Render existing years
        let yearEntries = project.years.map(y => ({
            id: y.id,
            label: y.label,
            startDate: y.startDate || '',
            endDate: y.endDate || '',
            isExisting: true
        }));

        renderYearEntries(yearEntries, true);

        // Render categories
        renderCategoryList();

        // Add year
        document.getElementById('btn-add-year-entry').addEventListener('click', () => {
            yearEntries.push({
                id: null,
                label: `${yearEntries.length + 1}차년도`,
                startDate: '',
                endDate: '',
                isExisting: false
            });
            renderYearEntries(yearEntries, true);
        });

        // Add group
        document.getElementById('btn-add-group').addEventListener('click', () => {
            const input = document.getElementById('new-group-name');
            const name = input.value.trim();
            if (!name) return;
            saveCategoryBudgets(); // Save currently typed budgets first!
            Store.addCategoryGroup({ name });
            input.value = '';
            renderCategoryList();
        });

        // Save
        document.getElementById('modal-save').addEventListener('click', () => {
            const name = document.getElementById('proj-name').value.trim();
            if (!name) {
                App.showToast('과제명을 입력해주세요', 'error');
                return;
            }

            Store.updateProject(project.id, {
                name,
                institution: document.getElementById('proj-institution').value.trim(),
                startDate: document.getElementById('proj-start').value,
                endDate: document.getElementById('proj-end').value
            });

            // Handle year changes
            const existingYearIds = project.years.map(y => y.id);
            const currentYearIds = yearEntries.filter(y => y.isExisting).map(y => y.id);

            // Remove deleted years
            existingYearIds.forEach(id => {
                if (!currentYearIds.includes(id)) {
                    Store.removeYearFromProject(project.id, id);
                }
            });

            // Add new years
            yearEntries.filter(y => !y.isExisting).forEach(y => {
                const el = document.querySelector(`[data-year-idx="${yearEntries.indexOf(y)}"]`);
                if (el) {
                    const startInput = el.querySelector('.year-start');
                    const endInput = el.querySelector('.year-end');
                    Store.addYearToProject(project.id, {
                        label: y.label,
                        startDate: startInput ? startInput.value : '',
                        endDate: endInput ? endInput.value : ''
                    });
                }
            });

            // Update existing year dates
            yearEntries.filter(y => y.isExisting).forEach((y, idx) => {
                const el = document.querySelector(`[data-year-idx="${yearEntries.indexOf(y)}"]`);
                if (el) {
                    const yearObj = project.years.find(yr => yr.id === y.id);
                    if (yearObj) {
                        const startInput = el.querySelector('.year-start');
                        const endInput = el.querySelector('.year-end');
                        if (startInput) yearObj.startDate = startInput.value;
                        if (endInput) yearObj.endDate = endInput.value;
                    }
                }
            });

            // Save category budgets
            saveCategoryBudgets();

            Store.save();
            App.closeModal();
            App.refresh();
            App.showToast('과제 정보가 저장되었습니다', 'success');
        });

        document.getElementById('modal-cancel').addEventListener('click', App.closeModal);
        document.getElementById('modal-close').addEventListener('click', App.closeModal);
    }

    // ── Year Entries Renderer ────────────────────────────────

    function renderYearEntries(yearEntries, allowDelete = false) {
        const container = document.getElementById('year-list-container');
        if (!container) return;

        container.innerHTML = yearEntries.map((y, i) => `
            <div class="year-item" data-year-idx="${i}">
                <span class="year-item__label">${y.label}</span>
                <div class="year-item__dates">
                    <input type="date" class="year-start" value="${y.startDate}" placeholder="시작일">
                    <span>~</span>
                    <input type="date" class="year-end" value="${y.endDate}" placeholder="종료일">
                </div>
                ${(allowDelete || yearEntries.length > 1) ? `
                    <button class="year-item__remove" data-remove-idx="${i}" title="연차 삭제">&times;</button>
                ` : ''}
            </div>
        `).join('');

        // Bind remove buttons
        container.querySelectorAll('.year-item__remove').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.removeIdx);
                if (yearEntries.length <= 1) {
                    App.showToast('최소 1개의 연차가 필요합니다', 'error');
                    return;
                }
                const removed = yearEntries[idx];
                if (removed.isExisting) {
                    App.showConfirm('연차 삭제', `${removed.label}을(를) 삭제하면 해당 연차의 모든 비목과 지출 데이터가 삭제됩니다. 계속하시겠습니까?`, () => {
                        yearEntries.splice(idx, 1);
                        renderYearEntries(yearEntries, allowDelete);
                    });
                } else {
                    yearEntries.splice(idx, 1);
                    renderYearEntries(yearEntries, allowDelete);
                }
            });
        });
    }

    function collectYearEntries(yearEntries) {
        return yearEntries.map((y, i) => {
            const el = document.querySelector(`[data-year-idx="${i}"]`);
            return {
                label: y.label,
                startDate: el ? el.querySelector('.year-start').value : y.startDate,
                endDate: el ? el.querySelector('.year-end').value : y.endDate
            };
        });
    }

    // ── Category List Renderer (Grouped) ─────────────────────

    function renderCategoryList() {
        const container = document.getElementById('cat-list-container');
        if (!container) return;

        const groups = Store.getCategoryGroups();
        const allCategories = Store.getCategories();

        // Find ungrouped categories
        const groupedCatIds = new Set();
        groups.forEach(g => {
            const cats = Store.getCategoriesByGroup(g.id);
            cats.forEach(c => groupedCatIds.add(c.id));
        });
        const ungrouped = allCategories.filter(c => !groupedCatIds.has(c.id));

        let html = '';

        groups.forEach(g => {
            const cats = Store.getCategoriesByGroup(g.id);
            html += `
            <div class="group-section" data-group-id="${g.id}">
                <div class="group-section__header">
                    <div class="group-section__title">
                        <span class="group-section__icon">📂</span>
                        <strong class="modal-group-editable" data-group-id="${g.id}" title="클릭하여 구분명 수정">${escapeHtml(g.name)}</strong>
                        <span class="group-section__count">${cats.length}개</span>
                    </div>
                    <div class="group-section__actions">
                        <button class="btn--icon btn-add-cat-to-group" data-group-id="${g.id}" title="내역 추가">+</button>
                        <button class="btn--icon btn--icon-danger btn-delete-group" data-group-id="${g.id}" title="구분 삭제">&times;</button>
                    </div>
                </div>
                <div class="group-section__items">
                    ${cats.map(cat => `
                        <div class="cat-item" data-cat-id="${cat.id}">
                            <span class="cat-item__name modal-cat-name-editable" data-cat-id="${cat.id}" title="클릭하여 내역명 수정">${escapeHtml(cat.name)}</span>
                            <div class="cat-item__budget">
                                <input type="text" class="cat-budget-input" data-cat-id="${cat.id}"
                                    value="${Store.formatCurrency(cat.budget)}" placeholder="0">
                                <span style="font-size:0.78rem;color:var(--text-muted)">원</span>
                            </div>
                            <button class="cat-item__remove" data-cat-id="${cat.id}" title="내역 삭제">&times;</button>
                        </div>
                    `).join('')}
                    ${cats.length === 0 ? '<div style="padding:8px 12px;color:var(--text-muted);font-size:0.82rem;font-style:italic">내역이 없습니다. + 버튼으로 추가하세요</div>' : ''}
                </div>
            </div>`;
        });

        // Ungrouped categories
        if (ungrouped.length > 0) {
            html += `
            <div class="group-section group-section--ungrouped" data-group-id="">
                <div class="group-section__header">
                    <div class="group-section__title">
                        <span class="group-section__icon">📁</span>
                        <strong style="color:var(--text-muted)">미분류</strong>
                        <span class="group-section__count">${ungrouped.length}개</span>
                    </div>
                </div>
                <div class="group-section__items">
                    ${ungrouped.map(cat => `
                        <div class="cat-item" data-cat-id="${cat.id}">
                            <span class="cat-item__name modal-cat-name-editable" data-cat-id="${cat.id}" title="클릭하여 내역명 수정">${escapeHtml(cat.name)}</span>
                            <div class="cat-item__budget">
                                <input type="text" class="cat-budget-input" data-cat-id="${cat.id}"
                                     value="${Store.formatCurrency(cat.budget)}" placeholder="0">
                                <span style="font-size:0.78rem;color:var(--text-muted)">원</span>
                            </div>
                            <button class="cat-item__remove" data-cat-id="${cat.id}" title="내역 삭제">&times;</button>
                        </div>
                    `).join('')}
                </div>
            </div>`;
        }

        if (groups.length === 0 && ungrouped.length === 0) {
            html = '<div style="padding:16px;color:var(--text-muted);text-align:center;font-size:0.85rem">구분이 없습니다. 아래에서 구분을 추가하세요.</div>';
        }

        container.innerHTML = html;

        // Format budget inputs
        container.querySelectorAll('.cat-budget-input').forEach(input => {
            input.addEventListener('input', () => {
                const raw = input.value.replace(/[^0-9]/g, '');
                if (raw) input.value = Store.formatCurrency(parseInt(raw));
            });
        });

        // Delete category
        container.querySelectorAll('.cat-item__remove').forEach(btn => {
            btn.addEventListener('click', () => {
                const catId = btn.dataset.catId;
                const cat = Store.getCategory(catId);
                App.showConfirm('내역 삭제', `"${cat ? cat.name : ''}" 내역과 관련 지출을 삭제하시겠습니까?`, () => {
                    saveCategoryBudgets(); // Save typed budgets first!
                    Store.deleteCategory(catId);
                    renderCategoryList();
                });
            });
        });

        // Delete group
        container.querySelectorAll('.btn-delete-group').forEach(btn => {
            btn.addEventListener('click', () => {
                const groupId = btn.dataset.groupId;
                const group = Store.getCategoryGroup(groupId);
                const cats = Store.getCategoriesByGroup(groupId);
                App.showConfirm('구분 삭제', `"${group ? group.name : ''}" 구분과 하위 ${cats.length}개 내역 및 관련 지출을 모두 삭제하시겠습니까?`, () => {
                    saveCategoryBudgets(); // Save typed budgets first!
                    Store.deleteCategoryGroup(groupId);
                    renderCategoryList();
                });
            });
        });

        // Add category to group
        container.querySelectorAll('.btn-add-cat-to-group').forEach(btn => {
            btn.addEventListener('click', () => {
                const groupId = btn.dataset.groupId;
                const name = prompt('추가할 내역명을 입력하세요:');
                if (name && name.trim()) {
                    saveCategoryBudgets(); // Save typed budgets first!
                    Store.addCategory({ name: name.trim(), budget: 0, groupId });
                    renderCategoryList();
                }
            });
        });

        // Make items draggable
        const catItems = container.querySelectorAll('.cat-item');
        catItems.forEach(item => {
            item.setAttribute('draggable', 'true');
            item.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', item.dataset.catId);
                item.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
            });
            item.addEventListener('dragend', () => {
                item.classList.remove('dragging');
            });
            item.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.stopPropagation();
                item.classList.add('drag-over-item');
            });
            item.addEventListener('dragleave', () => {
                item.classList.remove('drag-over-item');
            });
            item.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();
                item.classList.remove('drag-over-item');
                const catId = e.dataTransfer.getData('text/plain');
                const targetCatId = item.dataset.catId;
                if (catId && catId !== targetCatId) {
                    saveCategoryBudgets(); // Save typed budgets first!
                    reorderCategories(catId, targetCatId, e.clientY, item);
                }
            });
        });

        // Make groups droppable
        const groupSections = container.querySelectorAll('.group-section');
        groupSections.forEach(section => {
            section.addEventListener('dragover', (e) => {
                e.preventDefault();
                section.classList.add('drag-over');
                e.dataTransfer.dropEffect = 'move';
            });
            section.addEventListener('dragleave', () => {
                section.classList.remove('drag-over');
            });
            section.addEventListener('drop', (e) => {
                e.preventDefault();
                section.classList.remove('drag-over');
                const catId = e.dataTransfer.getData('text/plain');
                const targetGroupId = section.dataset.groupId || null;
                
                if (catId) {
                    const cat = Store.getCategory(catId);
                    if (cat && cat.groupId !== targetGroupId) {
                        saveCategoryBudgets(); // Save typed budgets first!
                        Store.updateCategory(catId, { groupId: targetGroupId || null });
                        renderCategoryList();
                    }
                }
            });
        });

        // Bind modal inline edits
        container.querySelectorAll('.modal-group-editable').forEach(el => {
            el.addEventListener('click', handleModalGroupClick);
        });
        container.querySelectorAll('.modal-cat-name-editable').forEach(el => {
            el.addEventListener('click', handleModalCatNameClick);
        });
    }

    function handleModalGroupClick(e) {
        if (e.target.tagName === 'INPUT') return;
        const el = e.target.closest('.modal-group-editable');
        if (!el) return;
        if (el.querySelector('input')) return;

        const groupId = el.dataset.groupId;
        const group = Store.getCategoryGroup(groupId);
        if (!group) return;

        const currentValue = group.name;
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'group-edit-input';
        input.value = currentValue;
        input.style.width = '120px';

        const originalHTML = el.innerHTML;
        el.innerHTML = '';
        el.appendChild(input);
        input.focus();
        input.select();

        function finish() {
            const newName = input.value.trim();
            if (newName && newName !== currentValue) {
                saveCategoryBudgets(); // Save typed budgets first!
                Store.updateCategoryGroup(groupId, { name: newName });
                renderCategoryList();
            } else {
                cancel();
            }
        }

        function cancel() {
            el.innerHTML = originalHTML;
        }

        input.addEventListener('blur', finish);
        input.addEventListener('keydown', (ev) => {
            if (ev.key === 'Enter') { ev.preventDefault(); input.blur(); }
            if (ev.key === 'Escape') { input.removeEventListener('blur', finish); cancel(); }
        });
    }

    function handleModalCatNameClick(e) {
        if (e.target.tagName === 'INPUT') return;
        const el = e.target.closest('.modal-cat-name-editable');
        if (!el) return;
        if (el.querySelector('input')) return;

        const catId = el.dataset.catId;
        const cat = Store.getCategory(catId);
        if (!cat) return;

        const currentValue = cat.name;
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'cat-name-edit-input';
        input.value = currentValue;
        input.style.width = '140px';

        const originalHTML = el.innerHTML;
        el.innerHTML = '';
        el.appendChild(input);
        input.focus();
        input.select();

        function finish() {
            const newName = input.value.trim();
            if (newName && newName !== currentValue) {
                saveCategoryBudgets(); // Save typed budgets first!
                Store.updateCategory(catId, { name: newName });
                renderCategoryList();
            } else {
                cancel();
            }
        }

        function cancel() {
            el.innerHTML = originalHTML;
        }

        input.addEventListener('blur', finish);
        input.addEventListener('keydown', (ev) => {
            if (ev.key === 'Enter') { ev.preventDefault(); input.blur(); }
            if (ev.key === 'Escape') { input.removeEventListener('blur', finish); cancel(); }
        });
    }

    function reorderCategories(draggedId, targetId, clientY, targetEl) {
        const draggedCat = Store.getCategory(draggedId);
        const targetCat = Store.getCategory(targetId);
        if (!draggedCat || !targetCat) return;

        const rect = targetEl.getBoundingClientRect();
        const nextToTarget = (clientY - rect.top) > (rect.height / 2);

        const targetGroupId = targetCat.groupId || null;
        
        // Update dragged item's group
        draggedCat.groupId = targetGroupId;

        // Get all categories in the target group (excluding the dragged one)
        let list;
        if (!targetGroupId) {
            const groups = Store.getCategoryGroups();
            const groupedCatIds = new Set();
            groups.forEach(g => {
                const cats = Store.getCategoriesByGroup(g.id);
                cats.forEach(c => groupedCatIds.add(c.id));
            });
            list = Store.getCategories().filter(c => !groupedCatIds.has(c.id) && c.id !== draggedId);
        } else {
            list = Store.getCategoriesByGroup(targetGroupId).filter(c => c.id !== draggedId);
        }
        
        // Find insert position
        const targetIdx = list.findIndex(c => c.id === targetId);
        let insertIdx = targetIdx;
        if (nextToTarget) {
            insertIdx = targetIdx + 1;
        }

        // Insert dragged item
        list.splice(insertIdx, 0, draggedCat);
        
        // Re-assign orders and save
        list.forEach((cat, idx) => {
            Store.updateCategory(cat.id, { order: idx + 1, groupId: targetGroupId });
        });

        renderCategoryList();
    }

    function saveCategoryBudgets() {
        document.querySelectorAll('.cat-budget-input').forEach(input => {
            const catId = input.dataset.catId;
            const raw = input.value.replace(/[^0-9]/g, '');
            Store.updateCategoryBudget(catId, parseInt(raw) || 0);
        });
    }

    // ── Delete Project ───────────────────────────────────────

    function deleteCurrentProject() {
        const project = Store.getCurrentProject();
        if (!project) return;

        App.showConfirm(
            '과제 삭제',
            `"${project.name}" 과제와 모든 관련 데이터(비목, 지출)를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`,
            () => {
                Store.deleteProject(project.id);
                App.refresh();
                App.showToast('과제가 삭제되었습니다', 'success');
            }
        );
    }

    // ── Helpers ──────────────────────────────────────────────

    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    return { showAddModal, showEditModal, deleteCurrentProject };
})();
