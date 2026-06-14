// ═══════════════════════════════════════════════════════════════
// Integrated Dashboard Module - Aggregate View for All Projects
// ═══════════════════════════════════════════════════════════════

const IntegratedDashboard = (() => {

    function render() {
        const content = document.getElementById('content');
        const summary = Store.getIntegratedSummary();

        content.innerHTML = `
            <div class="tab-info">
                <h2 class="tab-info__title">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
                    통합 예산 대시보드
                </h2>
            </div>

            <!-- KPI Cards -->
            ${renderKPICards(summary.total)}

            <!-- Summary Table -->
            ${renderSummaryTable(summary.groups, summary.total)}

            <!-- Chart -->
            ${renderChartSection(summary.groups, summary.total)}
        `;

        // Animate numbers
        requestAnimationFrame(() => {
            animateCountUps();
            drawDonutChart(summary.groups);
        });
    }

    function renderKPICards(total) {
        const rateColor = total.color;
        const rateColorEnd = Store.getExecutionColor(Math.min(total.totalRate + 20, 110));

        return `
        <div class="kpi-grid">
            <div class="kpi-card kpi-card--budget">
                <div class="kpi-card__label">통합 총 배정예산</div>
                <div class="kpi-card__value">
                    <span class="count-up" data-target="${total.totalBudget}" data-suffix="">0</span>
                    <span class="kpi-card__unit">원</span>
                </div>
                <div class="kpi-card__sub">전체 과제 배정 합계</div>
            </div>
            <div class="kpi-card kpi-card--used">
                <div class="kpi-card__label">통합 총 사용금액</div>
                <div class="kpi-card__value">
                    <span class="count-up" data-target="${total.totalUsed}" data-suffix="">0</span>
                    <span class="kpi-card__unit">원</span>
                </div>
                <div class="kpi-card__sub">전체 과제 이체완료 합계</div>
            </div>
            <div class="kpi-card kpi-card--pending">
                <div class="kpi-card__label">통합 이체 대기 금액</div>
                <div class="kpi-card__value" style="color:#f59e0b">
                    <span class="count-up" data-target="${total.pendingAmount || 0}" data-suffix="">0</span>
                    <span class="kpi-card__unit">원</span>
                </div>
                <div class="kpi-card__sub">전체 작성됨 (미이체) 합계</div>
            </div>
            <div class="kpi-card kpi-card--remaining">
                <div class="kpi-card__label">통합 총 잔여예산</div>
                <div class="kpi-card__value ${total.totalRemaining < 0 ? 'amount-negative' : ''}">
                    <span class="count-up" data-target="${total.totalRemaining}" data-suffix="">0</span>
                    <span class="kpi-card__unit">원</span>
                </div>
                <div class="kpi-card__sub">${total.totalRemaining < 0 ? '⚠️ 예산 초과' : '사용 가능 총 잔액'}</div>
            </div>
            <div class="kpi-card kpi-card--rate" style="--rate-color: ${rateColor}; --rate-color-end: ${rateColorEnd}">
                <div class="kpi-card__label">통합 집행률</div>
                <div class="kpi-card__value" style="color: ${rateColor}">
                    <span class="count-up" data-target="${total.totalRate}" data-suffix="%" data-decimals="1">0</span>
                </div>
                <div class="kpi-card__sub">
                    <span class="status-badge ${total.status.className}">${total.status.icon} ${total.status.label}</span>
                </div>
            </div>
        </div>`;
    }

    function renderSummaryTable(groups, total) {
        let rows = '';

        groups.forEach(item => {
            const barWidth = Math.min(item.rate, 120);

            rows += `
            <tr>
                <td style="font-weight:600;color:var(--text-main)">
                    ${escapeHtml(item.name)}
                </td>
                <td class="text-right amount-cell">${Store.formatCurrency(item.budget)}</td>
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
            </tr>`;
        });

        if (groups.length === 0) {
            rows = `<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:30px">데이터가 존재하지 않습니다.</td></tr>`;
        }

        return `
        <div class="section-card">
            <div class="section-card__header">
                <h3 class="section-card__title">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3h18v18H3z"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 3v18"/></svg>
                    통합 구분별 집행 현황
                </h3>
                <span style="font-size:0.78rem;color:var(--text-muted)">💡 통합 대시보드는 조회 전용입니다. 정보 수정은 각 과제 대시보드에서 진행해주세요.</span>
            </div>
            <div class="section-card__body">
                <div class="table-wrapper">
                    <table class="data-table" id="summary-table">
                    <thead>
                        <tr>
                            <th style="min-width:140px">구 분</th>
                            <th class="text-right" style="min-width:140px">배정예산 (원)</th>
                            <th class="text-right" style="min-width:130px">사용금액 (원)</th>
                            <th class="text-right" style="min-width:130px">잔여예산 (원)</th>
                            <th style="min-width:150px">집행률</th>
                            <th class="text-center" style="min-width:90px">상태</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                    <tfoot>
                        <tr class="total-row">
                            <td style="font-weight:700">합 계</td>
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
                        </tr>
                    </tfoot>
                </table>
                </div>
            </div>
        </div>`;
    }

    function renderChartSection() {
        return `
        <div class="section-card">
            <div class="section-card__header">
                <h3 class="section-card__title">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>
                    통합 구분별 사용 비율
                </h3>
            </div>
            <div class="section-card__body">
                <div class="chart-container">
                    <div class="chart-canvas-wrap">
                        <canvas id="integrated-donut-chart" width="440" height="440"></canvas>
                        <div class="chart-center-label">
                            <div class="chart-center-label__title">총 사용</div>
                            <div class="chart-center-label__value" id="integrated-chart-center-value">0</div>
                        </div>
                    </div>
                    <div class="chart-legend" id="integrated-chart-legend"></div>
                </div>
            </div>
        </div>`;
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
                const eased = 1 - Math.pow(1 - progress, 3);
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
    function drawDonutChart(groups) {
        const canvas = document.getElementById('integrated-donut-chart');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const W = canvas.width;
        const H = canvas.height;
        const cx = W / 2;
        const cy = H / 2;
        const outerR = Math.min(W, H) / 2 - 10;
        const innerR = outerR * 0.62;

        ctx.clearRect(0, 0, W, H);

        const usedItems = groups.filter(s => s.used > 0);
        const totalUsed = usedItems.reduce((s, i) => s + i.used, 0);

        const colors = [
            '#3b82f6', '#8b5cf6', '#ec4899', '#f97316', '#f59e0b',
            '#10b981', '#06b6d4', '#6366f1', '#14b8a6', '#e11d48', '#84cc16'
        ];

        if (totalUsed === 0) {
            ctx.beginPath();
            ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
            ctx.arc(cx, cy, innerR, Math.PI * 2, 0, true);
            ctx.fillStyle = '#e2e8f0';
            ctx.fill();

            const centerEl = document.getElementById('integrated-chart-center-value');
            if (centerEl) centerEl.textContent = '0 원';

            const legendEl = document.getElementById('integrated-chart-legend');
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

        const centerEl = document.getElementById('integrated-chart-center-value');
        if (centerEl) centerEl.textContent = Store.formatCurrency(totalUsed) + ' 원';

        const legendEl = document.getElementById('integrated-chart-legend');
        if (legendEl) {
            legendEl.innerHTML = usedItems.map((item, i) => {
                const pct = ((item.used / totalUsed) * 100).toFixed(1);
                return `
                <div class="chart-legend__item">
                    <div class="chart-legend__color" style="background:${colors[i % colors.length]}"></div>
                    <span class="chart-legend__label">${item.name}</span>
                    <span class="chart-legend__value">${Store.formatCurrency(item.used)}원 (${pct}%)</span>
                </div>`;
            }).join('');
        }
    }

    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    return { render };
})();
