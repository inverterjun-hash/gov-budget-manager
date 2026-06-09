// ═══════════════════════════════════════════════════════════════
// Export Module - CSV Export / Import
// ═══════════════════════════════════════════════════════════════

const Export = (() => {

    // ── Dashboard Export ─────────────────────────────────────

    function exportDashboard() {
        const project = Store.getCurrentProject();
        if (!project) {
            App.showToast('과제를 선택해주세요', 'error');
            return;
        }

        const yearId = Store.getCurrentYearId();
        const year = project.years.find(y => y.id === yearId);
        const summaries = Store.getCategorySummary();
        const total = Store.getTotalSummary();
        const groups = Store.getCategoryGroups();
        const groupMap = {};
        groups.forEach(g => { groupMap[g.id] = g.name; });

        let csv = '\ufeff'; // UTF-8 BOM
        csv += `과제명,${project.name}\n`;
        csv += `지원기관,${project.institution}\n`;
        csv += `연차,${year ? year.label : ''}\n`;
        csv += `내보내기 일시,${new Date().toLocaleString('ko-KR')}\n`;
        csv += '\n';
        csv += '구분,내역,배정예산(원),사용금액(원),잔여예산(원),집행률(%),상태,메모\n';

        summaries.forEach(item => {
            const groupName = item.groupId ? (groupMap[item.groupId] || '미분류') : '미분류';
            csv += `${groupName},${item.category.name},${item.budget},${item.used},${item.remaining},${item.rate.toFixed(1)},${item.status.label},${item.category.memo || ''}\n`;
        });

        csv += `합계,,${total.totalBudget},${total.totalUsed},${total.totalRemaining},${total.totalRate.toFixed(1)},${total.status.label},\n`;

        const filename = `예산현황_${project.name}_${year ? year.label : ''}_${getDateStr()}.csv`;
        downloadCSV(csv, filename);
        App.showToast('예산 현황이 내보내기 되었습니다', 'success');
    }

    // ── Expenses Export ──────────────────────────────────────

    function exportExpenses() {
        const project = Store.getCurrentProject();
        if (!project) {
            App.showToast('과제를 선택해주세요', 'error');
            return;
        }

        const yearId = Store.getCurrentYearId();
        const year = project.years.find(y => y.id === yearId);
        const expenses = Store.getExpenses();
        const categories = Store.getCategories();
        const groups = Store.getCategoryGroups();
        
        const catMap = {};
        const catGroupMap = {};
        const groupMap = {};
        groups.forEach(g => { groupMap[g.id] = g.name; });
        categories.forEach(c => {
            catMap[c.id] = c.name;
            catGroupMap[c.id] = c.groupId ? (groupMap[c.groupId] || '미분류') : '미분류';
        });

        let csv = '\ufeff';
        csv += `과제명,${project.name}\n`;
        csv += `연차,${year ? year.label : ''}\n`;
        csv += `내보내기 일시,${new Date().toLocaleString('ko-KR')}\n`;
        csv += '\n';
        csv += '결제일자,구분,내역,사용내역,계산서번호,업체명,담당자,금액(VAT포함),이체완료\n';

        expenses.forEach(exp => {
            csv += [
                exp.date,
                catGroupMap[exp.categoryId] || '미분류',
                catMap[exp.categoryId] || '',
                `"${(exp.description || '').replace(/"/g, '""')}"`,
                exp.invoiceNo || '',
                `"${(exp.vendor || '').replace(/"/g, '""')}"`,
                exp.manager || '',
                exp.amount,
                exp.transferred ? 'O' : ''
            ].join(',') + '\n';
        });

        const filename = `지출내역_${project.name}_${year ? year.label : ''}_${getDateStr()}.csv`;
        downloadCSV(csv, filename);
        App.showToast(`지출 내역 ${expenses.length}건이 내보내기 되었습니다`, 'success');
    }

    // ── Import Modal ─────────────────────────────────────────

    function showImportModal() {
        const categories = Store.getCategories();
        if (categories.length === 0) {
            App.showToast('먼저 과제와 비목을 설정해주세요', 'error');
            return;
        }

        const html = `
        <div class="modal__header">
            <h3 class="modal__title">CSV 지출내역 가져오기</h3>
            <button class="modal__close" id="modal-close">&times;</button>
        </div>
        <div class="modal__body">
            <div class="form-hint" style="margin-bottom:16px">
                CSV 파일의 열 순서: 결제일자, 비목, 사용내역, 계산서번호, 업체명, 담당자, 금액(VAT포함), 이체완료(O/빈칸)<br>
                첫 번째 행은 헤더로 인식하여 건너뜁니다.
            </div>
            <div class="drop-zone" id="drop-zone">
                <div class="drop-zone__icon">📂</div>
                <div class="drop-zone__text">CSV 파일을 드래그하거나 클릭하여 선택하세요</div>
                <div class="drop-zone__hint">.csv 파일만 지원됩니다</div>
                <input type="file" accept=".csv" id="import-file" style="display:none">
            </div>
            <div id="import-preview-container"></div>
        </div>
        <div class="modal__footer">
            <button class="btn btn--ghost" id="modal-cancel">취소</button>
            <button class="btn btn--primary hidden" id="btn-do-import">가져오기</button>
        </div>`;

        App.showModal(html);

        const dropZone = document.getElementById('drop-zone');
        const fileInput = document.getElementById('import-file');
        let parsedData = null;

        dropZone.addEventListener('click', () => fileInput.click());
        dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
        dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
        });
        fileInput.addEventListener('change', () => {
            if (fileInput.files.length) handleFile(fileInput.files[0]);
        });

        function handleFile(file) {
            if (!file.name.endsWith('.csv')) {
                App.showToast('CSV 파일만 지원됩니다', 'error');
                return;
            }
            const reader = new FileReader();
            reader.onload = (e) => {
                parsedData = parseCSV(e.target.result);
                showPreview(parsedData);
            };
            reader.readAsText(file, 'UTF-8');
        }

        function showPreview(data) {
            const container = document.getElementById('import-preview-container');
            if (data.length === 0) {
                container.innerHTML = '<p style="color:var(--rate-danger);margin-top:12px">유효한 데이터가 없습니다.</p>';
                return;
            }

            container.innerHTML = `
                <p style="margin:12px 0 8px;font-weight:600">${data.length}건의 데이터가 감지되었습니다</p>
                <div class="import-preview">
                    <table class="data-table">
                        <thead>
                            <tr><th>일자</th><th>비목</th><th>내역</th><th>금액</th><th>이체</th></tr>
                        </thead>
                        <tbody>
                            ${data.slice(0, 10).map(row => `
                                <tr>
                                    <td>${row.date}</td>
                                    <td>${row.categoryName}</td>
                                    <td>${row.description}</td>
                                    <td class="text-right">${Store.formatCurrency(row.amount)}</td>
                                    <td class="text-center">${row.transferred ? 'O' : ''}</td>
                                </tr>
                            `).join('')}
                            ${data.length > 10 ? `<tr><td colspan="5" style="text-align:center;color:var(--text-muted)">... 외 ${data.length - 10}건</td></tr>` : ''}
                        </tbody>
                    </table>
                </div>`;

            document.getElementById('btn-do-import').classList.remove('hidden');
        }

        // Import button
        document.getElementById('btn-do-import').addEventListener('click', () => {
            if (!parsedData || parsedData.length === 0) return;

            const categories = Store.getCategories();
            const groups = Store.getCategoryGroups();
            let imported = 0;
            let skipped = 0;

            parsedData.forEach(row => {
                // Match category by name (and optionally group name if groupName is specified)
                let cat = null;
                if (row.groupName) {
                    const group = groups.find(g => g.name.toLowerCase() === row.groupName.toLowerCase());
                    if (group) {
                        cat = categories.find(c => c.name.toLowerCase() === row.categoryName.toLowerCase() && c.groupId === group.id);
                    }
                }
                if (!cat) {
                    cat = categories.find(c => c.name.toLowerCase() === row.categoryName.toLowerCase());
                }

                if (!cat) {
                    skipped++;
                    return;
                }

                Store.addExpense({
                    date: row.date,
                    categoryId: cat.id,
                    description: row.description,
                    invoiceNo: row.invoiceNo,
                    vendor: row.vendor,
                    manager: row.manager,
                    amount: row.amount,
                    transferred: row.transferred
                });
                imported++;
            });

            App.closeModal();
            App.showToast(`${imported}건 가져오기 완료` + (skipped > 0 ? ` (${skipped}건 비목 불일치로 건너뜀)` : ''), 'success');
            App.navigateTo(App.getCurrentTab());
        });

        document.getElementById('modal-cancel').addEventListener('click', App.closeModal);
        document.getElementById('modal-close').addEventListener('click', App.closeModal);
    }

    // ── Backup / Restore ─────────────────────────────────────

    function backupData() {
        const data = Store.exportData();
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `과제비용관리_백업_${getDateStr()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        App.showToast('데이터 백업이 완료되었습니다', 'success');
    }

    function showRestoreModal() {
        const html = `
        <div class="modal__header">
            <h3 class="modal__title">데이터 복원</h3>
            <button class="modal__close" id="modal-close">&times;</button>
        </div>
        <div class="modal__body">
            <div style="background:var(--rate-danger-bg);padding:12px 16px;border-radius:var(--radius-sm);margin-bottom:16px;font-size:0.88rem;color:#dc2626">
                ⚠ 데이터 복원 시 현재 모든 데이터가 덮어쓰기됩니다.
            </div>
            <div class="drop-zone" id="restore-drop-zone">
                <div class="drop-zone__icon">📂</div>
                <div class="drop-zone__text">백업 JSON 파일을 드래그하거나 클릭하여 선택하세요</div>
                <input type="file" accept=".json" id="restore-file" style="display:none">
            </div>
        </div>
        <div class="modal__footer">
            <button class="btn btn--ghost" id="modal-cancel">취소</button>
        </div>`;

        App.showModal(html);

        const dropZone = document.getElementById('restore-drop-zone');
        const fileInput = document.getElementById('restore-file');

        dropZone.addEventListener('click', () => fileInput.click());
        dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
        dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            if (e.dataTransfer.files.length) handleRestoreFile(e.dataTransfer.files[0]);
        });
        fileInput.addEventListener('change', () => {
            if (fileInput.files.length) handleRestoreFile(fileInput.files[0]);
        });

        function handleRestoreFile(file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    if (!data.projects || !data.categories || !data.expenses) {
                        App.showToast('유효하지 않은 백업 파일입니다', 'error');
                        return;
                    }
                    App.showConfirm('데이터 복원', `${data.projects.length}개 과제, ${data.expenses.length}건 지출 데이터를 복원하시겠습니까?`, () => {
                        Store.importData(data);
                        App.closeModal();
                        App.refresh();
                        App.showToast('데이터가 복원되었습니다', 'success');
                    });
                } catch (err) {
                    App.showToast('파일 형식이 올바르지 않습니다', 'error');
                }
            };
            reader.readAsText(file);
        }

        document.getElementById('modal-cancel').addEventListener('click', App.closeModal);
        document.getElementById('modal-close').addEventListener('click', App.closeModal);
    }

    // ── CSV Parser ───────────────────────────────────────────

    function parseCSV(text) {
        const lines = text.split('\n').filter(l => l.trim());
        if (lines.length < 2) return [];

        const results = [];
        // Skip header (first line) and any metadata lines (lines without commas in expected positions)
        let startIdx = 0;
        for (let i = 0; i < lines.length; i++) {
            const cols = splitCSVLine(lines[i]);
            if (cols.length >= 7 && isDateLike(cols[0].trim())) {
                startIdx = i;
                break;
            }
        }

        for (let i = startIdx; i < lines.length; i++) {
            const cols = splitCSVLine(lines[i]);
            if (cols.length < 7) continue;

            const date = cols[0].trim();
            if (!isDateLike(date)) continue;

            // Detect new format (9+ columns, where 2nd is Group, 3rd is Category) vs old format (8 columns, where 2nd is Category)
            const isNewFormat = cols.length >= 9 && !isDateLike(cols[1]) && !isDateLike(cols[2]);

            if (isNewFormat) {
                results.push({
                    date: normalizeDate(date),
                    groupName: cols[1].trim(),
                    categoryName: cols[2].trim(),
                    description: cols[3].trim().replace(/^"|"$/g, ''),
                    invoiceNo: cols[4] ? cols[4].trim() : '',
                    vendor: cols[5] ? cols[5].trim().replace(/^"|"$/g, '') : '',
                    manager: cols[6] ? cols[6].trim() : '',
                    amount: parseInt((cols[7] || '').replace(/[^0-9.-]/g, '')) || 0,
                    transferred: cols[8] ? cols[8].trim().toUpperCase() === 'O' : false
                });
            } else {
                results.push({
                    date: normalizeDate(date),
                    groupName: '',
                    categoryName: cols[1].trim(),
                    description: cols[2].trim().replace(/^"|"$/g, ''),
                    invoiceNo: cols[3] ? cols[3].trim() : '',
                    vendor: cols[4] ? cols[4].trim().replace(/^"|"$/g, '') : '',
                    manager: cols[5] ? cols[5].trim() : '',
                    amount: parseInt((cols[6] || '').replace(/[^0-9.-]/g, '')) || 0,
                    transferred: cols[7] ? cols[7].trim().toUpperCase() === 'O' : false
                });
            }
        }

        return results;
    }

    function splitCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') {
                inQuotes = !inQuotes;
            } else if (ch === ',' && !inQuotes) {
                result.push(current);
                current = '';
            } else {
                current += ch;
            }
        }
        result.push(current);
        return result;
    }

    function isDateLike(str) {
        return /^\d{4}[-\/]\d{1,2}[-\/]\d{1,2}$/.test(str);
    }

    function normalizeDate(str) {
        const parts = str.split(/[-\/]/);
        return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    }

    // ── RCMS Excel Import ─────────────────────────────────────

    // Known RCMS column header keywords for auto-detection
    const RCMS_COLUMN_RULES = {
        date:        ['사용일자','거래일자','집행일자','결제일자','이체일','이체일자','일자','날짜','집행일','사용일','거래일'],
        category:    ['비목','비목명','비목(대)','비목대분류','비목대','항목','비목구분','비목분류','비목(대분류)'],
        subCategory: ['세부비목','비목(소)','비목소분류','비목소','세목','비목(소분류)','세부항목'],
        description: ['사용내역','적요','내역','거래내용','품명','사용처','용도','지출내역','적요내용','집행내역','비고'],
        vendor:      ['거래처','거래처명','업체명','업체','가맹점','가맹점명','수취인','입금처','상호','거래업체'],
        manager:     ['담당자','연구자','책임자','성명','집행자','사용자','연구책임자'],
        amount:      ['금액','합계금액','합계','총금액','사용금액','집행금액','총액','지급액','이체금액','실지급액','결제금액'],
        supply:      ['공급가액','공급가','공급액'],
        vat:         ['부가세','부가가치세','VAT','세액'],
        invoiceNo:   ['세금계산서','계산서번호','승인번호','전표번호','증빙번호','카드승인번호'],
        transferred: ['이체','이체완료','이체여부','이체상태','처리상태','집행상태','처리여부']
    };

    function showRCMSImportModal() {
        const project = Store.getCurrentProject();
        if (!project) {
            App.showToast('먼저 과제를 선택하세요', 'error');
            return;
        }

        const html = `
        <div class="modal__header">
            <h3 class="modal__title">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/><path d="M3 9h18"/><path d="M3 15h18"/></svg>
                RCMS 엑셀 업로드
            </h3>
            <button class="modal__close" id="modal-close">&times;</button>
        </div>
        <div class="modal__body">
            <div class="rcms-info-box">
                <strong>📌 사용법</strong>
                <ol>
                    <li>RCMS에서 지출내역 엑셀 파일(.xlsx, .xls, .csv)을 다운로드하세요</li>
                    <li>아래에 파일을 드래그하거나 클릭하여 업로드하세요</li>
                    <li>열(컬럼)이 자동 감지됩니다 — 필요시 매핑을 수정하세요</li>
                    <li>미리보기를 확인한 후 '가져오기' 버튼을 누르세요</li>
                </ol>
            </div>
            <div class="drop-zone drop-zone--rcms" id="rcms-drop-zone">
                <div class="drop-zone__icon">📊</div>
                <div class="drop-zone__text">RCMS 엑셀 파일을 드래그하거나 클릭하여 선택</div>
                <div class="drop-zone__hint">.xlsx · .xls · .csv 지원</div>
                <input type="file" accept=".xlsx,.xls,.csv" id="rcms-file-input" style="display:none">
            </div>
            <div id="rcms-file-name" class="rcms-file-name hidden"></div>
            <div id="rcms-mapping-section" class="hidden"></div>
            <div id="rcms-preview-section" class="hidden"></div>
        </div>
        <div class="modal__footer">
            <button class="btn btn--ghost" id="modal-cancel">취소</button>
            <button class="btn btn--primary hidden" id="btn-rcms-import">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                가져오기
            </button>
        </div>`;

        App.showModal(html);

        // Make modal wider for mapping UI
        const modal = document.getElementById('modal-container');
        modal.style.maxWidth = '820px';

        const dropZone = document.getElementById('rcms-drop-zone');
        const fileInput = document.getElementById('rcms-file-input');
        let sheetData = null;
        let headers = [];
        let columnMapping = {};

        // Drag & drop
        dropZone.addEventListener('click', () => fileInput.click());
        dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
        dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            if (e.dataTransfer.files.length) handleRCMSFile(e.dataTransfer.files[0]);
        });
        fileInput.addEventListener('change', () => {
            if (fileInput.files.length) handleRCMSFile(fileInput.files[0]);
        });

        function handleRCMSFile(file) {
            const ext = file.name.split('.').pop().toLowerCase();
            if (!['xlsx', 'xls', 'csv'].includes(ext)) {
                App.showToast('지원되지 않는 파일 형식입니다 (.xlsx, .xls, .csv만 가능)', 'error');
                return;
            }

            // Show file name
            const fileNameEl = document.getElementById('rcms-file-name');
            fileNameEl.classList.remove('hidden');
            fileNameEl.innerHTML = `📄 <strong>${file.name}</strong> <span style="color:var(--text-muted)">(${(file.size / 1024).toFixed(1)} KB)</span>`;

            // Hide drop zone
            dropZone.style.display = 'none';

            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array', cellDates: true });

                    // Use first sheet
                    const sheetName = workbook.SheetNames[0];
                    const sheet = workbook.Sheets[sheetName];

                    // Convert to JSON (array of arrays)
                    const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

                    if (rawRows.length < 2) {
                        App.showToast('데이터가 부족합니다 (최소 2행 필요)', 'error');
                        return;
                    }

                    // Find the header row (first row with multiple non-empty cells)
                    let headerRowIdx = findHeaderRow(rawRows);
                    headers = rawRows[headerRowIdx].map(h => String(h).trim());
                    sheetData = rawRows.slice(headerRowIdx + 1).filter(row =>
                        row.some(cell => cell !== '' && cell !== null && cell !== undefined)
                    );

                    // If workbook has multiple sheets, show info
                    let sheetInfo = '';
                    if (workbook.SheetNames.length > 1) {
                        sheetInfo = `<div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:8px">📑 ${workbook.SheetNames.length}개 시트 중 "${sheetName}" 사용 · ${sheetData.length}행 감지</div>`;
                    }

                    // Auto-detect column mapping
                    columnMapping = autoDetectColumns(headers);
                    renderColumnMapping(headers, columnMapping, sheetInfo);
                    renderPreview(sheetData, headers, columnMapping);
                } catch (err) {
                    console.error('Excel parse error:', err);
                    App.showToast('파일을 읽는 중 오류가 발생했습니다: ' + err.message, 'error');
                    dropZone.style.display = '';
                }
            };
            reader.readAsArrayBuffer(file);
        }

        function findHeaderRow(rows) {
            // Find the row with the most non-empty cells (likely header)
            let bestIdx = 0;
            let bestCount = 0;
            const limit = Math.min(rows.length, 10); // Check first 10 rows

            for (let i = 0; i < limit; i++) {
                const nonEmpty = rows[i].filter(c => c !== '' && c !== null && c !== undefined).length;
                if (nonEmpty > bestCount) {
                    bestCount = nonEmpty;
                    bestIdx = i;
                }
            }
            return bestIdx;
        }

        function autoDetectColumns(headers) {
            const mapping = {};
            const fieldKeys = Object.keys(RCMS_COLUMN_RULES);

            fieldKeys.forEach(field => {
                const keywords = RCMS_COLUMN_RULES[field];
                const matchIdx = headers.findIndex(h => {
                    const normalized = h.replace(/[\s\(\)\[\]]/g, '');
                    return keywords.some(kw => {
                        const normalizedKw = kw.replace(/[\s\(\)\[\]]/g, '');
                        return normalized === normalizedKw || normalized.includes(normalizedKw) || normalizedKw.includes(normalized);
                    });
                });

                if (matchIdx !== -1) {
                    mapping[field] = matchIdx;
                }
            });

            return mapping;
        }

        function renderColumnMapping(headers, mapping, extraInfo) {
            const section = document.getElementById('rcms-mapping-section');
            section.classList.remove('hidden');

            const fields = [
                { key: 'date',        label: '결제일자',    icon: '📅', required: true },
                { key: 'category',    label: '비목(대분류)', icon: '📂', required: false },
                { key: 'subCategory', label: '세부비목',    icon: '📁', required: false },
                { key: 'description', label: '사용내역',    icon: '📝', required: true },
                { key: 'vendor',      label: '거래처/업체', icon: '🏢', required: false },
                { key: 'manager',     label: '담당자',      icon: '👤', required: false },
                { key: 'amount',      label: '금액(합계)',  icon: '💰', required: true },
                { key: 'supply',      label: '공급가액',    icon: '💵', required: false },
                { key: 'vat',         label: '부가세',      icon: '📊', required: false },
                { key: 'invoiceNo',   label: '계산서번호',  icon: '🧾', required: false },
                { key: 'transferred', label: '이체상태',    icon: '✅', required: false }
            ];

            const optionsHTML = headers.map((h, i) =>
                `<option value="${i}">${h} (${getColumnLetter(i)}열)</option>`
            ).join('');

            const matchedCount = Object.keys(mapping).length;
            const totalFields = fields.filter(f => f.required).length;

            section.innerHTML = `
                ${extraInfo || ''}
                <div class="mapping-header">
                    <h4 class="mapping-header__title">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3h18v18H3z"/><path d="M3 9h18"/><path d="M9 3v18"/></svg>
                        열(컬럼) 매핑
                    </h4>
                    <span class="mapping-header__badge ${matchedCount >= totalFields ? 'badge--success' : 'badge--warning'}">
                        ${matchedCount}개 자동감지
                    </span>
                </div>
                <div class="mapping-grid">
                    ${fields.map(field => {
                        const isMatched = mapping[field.key] !== undefined;
                        return `
                        <div class="mapping-item ${isMatched ? 'mapping-item--matched' : ''} ${field.required ? 'mapping-item--required' : ''}">
                            <div class="mapping-item__label">
                                <span>${field.icon}</span>
                                <span>${field.label}</span>
                                ${field.required ? '<span class="mapping-required">*필수</span>' : ''}
                            </div>
                            <select class="mapping-select" data-field="${field.key}">
                                <option value="-1">— 사용 안함 —</option>
                                ${optionsHTML}
                            </select>
                            ${isMatched ? '<span class="mapping-check">✓</span>' : '<span class="mapping-check mapping-check--empty">–</span>'}
                        </div>`;
                    }).join('')}
                </div>
                <div class="mapping-tip">
                    💡 금액이 공급가액+부가세로 분리된 경우, '공급가액'과 '부가세'를 매핑하면 자동 합산됩니다.
                </div>`;

            // Set selected values for auto-detected mappings
            section.querySelectorAll('.mapping-select').forEach(select => {
                const field = select.dataset.field;
                if (mapping[field] !== undefined) {
                    select.value = mapping[field];
                }
            });

            // On mapping change → update preview
            section.querySelectorAll('.mapping-select').forEach(select => {
                select.addEventListener('change', () => {
                    const field = select.dataset.field;
                    const val = parseInt(select.value);
                    if (val === -1) {
                        delete columnMapping[field];
                    } else {
                        columnMapping[field] = val;
                    }

                    // Update matched indicator
                    const item = select.closest('.mapping-item');
                    const check = item.querySelector('.mapping-check');
                    if (val !== -1) {
                        item.classList.add('mapping-item--matched');
                        check.textContent = '✓';
                        check.className = 'mapping-check';
                    } else {
                        item.classList.remove('mapping-item--matched');
                        check.textContent = '–';
                        check.className = 'mapping-check mapping-check--empty';
                    }

                    renderPreview(sheetData, headers, columnMapping);
                });
            });
        }

        function renderPreview(data, headers, mapping) {
            const section = document.getElementById('rcms-preview-section');
            section.classList.remove('hidden');

            const parsed = parseRCMSData(data, mapping);
            const importBtn = document.getElementById('btn-rcms-import');

            if (parsed.length === 0) {
                section.innerHTML = '<p style="color:var(--rate-danger);margin-top:12px">매핑된 열로 유효한 데이터를 찾지 못했습니다. 매핑을 확인해주세요.</p>';
                importBtn.classList.add('hidden');
                return;
            }

            importBtn.classList.remove('hidden');

            const previewRows = parsed.slice(0, 8);
            section.innerHTML = `
                <div class="preview-header">
                    <h4>📋 미리보기 (${parsed.length}건 중 상위 ${previewRows.length}건)</h4>
                </div>
                <div class="import-preview">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>일자</th>
                                <th>비목</th>
                                <th>내역</th>
                                <th>거래처</th>
                                <th>담당자</th>
                                <th class="text-right">금액</th>
                                <th class="text-center">이체</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${previewRows.map(row => `
                                <tr>
                                    <td style="white-space:nowrap">${row.date}</td>
                                    <td><span style="display:inline-block;padding:2px 8px;background:#f1f5f9;border-radius:4px;font-size:0.78rem">${row.categoryName || '미분류'}</span></td>
                                    <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtmlStr(row.description)}</td>
                                    <td>${escapeHtmlStr(row.vendor)}</td>
                                    <td>${escapeHtmlStr(row.manager)}</td>
                                    <td class="text-right amount-cell">${Store.formatCurrency(row.amount)}</td>
                                    <td class="text-center">${row.transferred ? '✅' : ''}</td>
                                </tr>
                            `).join('')}
                            ${parsed.length > 8 ? `<tr><td colspan="7" style="text-align:center;color:var(--text-muted);font-size:0.85rem">... 외 ${parsed.length - 8}건</td></tr>` : ''}
                        </tbody>
                    </table>
                </div>
                <div class="preview-summary">
                    <span>✅ 총 <strong>${parsed.length}건</strong></span>
                    <span>💰 합계 <strong>${Store.formatCurrency(parsed.reduce((s, r) => s + r.amount, 0))}원</strong></span>
                </div>`;
        }

        function parseRCMSData(data, mapping) {
            const results = [];

            for (const row of data) {
                // Get date
                let date = '';
                if (mapping.date !== undefined) {
                    date = parseExcelDate(row[mapping.date]);
                }
                if (!date) continue;

                // Get amount
                let amount = 0;
                if (mapping.amount !== undefined) {
                    amount = parseAmount(row[mapping.amount]);
                } else if (mapping.supply !== undefined) {
                    // Fallback: supply + vat
                    amount = parseAmount(row[mapping.supply]);
                    if (mapping.vat !== undefined) {
                        amount += parseAmount(row[mapping.vat]);
                    }
                }
                if (!amount || amount === 0) continue;

                // Get description
                let description = '';
                if (mapping.description !== undefined) {
                    description = String(row[mapping.description] || '').trim();
                }
                if (!description) description = '(내역 없음)';

                // Get category
                let categoryName = '';
                if (mapping.category !== undefined) {
                    categoryName = String(row[mapping.category] || '').trim();
                }
                if (mapping.subCategory !== undefined) {
                    const sub = String(row[mapping.subCategory] || '').trim();
                    if (sub && categoryName) {
                        categoryName = `${categoryName}/${sub}`;
                    } else if (sub) {
                        categoryName = sub;
                    }
                }

                // Other fields
                let vendor = '';
                if (mapping.vendor !== undefined) vendor = String(row[mapping.vendor] || '').trim();

                let manager = '';
                if (mapping.manager !== undefined) manager = String(row[mapping.manager] || '').trim();

                let invoiceNo = '';
                if (mapping.invoiceNo !== undefined) invoiceNo = String(row[mapping.invoiceNo] || '').trim();

                let transferred = false;
                if (mapping.transferred !== undefined) {
                    const val = String(row[mapping.transferred] || '').trim().toUpperCase();
                    transferred = ['O', 'Y', '완료', '이체완료', 'YES', '1'].includes(val);
                }

                results.push({ date, categoryName, description, vendor, manager, invoiceNo, amount, transferred });
            }

            return results;
        }

        function parseExcelDate(val) {
            if (!val && val !== 0) return '';

            // If it's a Date object (from SheetJS cellDates option)
            if (val instanceof Date) {
                const y = val.getFullYear();
                const m = String(val.getMonth() + 1).padStart(2, '0');
                const d = String(val.getDate()).padStart(2, '0');
                return `${y}-${m}-${d}`;
            }

            const str = String(val).trim();

            // Excel serial number
            if (/^\d{5}$/.test(str)) {
                const excelEpoch = new Date(1899, 11, 30);
                const date = new Date(excelEpoch.getTime() + parseInt(str) * 86400000);
                const y = date.getFullYear();
                const m = String(date.getMonth() + 1).padStart(2, '0');
                const d = String(date.getDate()).padStart(2, '0');
                return `${y}-${m}-${d}`;
            }

            // Various date formats
            const patterns = [
                /^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/,        // 2024-01-15, 2024/01/15, 2024.01.15
                /^(\d{4})(\d{2})(\d{2})$/,                        // 20240115
            ];

            for (const pattern of patterns) {
                const match = str.match(pattern);
                if (match) {
                    return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
                }
            }

            return '';
        }

        function parseAmount(val) {
            if (!val && val !== 0) return 0;
            if (typeof val === 'number') return Math.round(Math.abs(val));
            const cleaned = String(val).replace(/[^0-9.-]/g, '');
            return Math.abs(parseInt(cleaned)) || 0;
        }

        function getColumnLetter(idx) {
            let letter = '';
            idx++;
            while (idx > 0) {
                idx--;
                letter = String.fromCharCode(65 + (idx % 26)) + letter;
                idx = Math.floor(idx / 26);
            }
            return letter;
        }

        function escapeHtmlStr(str) {
            if (!str) return '';
            const div = document.createElement('div');
            div.textContent = str;
            return div.innerHTML;
        }

        // ── Import Button Handler ────────────────────────────

        document.getElementById('btn-rcms-import').addEventListener('click', () => {
            if (!sheetData || !columnMapping) return;

            const parsed = parseRCMSData(sheetData, columnMapping);
            if (parsed.length === 0) {
                App.showToast('가져올 데이터가 없습니다', 'error');
                return;
            }

            const categories = Store.getCategories();
            const groups = Store.getCategoryGroups();
            let imported = 0;
            let newCats = 0;
            let newGroups = 0;
            const groupCache = {};
            const catCache = {};

            // Build cache for quick lookup
            groups.forEach(g => { groupCache[g.name.toLowerCase()] = g; });
            categories.forEach(c => {
                const groupName = c.groupId ? (groups.find(g => g.id === c.groupId)?.name || '') : '';
                const key = `${groupName.toLowerCase()}::${c.name.toLowerCase()}`;
                catCache[key] = c.id;
            });

            parsed.forEach(row => {
                let categoryId = null;
                let groupName = '';
                let catName = row.categoryName || '미분류';

                // If RCMS category name contains slash, split it (e.g. 직접비/연구재료비)
                if (row.categoryName && row.categoryName.includes('/')) {
                    const parts = row.categoryName.split('/');
                    groupName = parts[0].trim();
                    catName = parts[1].trim();
                }

                // 1. Resolve Category Group (구분)
                let group = null;
                if (groupName) {
                    const gKey = groupName.toLowerCase();
                    if (groupCache[gKey]) {
                        group = groupCache[gKey];
                    } else {
                        // Create group
                        group = Store.addCategoryGroup({ name: groupName });
                        groupCache[gKey] = group;
                        newGroups++;
                    }
                }

                // 2. Resolve Category (내역)
                const cKey = `${(group ? group.name : '').toLowerCase()}::${catName.toLowerCase()}`;
                if (catCache[cKey]) {
                    categoryId = catCache[cKey];
                } else {
                    // Try to find a partial match within categories under the group
                    const matchingCat = categories.find(c =>
                        (group ? c.groupId === group.id : !c.groupId) &&
                        (c.name.toLowerCase().includes(catName.toLowerCase()) || catName.toLowerCase().includes(c.name.toLowerCase()))
                    );

                    if (matchingCat) {
                        categoryId = matchingCat.id;
                        catCache[cKey] = matchingCat.id;
                    } else {
                        // Create new category
                        const newCat = Store.addCategory({
                            name: catName,
                            budget: 0,
                            groupId: group ? group.id : null
                        });
                        categoryId = newCat.id;
                        catCache[cKey] = newCat.id;
                        // Reload categories in cache so subsequent lookups find it
                        categories.push(newCat);
                        newCats++;
                    }
                }

                Store.addExpense({
                    date: row.date,
                    categoryId: categoryId,
                    description: row.description,
                    invoiceNo: row.invoiceNo,
                    vendor: row.vendor,
                    manager: row.manager,
                    amount: row.amount,
                    transferred: row.transferred
                });
                imported++;
            });

            App.closeModal();

            let msg = `✅ ${imported}건 가져오기 완료!`;
            if (newGroups > 0 || newCats > 0) {
                msg += ` (`;
                if (newGroups > 0) msg += `새 구분 ${newGroups}개 `;
                if (newCats > 0) msg += `새 내역 ${newCats}개`;
                msg += ` 자동 생성)`;
            }
            App.showToast(msg, 'success');

            // Navigate to expenses tab to show imported data
            Expenses.resetFilters();
            App.navigateTo('expenses');
        });

        document.getElementById('modal-cancel').addEventListener('click', App.closeModal);
        document.getElementById('modal-close').addEventListener('click', App.closeModal);
    }

    // ── Helpers ──────────────────────────────────────────────

    function getDateStr() {
        const now = new Date();
        return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    }

    function downloadCSV(content, filename) {
        const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }

    // ── Image Budget OCR Upload ──────────────────────────────

    function showImageBudgetModal() {
        const project = Store.getCurrentProject();
        if (!project) {
            App.showToast('먼저 과제를 선택하세요', 'error');
            return;
        }

        const html = `
        <div class="modal__header">
            <h3 class="modal__title">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                예산 이미지 업로드 (OCR)
            </h3>
            <button class="modal__close" id="modal-close">&times;</button>
        </div>
        <div class="modal__body">
            <div class="rcms-info-box" style="border-color:#bfdbfe;background:linear-gradient(135deg, rgba(59, 130, 246, 0.03), rgba(139, 92, 246, 0.03))">
                <strong>📌 사용법</strong>
                <ol>
                    <li>예산 내역이 적힌 이미지 파일(.png, .jpg, .jpeg)을 준비하세요.</li>
                    <li>예산 표의 캡처본을 클립보드에 복사(Ctrl+C)한 상태에서 아래 영역에 **Ctrl+V로 붙여넣기** 하거나 파일을 선택하세요.</li>
                    <li>최초 실행 시 한국어 분석용 언어팩 다운로드로 인해 **10~20초** 소요될 수 있습니다.</li>
                </ol>
            </div>
            <div class="drop-zone" id="image-drop-zone" style="margin-bottom:16px">
                <div class="drop-zone__icon">🖼️</div>
                <div class="drop-zone__text">이미지 파일을 드래그하거나 클릭하여 선택 (또는 Ctrl+V로 붙여넣기)</div>
                <div class="drop-zone__hint">.png · .jpg · .jpeg 지원</div>
                <input type="file" accept="image/*" id="image-file-input" style="display:none">
            </div>
            <div id="image-preview-box" class="hidden" style="margin-bottom:16px;text-align:center">
                <img id="image-preview" src="" style="max-width:100%;max-height:180px;border:1px solid var(--border-color);border-radius:var(--radius-sm)">
            </div>
            <div id="ocr-progress-box" class="hidden" style="margin-bottom:16px">
                <div style="display:flex;justify-content:space-between;font-size:0.82rem;margin-bottom:6px">
                    <span id="ocr-status-text">이미지 인식 준비 중...</span>
                    <span id="ocr-progress-pct" style="font-weight:700">0%</span>
                </div>
                <div class="progress-bar" style="height:8px;background:#e2e8f0;border-radius:99px;overflow:hidden">
                    <div class="progress-bar__fill" id="ocr-progress-bar" style="width:0%;height:100%;background:var(--primary);transition:width 0.2s"></div>
                </div>
            </div>
            <div id="ocr-result-section" class="hidden"></div>
        </div>
        <div class="modal__footer">
            <button class="btn btn--ghost" id="modal-cancel">취소</button>
            <button class="btn btn--primary hidden" id="btn-apply-image-budget">
                예산 반영하기
            </button>
        </div>`;

        App.showModal(html);

        // Make modal wider for edit table
        const modal = document.getElementById('modal-container');
        modal.style.maxWidth = '820px';

        const dropZone = document.getElementById('image-drop-zone');
        const fileInput = document.getElementById('image-file-input');

        dropZone.addEventListener('click', () => fileInput.click());
        dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
        dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            if (e.dataTransfer.files.length) handleImageFile(e.dataTransfer.files[0]);
        });
        fileInput.addEventListener('change', () => {
            if (fileInput.files.length) handleImageFile(fileInput.files[0]);
        });

        // Paste from clipboard (Ctrl+V)
        window.addEventListener('paste', handleClipboardPaste);

        function handleClipboardPaste(e) {
            const items = (e.clipboardData || e.originalEvent.clipboardData).items;
            for (const item of items) {
                if (item.type.indexOf('image') === 0) {
                    const blob = item.getAsFile();
                    handleImageFile(blob);
                    break;
                }
            }
        }

        function cleanup() {
            window.removeEventListener('paste', handleClipboardPaste);
            App.closeModal();
        }

        document.getElementById('modal-cancel').addEventListener('click', cleanup);
        document.getElementById('modal-close').addEventListener('click', cleanup);

        function handleImageFile(file) {
            if (!file.type.startsWith('image/')) {
                App.showToast('이미지 파일만 지원됩니다', 'error');
                return;
            }

            dropZone.style.display = 'none';
            const previewBox = document.getElementById('image-preview-box');
            const previewImg = document.getElementById('image-preview');
            previewBox.classList.remove('hidden');

            const reader = new FileReader();
            reader.onload = (e) => {
                previewImg.src = e.target.result;
                runOCR(e.target.result);
            };
            reader.readAsDataURL(file);
        }

        function runOCR(imageSrc) {
            const progressBox = document.getElementById('ocr-progress-box');
            const statusText = document.getElementById('ocr-status-text');
            const progressPct = document.getElementById('ocr-progress-pct');
            const progressBar = document.getElementById('ocr-progress-bar');
            progressBox.classList.remove('hidden');

            statusText.textContent = 'OCR 모듈 로딩 중...';
            progressBar.style.width = '0%';
            progressPct.textContent = '0%';

            Tesseract.recognize(
                imageSrc,
                'kor+eng',
                {
                    logger: m => {
                        if (m.status === 'recognizing text') {
                            const pct = Math.round(m.progress * 100);
                            statusText.textContent = '이미지 텍스트 분석 중...';
                            progressBar.style.width = `${pct}%`;
                            progressPct.textContent = `${pct}%`;
                        } else if (m.status === 'loading language traineddata') {
                            statusText.textContent = '한국어 분석 데이터 다운로드 중 (최초 1회)...';
                            const pct = Math.round(m.progress * 100);
                            progressBar.style.width = `${pct}%`;
                            progressPct.textContent = `${pct}%`;
                        } else {
                            statusText.textContent = '분석 엔진 준비 중...';
                        }
                    }
                }
            ).then(({ data: { text } }) => {
                progressBox.classList.add('hidden');
                const parsedRows = parseOCRText(text);
                renderOCRResults(parsedRows);
            }).catch(err => {
                console.error(err);
                statusText.textContent = '오류 발생: ' + err.message;
                App.showToast('텍스트 추출 중 오류가 발생했습니다: ' + err.message, 'error');
            });
        }

        function parseOCRText(text) {
            const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
            const results = [];
            let currentGroup = '';

            const knownGroupNames = ['직접비', '연구활동비', '기타경비', '위탁연구비', '간접비', '재료비', '재료비-제작비', '재료비-재료구입비', '연구수당'];

            for (let line of lines) {
                if (line.includes('비 목') || line.includes('비목') || line.includes('산출근거') || line.includes('지원금') || line.includes('합 계') || line.includes('합계') || line.includes('합  계')) {
                    continue;
                }

                const cleanLine = line.replace(/[\s\-\_\:\=\/]/g, '');
                const matchedGroup = knownGroupNames.find(g => {
                    const cleanG = g.replace(/[\s\-\_\:\=\/]/g, '');
                    return cleanLine === cleanG || cleanLine.includes(cleanG);
                });

                if (matchedGroup && !line.match(/\d/)) {
                    currentGroup = matchedGroup;
                    continue;
                }

                // Match name and currency-like number at the end, supporting commas or periods as separators
                const match = line.match(/^(.+?)\s+([\d,\.]{4,15})\s*원?$/);
                if (match) {
                    const name = match[1].trim();
                    const amountStr = match[2].replace(/[,\.]/g, '');
                    const amount = parseInt(amountStr) || 0;

                    if (name && amount > 0) {
                        results.push({
                            groupName: currentGroup || '직접비',
                            categoryName: name,
                            budget: amount
                        });
                    }
                }
            }
            return results;
        }

        function renderOCRResults(rows) {
            const resultSection = document.getElementById('ocr-result-section');
            resultSection.classList.remove('hidden');

            const groups = Store.getCategoryGroups();
            if (groups.length === 0) {
                // If no groups exist, create a default one
                Store.addCategoryGroup({ name: '직접비' });
            }
            const currentGroups = Store.getCategoryGroups();

            const tableRows = rows.map((row, idx) => {
                const matchedGroup = currentGroups.find(g =>
                    g.name.toLowerCase().includes(row.groupName.toLowerCase()) ||
                    row.groupName.toLowerCase().includes(g.name.toLowerCase())
                );
                const groupId = matchedGroup ? matchedGroup.id : (currentGroups[0]?.id || '');

                return `
                <tr class="ocr-edit-row" data-idx="${idx}">
                    <td>
                        <select class="form-select ocr-group-select" style="padding:5px 8px;font-size:0.82rem;height:32px">
                            ${currentGroups.map(g => `<option value="${g.id}" ${g.id === groupId ? 'selected' : ''}>${g.name}</option>`).join('')}
                            <option value="NEW_GROUP">+ 새 구분 추가</option>
                        </select>
                    </td>
                    <td>
                        <input type="text" class="form-input ocr-cat-name-input" value="${escapeHtmlStr(row.categoryName)}" style="padding:5px 8px;font-size:0.82rem;height:32px">
                    </td>
                    <td>
                        <input type="text" class="form-input ocr-budget-input text-right" value="${Store.formatCurrency(row.budget)}" style="padding:5px 8px;font-size:0.82rem;height:32px;font-variant-numeric:tabular-nums">
                    </td>
                    <td class="text-center">
                        <button class="btn btn--sm btn--danger-ghost btn-remove-ocr-row" data-idx="${idx}" style="padding:2px 8px;font-size:1.1rem">&times;</button>
                    </td>
                </tr>`;
            }).join('');

            resultSection.innerHTML = `
                <div style="display:flex;align-items:center;justify-content:space-between;margin:16px 0 8px">
                    <h4 style="font-size:0.92rem;font-weight:700">📋 예산 추출 결과 (${rows.length}건)</h4>
                    <span style="font-size:0.75rem;color:var(--text-muted)">💡 틀린 금액이나 명칭은 직접 수정한 뒤 저장할 수 있습니다.</span>
                </div>
                <div class="import-preview" style="max-height:280px;overflow-y:auto;border:1px solid var(--border-color);border-radius:var(--radius-sm)">
                    <table class="data-table" id="ocr-table">
                        <thead>
                            <tr>
                                <th style="width:160px">구분 (대분류)</th>
                                <th>내역 (세부항목)</th>
                                <th class="text-right" style="width:150px">배정예산 (원)</th>
                                <th class="text-center" style="width:50px">삭제</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${tableRows}
                        </tbody>
                    </table>
                </div>
                <div style="margin-top:8px;display:flex;gap:8px">
                    <button class="btn btn--sm btn--ghost" id="btn-add-ocr-row">+ 행 추가</button>
                </div>
            `;

            document.getElementById('btn-apply-image-budget').classList.remove('hidden');

            // Bind number formatting
            resultSection.querySelectorAll('.ocr-budget-input').forEach(input => {
                input.addEventListener('input', () => {
                    const raw = input.value.replace(/[^0-9]/g, '');
                    if (raw) input.value = Store.formatCurrency(parseInt(raw));
                });
            });

            // Bind group change
            resultSection.querySelectorAll('.ocr-group-select').forEach(select => {
                select.addEventListener('change', (e) => {
                    if (e.target.value === 'NEW_GROUP') {
                        const newName = prompt('추가할 새 구분명을 입력하세요:');
                        if (newName && newName.trim()) {
                            const newGroup = Store.addCategoryGroup({ name: newName.trim() });
                            const freshGroups = Store.getCategoryGroups();
                            resultSection.querySelectorAll('.ocr-group-select').forEach(sel => {
                                const currentVal = sel.value;
                                sel.innerHTML = freshGroups.map(g => `<option value="${g.id}">${g.name}</option>`).join('') + '<option value="NEW_GROUP">+ 새 구분 추가</option>';
                                sel.value = (sel === e.target) ? newGroup.id : currentVal;
                            });
                        } else {
                            select.value = currentGroups[0]?.id || '';
                        }
                    }
                });
            });

            // Bind delete row
            resultSection.querySelectorAll('.btn-remove-ocr-row').forEach(btn => {
                btn.addEventListener('click', () => {
                    const idx = parseInt(btn.dataset.idx);
                    rows.splice(idx, 1);
                    renderOCRResults(rows);
                });
            });

            // Bind add row
            document.getElementById('btn-add-ocr-row').addEventListener('click', () => {
                rows.push({
                    groupName: currentGroups[0]?.name || '직접비',
                    categoryName: '',
                    budget: 0
                });
                renderOCRResults(rows);
            });
        }

        // Apply to budget button handler
        document.getElementById('btn-apply-image-budget').addEventListener('click', () => {
            const table = document.getElementById('ocr-table');
            if (!table) return;

            const tableRows = table.querySelectorAll('tbody tr');
            const categories = Store.getCategories();
            let updatedCount = 0;
            let createdCount = 0;

            tableRows.forEach(tr => {
                const groupId = tr.querySelector('.ocr-group-select').value;
                const catName = tr.querySelector('.ocr-cat-name-input').value.trim();
                const budgetRaw = tr.querySelector('.ocr-budget-input').value.replace(/[^0-9]/g, '');
                const budget = parseInt(budgetRaw) || 0;

                if (!catName || groupId === 'NEW_GROUP') return;

                let cat = categories.find(c =>
                    c.groupId === groupId &&
                    c.name.toLowerCase() === catName.toLowerCase()
                );

                if (cat) {
                    Store.updateCategoryBudget(cat.id, budget);
                    updatedCount++;
                } else {
                    Store.addCategory({
                        name: catName,
                        budget: budget,
                        groupId: groupId
                    });
                    createdCount++;
                }
            });

            cleanup();
            App.refresh();
            App.showToast(`✅ 예산 반영 완료! (기존 내역 수정 ${updatedCount}건, 새 내역 추가 ${createdCount}건)`, 'success');
        });
    }

    function escapeHtmlStr(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    return {
        exportDashboard,
        exportExpenses,
        showImportModal,
        backupData,
        showRestoreModal,
        showRCMSImportModal,
        showImageBudgetModal
    };
})();

