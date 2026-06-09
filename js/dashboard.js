// ═══════════════════════════════════════════════════════════════
// Dashboard Module - KPI Cards, Summary Table, Chart
// ═══════════════════════════════════════════════════════════════

const Dashboard = (() => {

    function render() {
        const content = document.getElementById('content');
        const summary = Store.getTotalSummary();
        const catSummaries = Store.getCategorySummary();

        content.innerHTML = `
            <div class="tab-info">
                <h2 class="tab-info__title">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
                    예산 대시보드
                </h2>
            </div>

            <!-- KPI Cards -->
            ${renderKPICards(summary)}

            <!-- Sub KPI Cards (Sub-category Budget Overview) -->
            ${renderSubKPICards(catSummaries)}

            <!-- Summary Table -->
            ${renderSummaryTable(catSummaries, summary)}

            <!-- Chart -->
            ${renderChartSection(catSummaries, summary)}
        `;

        // Animate numbers
        requestAnimationFrame(() => {
            animateCountUps();
            drawDonutChart(catSummaries);
            bindInlineEditListeners();
        });
    }

    function renderKPICards(summary) {
        const rateColor = summary.color;
        const rateColorEnd = Store.getExecutionColor(Math.min(summary.totalRate + 20, 110));

        return `
        <div class="kpi-grid">
            <div class="kpi-card kpi-card--budget">
                <div class="kpi-card__label">총 배정예산</div>
                <div class="kpi-card__value">
                    <span class="count-up" data-target="${summary.totalBudget}" data-suffix="">0</span>
                    <span class="kpi-card__unit">원</span>
                </div>
                <div class="kpi-card__sub">전체 비목 배정 합계</div>
            </div>
            <div class="kpi-card kpi-card--used">
                <div class="kpi-card__label">총 사용금액</div>
                <div class="kpi-card__value">
                    <span class="count-up" data-target="${summary.totalUsed}" data-suffix="">0</span>
                    <span class="kpi-card__unit">원</span>
                </div>
                <div class="kpi-card__sub">이체완료 항목 합계</div>
            </div>
            <div class="kpi-card kpi-card--remaining">
                <div class="kpi-card__label">총 잔여예산</div>
                <div class="kpi-card__value ${summary.totalRemaining < 0 ? 'amount-negative' : ''}">
                    <span class="count-up" data-target="${summary.totalRemaining}" data-suffix="">0</span>
                    <span class="kpi-card__unit">원</span>
                </div>
                <div class="kpi-card__sub">${summary.totalRemaining < 0 ? '⚠️ 예산 초과' : '사용 가능 잔액'}</div>
            </div>
            <div class="kpi-card kpi-card--rate" style="--rate-color: ${rateColor}; --rate-color-end: ${rateColorEnd}">
                <div class="kpi-card__label">전체 집행률</div>
                <div class="kpi-card__value" style="color: ${rateColor}">
                    <span class="count-up" data-target="${summary.totalRate}" data-suffix="%" data-decimals="1">0</span>
                </div>
                <div class="kpi-card__sub">
                    <span class="status-badge ${summary.status.className}">${summary.status.icon} ${summary.status.label}</span>
                </div>
            </div>
        </div>`;
    }

    function renderSubKPICards(catSummaries) {
        const groups = Store.getCategoryGroups();
        const groupMap = {};
        groups.forEach(g => {
            groupMap[g.id] = {
                name: g.name,
                budget: 0,
                used: 0,
                remaining: 0,
                rate: 0
            };
        });

        const ungroupedKey = 'ungrouped';
        groupMap[ungroupedKey] = {
            name: '미분류',
            budget: 0,
            used: 0,
            remaining: 0,
            rate: 0
        };

        catSummaries.forEach(item => {
            const gid = item.groupId || (item.category && item.category.groupId);
            if (gid && groupMap[gid]) {
                groupMap[gid].budget += item.budget;
                groupMap[gid].used += item.used;
            } else {
                groupMap[ungroupedKey].budget += item.budget;
                groupMap[ungroupedKey].used += item.used;
            }
        });

        let activeGroups = Object.keys(groupMap).map(key => {
            const g = groupMap[key];
            g.remaining = g.budget - g.used;
            g.rate = g.budget > 0 ? (g.used / g.budget) * 100 : (g.used > 0 ? 100 : 0);
            g.color = Store.getExecutionColor(g.rate);
            g.status = Store.getExecutionStatus(g.rate);
            return g;
        }).filter(g => g.budget > 0 || g.used > 0);

        activeGroups.sort((a, b) => b.budget - a.budget);

        if (activeGroups.length === 0) return '';

        const cardsHTML = activeGroups.map(g => {
            const status = g.status;
            let badgeStyle = '';
            if (status.level === 'danger') badgeStyle = 'background:#fecaca;color:#dc2626';
            else if (status.level === 'warning') badgeStyle = 'background:#ffedd5;color:#ea580c';
            else if (status.level === 'caution') badgeStyle = 'background:#fef3c7;color:#d97706';
            else badgeStyle = 'background:#d1fae5;color:#059669';

            return `
            <div class="sub-kpi-card">
                <div class="sub-kpi-card__header">
                    <span class="sub-kpi-card__title" title="${escapeHtml(g.name)}">${escapeHtml(g.name)}</span>
                    <span class="sub-kpi-card__rate" style="${badgeStyle}">${g.rate.toFixed(1)}%</span>
                </div>
                <div class="sub-kpi-card__body">
                    <div class="sub-kpi-card__row">
                        <span>배정예산:</span>
                        <span class="sub-kpi-card__value">${Store.formatCurrency(g.budget)}원</span>
                    </div>
                    <div class="sub-kpi-card__row">
                        <span>잔여예산:</span>
                        <span class="sub-kpi-card__value ${g.remaining < 0 ? 'amount-negative' : ''}">${Store.formatCurrency(g.remaining)}원</span>
                    </div>
                </div>
            </div>`;
        }).join('');

        return `
        <div class="sub-kpi-section">
            <div class="sub-kpi-title">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
                구분별 집행 요약
            </div>
            <div class="sub-kpi-grid">
                ${cardsHTML}
            </div>
        </div>`;
    }

    function renderSummaryTable(catSummaries, total) {
        // Group summaries by categoryGroup
        const groups = Store.getCategoryGroups();
        const groupMap = {};
        groups.forEach(g => { groupMap[g.id] = { group: g, items: [] }; });

        // Categorize summaries into groups
        const ungrouped = [];
        catSummaries.forEach(item => {
            const gid = item.groupId || (item.category && item.category.groupId);
            if (gid && groupMap[gid]) {
                groupMap[gid].items.push(item);
            } else {
                ungrouped.push(item);
            }
        });

        let rows = '';

        // Render grouped rows
        groups.forEach(g => {
            const gData = groupMap[g.id];
            if (!gData || gData.items.length === 0) return;

            const items = gData.items;
            const groupBudget = items.reduce((s, i) => s + i.budget, 0);
            const groupUsed = items.reduce((s, i) => s + i.used, 0);
            const groupRemaining = groupBudget - groupUsed;
            const groupRate = groupBudget > 0 ? (groupUsed / groupBudget) * 100 : (groupUsed > 0 ? 100 : 0);
            const groupColor = Store.getExecutionColor(groupRate);
            const groupStatus = Store.getExecutionStatus(groupRate);

            items.forEach((item, idx) => {
                const barWidth = Math.min(item.rate, 120);
                const isFirst = idx === 0;

                rows += `<tr class="${isFirst ? 'group-first-row' : ''}">`;

                // 구분 column (rowspan for first item)
                if (isFirst) {
                    rows += `
                    <td class="group-cell" rowspan="${items.length}">
                        <div class="group-cell__name group-editable" data-group-id="${g.id}" title="클릭하여 구분명 수정">${escapeHtml(g.name)}</div>
                        <div class="group-cell__summary">
                            <span style="color:${groupColor};font-weight:700;font-size:0.8rem">${groupRate.toFixed(1)}%</span>
                            <span class="status-badge ${groupStatus.className}" style="font-size:0.68rem;padding:1px 6px">${groupStatus.icon}</span>
                        </div>
                    </td>`;
                }

                rows += `
                    <td style="font-weight:500">
                        <span class="cat-name-editable" data-cat-id="${item.category.id}" title="클릭하여 내역명 수정">
                            ${escapeHtml(item.category.name)}
                        </span>
                    </td>
                    <td class="text-right">
                        <span class="budget-editable amount-cell" data-cat-id="${item.category.id}" title="클릭하여 수정">
                            ${Store.formatCurrency(item.budget)}
                        </span>
                    </td>
                    <td class="text-right amount-cell">${Store.formatCurrency(item.used)}</td>
                    <td class="text-right amount-cell ${item.remaining < 0 ? 'amount-negative' : ''}">${Store.formatCurrency(item.remaining)}</td>
                    <td>
                        <div class="rate-cell">
                            <span class="rate-cell__value" style="color:${item.color}">${item.rate.toFixed(1)}%</span>
                            <div class="progress-bar progress-bar--sm">
                                <div class="progress-bar__fill" style="width:${barWidth}%;background:${item.color}"></div>
                            </div>
                        </div>
                    </td>
                    <td class="text-center">
                        <span class="status-badge ${item.status.className}">${item.status.icon} ${item.status.label}</span>
                    </td>
                    <td>
                        <span class="memo-editable" data-cat-id="${item.category.id}" title="클릭하여 메모 수정">${escapeHtml(item.category.memo || '')}</span>
                    </td>
                </tr>`;
            });
        });

        // Render ungrouped items (if any)
        ungrouped.forEach(item => {
            const barWidth = Math.min(item.rate, 120);
            rows += `
            <tr>
                <td style="color:var(--text-muted);font-style:italic">미분류</td>
                <td style="font-weight:500">
                    <span class="cat-name-editable" data-cat-id="${item.category.id}" title="클릭하여 내역명 수정">
                        ${escapeHtml(item.category.name)}
                    </span>
                </td>
                <td class="text-right">
                    <span class="budget-editable amount-cell" data-cat-id="${item.category.id}" title="클릭하여 수정">
                        ${Store.formatCurrency(item.budget)}
                    </span>
                </td>
                <td class="text-right amount-cell">${Store.formatCurrency(item.used)}</td>
                <td class="text-right amount-cell ${item.remaining < 0 ? 'amount-negative' : ''}">${Store.formatCurrency(item.remaining)}</td>
                <td>
                    <div class="rate-cell">
                        <span class="rate-cell__value" style="color:${item.color}">${item.rate.toFixed(1)}%</span>
                        <div class="progress-bar progress-bar--sm">
                            <div class="progress-bar__fill" style="width:${barWidth}%;background:${item.color}"></div>
                        </div>
                    </div>
                </td>
                <td class="text-center">
                    <span class="status-badge ${item.status.className}">${item.status.icon} ${item.status.label}</span>
                </td>
                <td>
                    <span class="memo-editable" data-cat-id="${item.category.id}" title="클릭하여 메모 수정">${escapeHtml(item.category.memo || '')}</span>
                </td>
            </tr>`;
        });

        return `
        <div class="section-card">
            <div class="section-card__header">
                <h3 class="section-card__title">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3h18v18H3z"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 3v18"/></svg>
                    예산 집행 현황
                </h3>
                <span style="font-size:0.78rem;color:var(--text-muted)">💡 배정예산을 클릭하면 직접 수정할 수 있습니다</span>
            </div>
            <div class="section-card__body">
                <table class="data-table" id="summary-table">
                    <thead>
                        <tr>
                            <th style="min-width:100px">구 분</th>
                            <th style="min-width:140px">내 역</th>
                            <th class="text-right" style="min-width:130px">배정예산 (원)</th>
                            <th class="text-right" style="min-width:120px">사용금액 (원)</th>
                            <th class="text-right" style="min-width:120px">잔여예산 (원)</th>
                            <th style="min-width:140px">집행률</th>
                            <th class="text-center" style="min-width:80px">상태</th>
                            <th style="min-width:180px">메모</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                    <tfoot>
                        <tr class="total-row">
                            <td colspan="2" style="font-weight:700">합 계</td>
                            <td class="text-right amount-cell">${Store.formatCurrency(total.totalBudget)}</td>
                            <td class="text-right amount-cell">${Store.formatCurrency(total.totalUsed)}</td>
                            <td class="text-right amount-cell ${total.totalRemaining < 0 ? 'amount-negative' : ''}">${Store.formatCurrency(total.totalRemaining)}</td>
                            <td>
                                <div class="rate-cell">
                                    <span class="rate-cell__value" style="color:${total.color}">${total.totalRate.toFixed(1)}%</span>
                                    <div class="progress-bar progress-bar--sm">
                                        <div class="progress-bar__fill" style="width:${Math.min(total.totalRate, 120)}%;background:${total.color}"></div>
                                    </div>
                                </div>
                            </td>
                            <td class="text-center">
                                <span class="status-badge ${total.status.className}">${total.status.icon} ${total.status.label}</span>
                            </td>
                            <td></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>`;
    }

    function renderChartSection(catSummaries) {
        return `
        <div class="section-card">
            <div class="section-card__header">
                <h3 class="section-card__title">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>
                    비목별 사용 비율
                </h3>
            </div>
            <div class="section-card__body">
                <div class="chart-container">
                    <div class="chart-canvas-wrap">
                        <canvas id="donut-chart" width="440" height="440"></canvas>
                        <div class="chart-center-label">
                            <div class="chart-center-label__title">총 사용</div>
                            <div class="chart-center-label__value" id="chart-center-value">0</div>
                        </div>
                    </div>
                    <div class="chart-legend" id="chart-legend"></div>
                </div>
            </div>
        </div>`;
    }

    // ── Inline Budget Edit ───────────────────────────────────

    function handleBudgetClick(e) {
        if (Store.isLocked()) {
            if (typeof App !== 'undefined' && App.showToast) {
                App.showToast('⚠️ 설정 잠금을 해제해야 편집할 수 있습니다.', 'warning');
            }
            return;
        }
        if (e.target.tagName === 'INPUT') return;
        const el = e.target.closest('.budget-editable');
        if (!el) return;
        if (el.querySelector('input')) return;

        const catId = el.dataset.catId;
        const cat = Store.getCategory(catId);
        if (!cat) return;

        const currentValue = cat.budget;
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'budget-edit-input';
        input.value = Store.formatCurrency(currentValue);

        const originalHTML = el.innerHTML;
        el.innerHTML = '';
        el.style.padding = '0';
        el.appendChild(input);
        input.focus();
        input.select();

        function finish() {
            const raw = input.value.replace(/[^0-9.-]/g, '');
            const newBudget = parseInt(raw) || 0;
            Store.updateCategoryBudget(catId, newBudget);
            render();
            if (typeof App !== 'undefined' && App.showToast) {
                App.showToast(`${cat.name} 배정예산이 수정되었습니다`, 'success');
            }
        }

        function cancel() {
            el.innerHTML = originalHTML;
            el.style.padding = '';
        }

        input.addEventListener('blur', finish);
        input.addEventListener('keydown', (ev) => {
            if (ev.key === 'Enter') { ev.preventDefault(); input.blur(); }
            if (ev.key === 'Escape') { input.removeEventListener('blur', finish); cancel(); }
        });
    }

    // ── Count-up Animation ───────────────────────────────────

    function animateCountUps() {
        document.querySelectorAll('.count-up').forEach(el => {
            const target = parseFloat(el.dataset.target) || 0;
            const suffix = el.dataset.suffix || '';
            const decimals = parseInt(el.dataset.decimals) || 0;
            const duration = 800;
            const start = performance.now();

            function step(now) {
                const progress = Math.min((now - start) / duration, 1);
                const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
                const current = target * eased;

                if (decimals > 0) {
                    el.textContent = current.toFixed(decimals) + suffix;
                } else {
                    el.textContent = Store.formatCurrency(Math.round(current)) + suffix;
                }

                if (progress < 1) {
                    requestAnimationFrame(step);
                } else {
                    if (decimals > 0) {
                        el.textContent = target.toFixed(decimals) + suffix;
                    } else {
                        el.textContent = Store.formatCurrency(target) + suffix;
                    }
                }
            }

            requestAnimationFrame(step);
        });
    }

    // ── Donut Chart (Canvas) ─────────────────────────────────

    function drawDonutChart(catSummaries) {
        const canvas = document.getElementById('donut-chart');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const W = canvas.width;
        const H = canvas.height;
        const cx = W / 2;
        const cy = H / 2;
        const outerR = Math.min(W, H) / 2 - 10;
        const innerR = outerR * 0.62;

        ctx.clearRect(0, 0, W, H);

        const usedItems = catSummaries.filter(s => s.used > 0);
        const totalUsed = usedItems.reduce((s, i) => s + i.used, 0);

        // Chart colors
        const colors = [
            '#3b82f6', '#8b5cf6', '#ec4899', '#f97316', '#f59e0b',
            '#10b981', '#06b6d4', '#6366f1', '#14b8a6', '#e11d48', '#84cc16'
        ];

        if (totalUsed === 0) {
            // Draw empty circle
            ctx.beginPath();
            ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
            ctx.arc(cx, cy, innerR, Math.PI * 2, 0, true);
            ctx.fillStyle = '#e2e8f0';
            ctx.fill();

            const centerEl = document.getElementById('chart-center-value');
            if (centerEl) centerEl.textContent = '0 원';

            const legendEl = document.getElementById('chart-legend');
            if (legendEl) legendEl.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;">사용 내역이 없습니다</p>';
            return;
        }

        let currentAngle = -Math.PI / 2;
        const gap = 0.02;

        usedItems.forEach((item, i) => {
            const sliceAngle = (item.used / totalUsed) * Math.PI * 2 - gap;
            const color = colors[i % colors.length];

            ctx.beginPath();
            ctx.arc(cx, cy, outerR, currentAngle, currentAngle + sliceAngle);
            ctx.arc(cx, cy, innerR, currentAngle + sliceAngle, currentAngle, true);
            ctx.closePath();
            ctx.fillStyle = color;
            ctx.fill();

            currentAngle += sliceAngle + gap;
        });

        // Center value
        const centerEl = document.getElementById('chart-center-value');
        if (centerEl) centerEl.textContent = Store.formatCurrency(totalUsed) + ' 원';

        // Legend
        const legendEl = document.getElementById('chart-legend');
        if (legendEl) {
            legendEl.innerHTML = usedItems.map((item, i) => {
                const pct = ((item.used / totalUsed) * 100).toFixed(1);
                return `
                <div class="chart-legend__item">
                    <div class="chart-legend__color" style="background:${colors[i % colors.length]}"></div>
                    <span class="chart-legend__label">${item.category.name}</span>
                    <span class="chart-legend__value">${Store.formatCurrency(item.used)}원 (${pct}%)</span>
                </div>`;
            }).join('');
        }
    }

    // ── Inline Name Edits ────────────────────────────────────

    function handleGroupClick(e) {
        if (Store.isLocked()) {
            if (typeof App !== 'undefined' && App.showToast) {
                App.showToast('⚠️ 설정 잠금을 해제해야 편집할 수 있습니다.', 'warning');
            }
            return;
        }
        if (e.target.tagName === 'INPUT') return;
        const el = e.target.closest('.group-editable');
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

        const originalHTML = el.innerHTML;
        el.innerHTML = '';
        el.appendChild(input);
        input.focus();
        input.select();

        function finish() {
            const newName = input.value.trim();
            if (newName && newName !== currentValue) {
                Store.updateCategoryGroup(groupId, { name: newName });
                render();
                if (typeof App !== 'undefined' && App.showToast) {
                    App.showToast(`구분명이 "${newName}"(으)로 수정되었습니다`, 'success');
                }
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

    function handleCatNameClick(e) {
        if (Store.isLocked()) {
            if (typeof App !== 'undefined' && App.showToast) {
                App.showToast('⚠️ 설정 잠금을 해제해야 편집할 수 있습니다.', 'warning');
            }
            return;
        }
        if (e.target.tagName === 'INPUT') return;
        const el = e.target.closest('.cat-name-editable');
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

        const originalHTML = el.innerHTML;
        el.innerHTML = '';
        el.appendChild(input);
        input.focus();
        input.select();

        function finish() {
            const newName = input.value.trim();
            if (newName && newName !== currentValue) {
                Store.updateCategory(catId, { name: newName });
                render();
                if (typeof App !== 'undefined' && App.showToast) {
                    App.showToast(`내역명이 "${newName}"(으)로 수정되었습니다`, 'success');
                }
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

    function handleMemoClick(e) {
        if (Store.isLocked()) {
            if (typeof App !== 'undefined' && App.showToast) {
                App.showToast('⚠️ 설정 잠금을 해제해야 편집할 수 있습니다.', 'warning');
            }
            return;
        }
        if (e.target.tagName === 'INPUT') return;
        const el = e.target.closest('.memo-editable');
        if (!el) return;
        if (el.querySelector('input')) return;

        const catId = el.dataset.catId;
        const cat = Store.getCategory(catId);
        if (!cat) return;

        const currentValue = cat.memo || '';
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'memo-edit-input';
        input.value = currentValue;
        input.placeholder = '메모 입력...';

        const originalHTML = el.innerHTML;
        el.innerHTML = '';
        el.appendChild(input);
        input.focus();
        if (currentValue) input.select();

        function finish() {
            const newMemo = input.value.trim();
            if (newMemo !== currentValue) {
                Store.updateCategory(catId, { memo: newMemo });
                render();
                if (typeof App !== 'undefined' && App.showToast) {
                    App.showToast(`메모가 수정되었습니다`, 'success');
                }
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

    function bindInlineEditListeners() {
        const content = document.getElementById('content');
        if (!content) return;
        
        content.querySelectorAll('.budget-editable').forEach(el => {
            el.addEventListener('click', handleBudgetClick);
        });
        content.querySelectorAll('.group-editable').forEach(el => {
            el.addEventListener('click', handleGroupClick);
        });
        content.querySelectorAll('.cat-name-editable').forEach(el => {
            el.addEventListener('click', handleCatNameClick);
        });
        content.querySelectorAll('.memo-editable').forEach(el => {
            el.addEventListener('click', handleMemoClick);
        });
    }

    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ── Event Binding ────────────────────────────────────────

    function bindEvents() {
        // Obsolete as we bind directly in render
    }

    function unbindEvents() {
    }

    return { render, bindEvents };
})();
