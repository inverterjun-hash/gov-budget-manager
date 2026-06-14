// ═══════════════════════════════════════════════════════════════
// Government Project Budget Manager - Data Store
// Handles persistence, CRUD, calculations, and formatting
// ═══════════════════════════════════════════════════════════════

const Store = (() => {
    const STORAGE_KEY = 'gov_budget_manager';

    const DEFAULT_GROUPS = [
        { name: '직접비', items: ['연구재료비', '연구재료제작비', '지식재산 창출 활동비', '외부 전문기술 활용비'] },
        { name: '연구활동비', items: ['회의비', '출장비', '연구인력지원비'] },
        { name: '기타경비', items: ['기타비용', '연구수당'] },
        { name: '위탁연구비', items: ['공동연구개발기관'] },
        { name: '간접비', items: ['간접비'] }
    ];

    let data = {
        projects: [],
        categoryGroups: [],
        categories: [],
        expenses: [],
        currentProjectId: null,
        currentYearId: null,
        isLocked: true,
        password: '1234',
        gdriveClientId: '',
        gdriveFileId: '',
        lastSyncTime: ''
    };

    // ── Persistence ──────────────────────────────────────────────

    function save() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
            if (typeof GDrive !== 'undefined' && GDrive.autoUpload) {
                GDrive.autoUpload();
            }
        } catch (e) {
            console.error('저장 실패:', e);
        }
    }

    function load() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                data = JSON.parse(raw);
                if (!data.categoryGroups) data.categoryGroups = [];
                data.isLocked = true; // 보안을 위해 프로그램 구동 시 항상 잠금 상태로 설정
                if (data.password === undefined) data.password = '1234';
                if (data.gdriveClientId === undefined) data.gdriveClientId = '';
                if (data.gdriveFileId === undefined) data.gdriveFileId = '';
                if (data.lastSyncTime === undefined) data.lastSyncTime = '';
                return true;
            }
        } catch (e) {
            console.error('로드 실패:', e);
        }
        return false;
    }

    // ── ID Generator ─────────────────────────────────────────────

    function generateId(prefix = 'id') {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    }

    // ── Projects ─────────────────────────────────────────────────

    function getProjects() {
        return data.projects;
    }

    function getProject(id) {
        return data.projects.find(p => p.id === id);
    }

    function getCurrentProject() {
        return getProject(data.currentProjectId);
    }

    function getCurrentProjectId() {
        return data.currentProjectId;
    }

    function getCurrentYearId() {
        return data.currentYearId;
    }

    function setCurrentProject(projectId) {
        data.currentProjectId = projectId;
        const project = getProject(projectId);
        if (project && project.years.length > 0) {
            data.currentYearId = project.years[0].id;
        } else {
            data.currentYearId = null;
        }
        save();
    }

    function setCurrentYear(yearId) {
        data.currentYearId = yearId;
        save();
    }

    function addProject(projectData) {
        const project = {
            id: generateId('proj'),
            name: projectData.name || '새 과제',
            institution: projectData.institution || '',
            startDate: projectData.startDate || '',
            endDate: projectData.endDate || '',
            years: projectData.years || [],
            createdAt: new Date().toISOString()
        };

        // Ensure years have IDs
        project.years.forEach((y, i) => {
            if (!y.id) y.id = generateId('year');
            if (!y.label) y.label = `${i + 1}차년도`;
        });

        data.projects.push(project);

        // Create default groups and categories for each year
        if (projectData.createDefaultCategories !== false) {
            project.years.forEach(year => {
                let catOrder = 1;
                DEFAULT_GROUPS.forEach((grp, gIdx) => {
                    const group = {
                        id: generateId('grp'),
                        projectId: project.id,
                        yearId: year.id,
                        name: grp.name,
                        order: gIdx + 1
                    };
                    data.categoryGroups.push(group);

                    grp.items.forEach(itemName => {
                        data.categories.push({
                            id: generateId('cat'),
                            projectId: project.id,
                            yearId: year.id,
                            groupId: group.id,
                            name: itemName,
                            budget: 0,
                            memo: '',
                            order: catOrder++
                        });
                    });
                });
            });
        }

        // Set as current if none selected
        if (!data.currentProjectId) {
            data.currentProjectId = project.id;
            data.currentYearId = project.years[0]?.id || null;
        }

        save();
        return project;
    }

    function updateProject(id, updates) {
        const project = getProject(id);
        if (!project) return null;
        Object.assign(project, updates);
        save();
        return project;
    }

    function deleteProject(id) {
        data.projects = data.projects.filter(p => p.id !== id);
        data.categoryGroups = data.categoryGroups.filter(g => g.projectId !== id);
        data.categories = data.categories.filter(c => c.projectId !== id);
        data.expenses = data.expenses.filter(e => e.projectId !== id);
        if (data.currentProjectId === id) {
            data.currentProjectId = data.projects[0]?.id || null;
            const newProj = getCurrentProject();
            data.currentYearId = newProj?.years[0]?.id || null;
        }
        save();
    }

    function addYearToProject(projectId, yearData) {
        const project = getProject(projectId);
        if (!project) return null;
        const year = {
            id: generateId('year'),
            label: yearData.label || `${project.years.length + 1}차년도`,
            startDate: yearData.startDate || '',
            endDate: yearData.endDate || ''
        };
        project.years.push(year);

        // Create default groups and categories for new year
        let catOrder = 1;
        DEFAULT_GROUPS.forEach((grp, gIdx) => {
            const group = {
                id: generateId('grp'),
                projectId: project.id,
                yearId: year.id,
                name: grp.name,
                order: gIdx + 1
            };
            data.categoryGroups.push(group);

            grp.items.forEach(itemName => {
                data.categories.push({
                    id: generateId('cat'),
                    projectId: project.id,
                    yearId: year.id,
                    groupId: group.id,
                    name: itemName,
                    budget: 0,
                    memo: '',
                    order: catOrder++
                });
            });
        });

        save();
        return year;
    }

    function removeYearFromProject(projectId, yearId) {
        const project = getProject(projectId);
        if (!project) return;
        project.years = project.years.filter(y => y.id !== yearId);
        data.categoryGroups = data.categoryGroups.filter(
            g => !(g.projectId === projectId && g.yearId === yearId)
        );
        data.categories = data.categories.filter(
            c => !(c.projectId === projectId && c.yearId === yearId)
        );
        data.expenses = data.expenses.filter(
            e => !(e.projectId === projectId && e.yearId === yearId)
        );
        if (data.currentYearId === yearId) {
            data.currentYearId = project.years[0]?.id || null;
        }
        save();
    }

    // ── Categories ───────────────────────────────────────────────

    function getCategories(projectId, yearId) {
        const pid = projectId || data.currentProjectId;
        const yid = yearId || data.currentYearId;
        return data.categories
            .filter(c => c.projectId === pid && c.yearId === yid)
            .sort((a, b) => a.order - b.order);
    }

    function getCategory(id) {
        return data.categories.find(c => c.id === id);
    }

    // ── Category Groups (구분) ────────────────────────────────────

    function getCategoryGroups(projectId, yearId) {
        const pid = projectId || data.currentProjectId;
        const yid = yearId || data.currentYearId;
        return data.categoryGroups
            .filter(g => g.projectId === pid && g.yearId === yid)
            .sort((a, b) => a.order - b.order);
    }

    function getCategoryGroup(id) {
        return data.categoryGroups.find(g => g.id === id);
    }

    function addCategoryGroup(groupData) {
        const existing = getCategoryGroups(
            groupData.projectId || data.currentProjectId,
            groupData.yearId || data.currentYearId
        );
        const group = {
            id: generateId('grp'),
            projectId: groupData.projectId || data.currentProjectId,
            yearId: groupData.yearId || data.currentYearId,
            name: groupData.name,
            order: groupData.order || existing.length + 1
        };
        data.categoryGroups.push(group);
        save();
        return group;
    }

    function deleteCategoryGroup(id) {
        // Delete all categories in this group and their expenses
        const catsInGroup = data.categories.filter(c => c.groupId === id);
        catsInGroup.forEach(cat => {
            data.expenses = data.expenses.filter(e => e.categoryId !== cat.id);
        });
        data.categories = data.categories.filter(c => c.groupId !== id);
        data.categoryGroups = data.categoryGroups.filter(g => g.id !== id);
        save();
    }

    function getCategoriesByGroup(groupId) {
        return data.categories
            .filter(c => c.groupId === groupId)
            .sort((a, b) => a.order - b.order);
    }

    function updateCategoryGroup(id, updates) {
        const group = data.categoryGroups.find(g => g.id === id);
        if (!group) return null;

        Object.assign(group, updates);

        save();
        return group;
    }

    function addCategory(catData) {
        const existing = getCategories(
            catData.projectId || data.currentProjectId,
            catData.yearId || data.currentYearId
        );
        const cat = {
            id: generateId('cat'),
            projectId: catData.projectId || data.currentProjectId,
            yearId: catData.yearId || data.currentYearId,
            groupId: catData.groupId || null,
            name: catData.name,
            budget: Number(catData.budget) || 0,
            memo: catData.memo || '',
            order: catData.order || existing.length + 1
        };
        data.categories.push(cat);
        save();
        return cat;
    }

    function updateCategory(id, updates) {
        const cat = data.categories.find(c => c.id === id);
        if (!cat) return null;
        Object.assign(cat, updates);
        if (updates.budget !== undefined) cat.budget = Number(cat.budget) || 0;
        save();
        return cat;
    }

    function updateCategoryBudget(id, budget) {
        return updateCategory(id, { budget: Number(budget) || 0 });
    }

    function deleteCategory(id) {
        data.expenses = data.expenses.filter(e => e.categoryId !== id);
        data.categories = data.categories.filter(c => c.id !== id);
        save();
    }

    // ── Expenses ─────────────────────────────────────────────────

    function getExpenses(projectId, yearId, filters = {}) {
        const pid = projectId || data.currentProjectId;
        const yid = yearId || data.currentYearId;
        let results = data.expenses.filter(
            e => e.projectId === pid && e.yearId === yid
        );

        if (filters.categoryId) {
            results = results.filter(e => e.categoryId === filters.categoryId);
        }
        if (filters.transferred === true) {
            results = results.filter(e => e.transferred === true);
        } else if (filters.transferred === false) {
            results = results.filter(e => e.transferred === false);
        }
        if (filters.search) {
            const q = filters.search.toLowerCase();
            results = results.filter(e =>
                (e.description || '').toLowerCase().includes(q) ||
                (e.vendor || '').toLowerCase().includes(q) ||
                (e.manager || '').toLowerCase().includes(q) ||
                (e.invoiceNo || '').toLowerCase().includes(q)
            );
        }
        if (filters.startDate) {
            results = results.filter(e => e.date >= filters.startDate);
        }
        if (filters.endDate) {
            results = results.filter(e => e.date <= filters.endDate);
        }

        // Sort by date descending, then by creation
        results.sort((a, b) => {
            const dateCmp = b.date.localeCompare(a.date);
            if (dateCmp !== 0) return dateCmp;
            return (b.createdAt || '').localeCompare(a.createdAt || '');
        });

        return results;
    }

    function getExpense(id) {
        return data.expenses.find(e => e.id === id);
    }

    function addExpense(expData) {
        const expense = {
            id: generateId('exp'),
            projectId: expData.projectId || data.currentProjectId,
            yearId: expData.yearId || data.currentYearId,
            categoryId: expData.categoryId,
            date: expData.date || new Date().toISOString().slice(0, 10),
            description: expData.description || '',
            invoiceNo: expData.invoiceNo || '',
            vendor: expData.vendor || '',
            manager: expData.manager || '',
            amount: Number(expData.amount) || 0,
            transferred: !!expData.transferred,
            createdAt: new Date().toISOString()
        };
        data.expenses.push(expense);
        save();
        return expense;
    }

    function updateExpense(id, updates) {
        const expense = data.expenses.find(e => e.id === id);
        if (!expense) return null;
        if (updates.amount !== undefined) updates.amount = Number(updates.amount) || 0;
        if (updates.transferred !== undefined) updates.transferred = !!updates.transferred;
        Object.assign(expense, updates);
        save();
        return expense;
    }

    function deleteExpense(id) {
        data.expenses = data.expenses.filter(e => e.id !== id);
        save();
    }

    function deleteExpenses(ids) {
        const idSet = new Set(ids);
        data.expenses = data.expenses.filter(e => !idSet.has(e.id));
        save();
    }

    function toggleTransfer(id) {
        const expense = data.expenses.find(e => e.id === id);
        if (!expense) return null;
        expense.transferred = !expense.transferred;
        save();
        return expense.transferred;
    }

    // ── Calculations ─────────────────────────────────────────────

    function getCategorySummary(projectId, yearId) {
        const pid = projectId || data.currentProjectId;
        const yid = yearId || data.currentYearId;
        const cats = getCategories(pid, yid);
        const allExps = data.expenses.filter(
            e => e.projectId === pid && e.yearId === yid && e.transferred
        );

        return cats.map(cat => {
            const used = allExps
                .filter(e => e.categoryId === cat.id)
                .reduce((sum, e) => sum + e.amount, 0);
            const remaining = cat.budget - used;
            const rate = cat.budget > 0 ? (used / cat.budget) * 100 : (used > 0 ? 100 : 0);

            return {
                category: cat,
                groupId: cat.groupId,
                budget: cat.budget,
                used,
                remaining,
                rate: Math.round(rate * 10) / 10,
                color: getExecutionColor(rate),
                status: getExecutionStatus(rate)
            };
        });
    }

    function getTotalSummary(projectId, yearId) {
        const summaries = getCategorySummary(projectId, yearId);
        const totalBudget = summaries.reduce((s, i) => s + i.budget, 0);
        const totalUsed = summaries.reduce((s, i) => s + i.used, 0);
        const totalRemaining = totalBudget - totalUsed;
        const totalRate = totalBudget > 0
            ? Math.round((totalUsed / totalBudget) * 1000) / 10
            : 0;

        const pid = projectId || data.currentProjectId;
        const yid = yearId || data.currentYearId;
        const pendingAmount = data.expenses
            .filter(e => e.projectId === pid && e.yearId === yid && !e.transferred)
            .reduce((sum, e) => sum + e.amount, 0);

        return {
            totalBudget,
            totalUsed,
            totalRemaining,
            totalRate,
            pendingAmount,
            color: getExecutionColor(totalRate),
            status: getExecutionStatus(totalRate)
        };
    }

    // ── Execution Rate Color Palette ─────────────────────────────

    function getExecutionColor(rate) {
        if (rate > 100) return '#ef4444';   // Red - 초과
        if (rate >= 80) return '#f97316';    // Orange - 경고
        if (rate >= 60) return '#f59e0b';    // Amber - 주의
        if (rate >= 30) return '#3b82f6';    // Blue - 정상 진행
        return '#10b981';                    // Emerald - 여유
    }

    function getExecutionStatus(rate) {
        if (rate > 100) return { label: '초과', icon: '⚠️', className: 'status--danger', level: 'danger' };
        if (rate >= 80) return { label: '경고', icon: '🔶', className: 'status--warning', level: 'warning' };
        if (rate >= 60) return { label: '주의', icon: '📋', className: 'status--caution', level: 'caution' };
        if (rate >= 30) return { label: '정상', icon: '✅', className: 'status--normal', level: 'normal' };
        return { label: '정상', icon: '✅', className: 'status--safe', level: 'safe' };
    }

    // ── Formatting ───────────────────────────────────────────────

    function formatCurrency(amount) {
        return new Intl.NumberFormat('ko-KR').format(amount);
    }

    function formatDate(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    // ── Default / Sample Data ────────────────────────────────────

    function initDefaultData() {
        const project = addProject({
            name: '정부과제 샘플 프로젝트',
            institution: '한국연구재단',
            startDate: '2025-03-01',
            endDate: '2027-02-28',
            years: [
                { label: '1차년도', startDate: '2025-03-01', endDate: '2026-02-28' },
                { label: '2차년도', startDate: '2026-03-01', endDate: '2027-02-28' }
            ]
        });

        // Set sample budgets for 1st year
        const year1Cats = getCategories(project.id, project.years[0].id);
        const sampleBudgets = [
            48600000, 33500000, 4000000, 9700000, 7000000,
            6900000, 3000000, 5006000, 3940000, 43500000, 6500000
        ];
        year1Cats.forEach((cat, i) => {
            if (sampleBudgets[i] !== undefined) {
                cat.budget = sampleBudgets[i];
            }
        });

        // Sample expenses for year 1
        const cats = year1Cats;
        const sampleExpenses = [
            { catIdx: 0, date: '2026-06-01', description: '실험 시약 구매', vendor: '○○화학', manager: '김연구', amount: 547200, transferred: true },
            { catIdx: 0, date: '2026-05-21', description: '분석장비 소모품', vendor: '△△사이언스', manager: '이분석', amount: 321114, transferred: true },
            { catIdx: 0, date: '2026-05-15', description: '연구재료 일괄구매', invoiceNo: 'TAX-2026-015', vendor: '□□마트', manager: '박구매', amount: 1280000, transferred: true },
            { catIdx: 0, date: '2026-05-10', description: '실험용 기자재', vendor: '랩장비코리아', manager: '김연구', amount: 2450000, transferred: true },
            { catIdx: 0, date: '2026-04-28', description: '시약 추가 구매', vendor: '○○화학', manager: '이분석', amount: 890000, transferred: true },
            { catIdx: 0, date: '2026-04-15', description: '소모성 자재', vendor: '실험재료몰', manager: '박구매', amount: 1650000, transferred: true },
            { catIdx: 0, date: '2026-03-20', description: '연구재료 초기 구매', invoiceNo: 'TAX-2026-003', vendor: '사이언스다이렉트', manager: '김연구', amount: 3200000, transferred: true },
            { catIdx: 1, date: '2026-05-05', description: '시제품 케이스 제작', vendor: 'CNC가공소', manager: '최제작', amount: 4500000, transferred: true },
            { catIdx: 1, date: '2026-03-25', description: '회로기판 PCB 제작', vendor: 'PCB테크', manager: '최제작', amount: 3800000, transferred: true },
            { catIdx: 1, date: '2026-04-10', description: '3D프린팅 시제품', vendor: '메이커스페이스', manager: '최제작', amount: 2700000, transferred: true },
            { catIdx: 1, date: '2026-02-15', description: '센서모듈 시작품', vendor: '전자부품', manager: '최제작', amount: 2000000, transferred: true },
            { catIdx: 3, date: '2026-04-15', description: '외부 분석 의뢰', vendor: '한국분석센터', manager: '이분석', amount: 1500000, transferred: true },
            { catIdx: 3, date: '2026-03-10', description: 'FEM 시뮬레이션 용역', vendor: 'CAE연구소', manager: '박시뮬', amount: 1856160, transferred: true },
            { catIdx: 4, date: '2026-05-10', description: '연구회의 식대', vendor: '한식당', manager: '총무', amount: 450000, transferred: true },
            { catIdx: 4, date: '2026-04-08', description: '자문위원 회의', vendor: '호텔 레스토랑', manager: '총무', amount: 890000, transferred: true },
            { catIdx: 4, date: '2026-03-05', description: '킥오프 미팅', vendor: '카페', manager: '총무', amount: 320000, transferred: true },
            { catIdx: 4, date: '2026-02-28', description: '월례 연구회의', vendor: '구내식당', manager: '총무', amount: 250000, transferred: true },
            { catIdx: 4, date: '2026-01-20', description: '분기 성과보고 회의', vendor: '레스토랑', manager: '총무', amount: 580000, transferred: true },
            { catIdx: 5, date: '2026-04-20', description: '학회 출장 (서울)', vendor: 'KTX', manager: '김출장', amount: 285000, transferred: true },
            { catIdx: 5, date: '2026-03-15', description: '기관 방문 출장 (대전)', vendor: 'KTX/택시', manager: '이출장', amount: 420000, transferred: true },
            { catIdx: 5, date: '2026-05-22', description: '국제학회 (부산)', vendor: '항공/호텔', manager: '김출장', amount: 1850000, transferred: true },
            { catIdx: 5, date: '2026-02-10', description: '공동연구기관 방문', vendor: 'KTX', manager: '이출장', amount: 180000, transferred: true },
            { catIdx: 6, date: '2026-04-01', description: '연구보조원 인건비 4월', vendor: '', manager: '인사팀', amount: 461546, transferred: true },
            { catIdx: 6, date: '2026-05-01', description: '연구보조원 인건비 5월', vendor: '', manager: '인사팀', amount: 461546, transferred: true },
            { catIdx: 6, date: '2026-06-01', description: '연구보조원 인건비 6월', vendor: '', manager: '인사팀', amount: 461546, transferred: false },
            { catIdx: 7, date: '2026-03-10', description: '사무용품 구매', vendor: '오피스디포', manager: '총무', amount: 350000, transferred: true },
            { catIdx: 7, date: '2026-04-20', description: '문헌 복사비', vendor: '복사실', manager: '총무', amount: 85000, transferred: true },
            { catIdx: 7, date: '2026-05-15', description: '연구노트 구매', vendor: '문구점', manager: '총무', amount: 120000, transferred: true },
            { catIdx: 9, date: '2026-03-15', description: '공동연구기관 1차 지급', vendor: '△△대학교', manager: '공동연구', amount: 15000000, transferred: true },
            { catIdx: 9, date: '2026-06-01', description: '공동연구기관 2차 지급', vendor: '△△대학교', manager: '공동연구', amount: 10469400, transferred: true },
            { catIdx: 3, date: '2026-05-20', description: '특허 분석 컨설팅', vendor: '특허법인', manager: '이특허', amount: 800000, transferred: false },
        ];

        sampleExpenses.forEach(exp => {
            const cat = cats[exp.catIdx];
            if (cat) {
                data.expenses.push({
                    id: generateId('exp'),
                    projectId: project.id,
                    yearId: project.years[0].id,
                    categoryId: cat.id,
                    date: exp.date,
                    description: exp.description,
                    invoiceNo: exp.invoiceNo || '',
                    vendor: exp.vendor,
                    manager: exp.manager,
                    amount: exp.amount,
                    transferred: exp.transferred,
                    createdAt: new Date().toISOString()
                });
            }
        });

        // Set budgets for 2nd year too (smaller amounts as placeholder)
        const year2Cats = getCategories(project.id, project.years[1].id);
        const year2Budgets = [
            30000000, 20000000, 3000000, 8000000, 5000000,
            5000000, 3000000, 4000000, 3940000, 35000000, 5000000
        ];
        year2Cats.forEach((cat, i) => {
            if (year2Budgets[i] !== undefined) cat.budget = year2Budgets[i];
        });

        save();
        setCurrentProject(project.id);
    }

    // ── Reset ────────────────────────────────────────────────────

    function resetAll() {
        data = {
            projects: [], categoryGroups: [], categories: [], expenses: [],
            currentProjectId: null, currentYearId: null
        };
        save();
    }

    function exportData() {
        return JSON.parse(JSON.stringify(data));
    }

    function importData(newData) {
        data = newData;
        if (!data.categoryGroups) data.categoryGroups = [];
        if (data.isLocked === undefined) data.isLocked = true;
        if (data.password === undefined) data.password = '1234';
        save();
    }

    function getDefaultCategories() {
        return [...DEFAULT_CATEGORIES];
    }

    function isLocked() {
        return !!data.isLocked;
    }

    function setLocked(locked) {
        data.isLocked = !!locked;
        save();
    }

    function getGDriveConfig() {
        return {
            clientId: data.gdriveClientId || '',
            fileId: data.gdriveFileId || '',
            lastSyncTime: data.lastSyncTime || ''
        };
    }

    function saveGDriveConfig(clientId, fileId, lastSyncTime = null) {
        if (clientId !== undefined) data.gdriveClientId = clientId;
        if (fileId !== undefined) data.gdriveFileId = fileId;
        if (lastSyncTime !== undefined) data.lastSyncTime = lastSyncTime;
        save();
    }

    function checkPassword(pw) {
        return data.password === pw;
    }

    function changePassword(oldPw, newPw) {
        if (data.password === oldPw) {
            data.password = newPw;
            save();
            return true;
        }
        return false;
    }

    function getIntegratedSummary() {
        const allCategories = data.categories;
        const allExpenses = data.expenses.filter(e => e.transferred);
        const groups = data.categoryGroups;

        // Group by group name
        const groupSummaries = {};

        allCategories.forEach(cat => {
            let groupName = '미분류';
            if (cat.groupId) {
                const grp = groups.find(g => g.id === cat.groupId);
                if (grp) groupName = grp.name;
            }

            if (!groupSummaries[groupName]) {
                groupSummaries[groupName] = {
                    name: groupName,
                    budget: 0,
                    used: 0,
                    remaining: 0,
                    rate: 0
                };
            }

            groupSummaries[groupName].budget += cat.budget || 0;

            const used = allExpenses
                .filter(e => e.categoryId === cat.id)
                .reduce((sum, e) => sum + e.amount, 0);
            
            groupSummaries[groupName].used += used;
        });

        const list = Object.values(groupSummaries);
        list.forEach(item => {
            item.remaining = item.budget - item.used;
            item.rate = item.budget > 0 ? (item.used / item.budget) * 100 : (item.used > 0 ? 100 : 0);
            item.color = getExecutionColor(item.rate);
            item.status = getExecutionStatus(item.rate);
        });

        // Calculate totals
        const totalBudget = list.reduce((s, i) => s + i.budget, 0);
        const totalUsed = list.reduce((s, i) => s + i.used, 0);
        const totalRemaining = totalBudget - totalUsed;
        const totalRate = totalBudget > 0 ? (totalUsed / totalBudget) * 100 : 0;
        
        const pendingAmount = data.expenses
            .filter(e => !e.transferred)
            .reduce((sum, e) => sum + e.amount, 0);

        return {
            groups: list.sort((a, b) => b.budget - a.budget),
            total: {
                totalBudget,
                totalUsed,
                totalRemaining,
                totalRate,
                pendingAmount,
                color: getExecutionColor(totalRate),
                status: getExecutionStatus(totalRate)
            }
        };
    }

    // ── Public API ───────────────────────────────────────────────

    return {
        save, load, generateId,
        getProjects, getProject, getCurrentProject, getCurrentProjectId, getCurrentYearId,
        setCurrentProject, setCurrentYear,
        addProject, updateProject, deleteProject,
        addYearToProject, removeYearFromProject,
        getCategoryGroups, getCategoryGroup, addCategoryGroup, updateCategoryGroup, deleteCategoryGroup, getCategoriesByGroup,
        getCategories, getCategory, addCategory, updateCategory, updateCategoryBudget, deleteCategory,
        getExpenses, getExpense, addExpense, updateExpense, deleteExpense, deleteExpenses, toggleTransfer,
        getCategorySummary, getTotalSummary, getIntegratedSummary,
        getExecutionColor, getExecutionStatus,
        formatCurrency, formatDate,
        initDefaultData, resetAll, exportData, importData, getDefaultCategories,
        isLocked, setLocked, checkPassword, changePassword,
        getGDriveConfig, saveGDriveConfig
    };
})();
