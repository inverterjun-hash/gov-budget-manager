// ═══════════════════════════════════════════════════════════════
// App Module - Initialization, Navigation, Global Events
// ═══════════════════════════════════════════════════════════════

const App = (() => {

    let currentTab = 'dashboard';
    let presenceCheckInterval = null;

    // ── Initialize ───────────────────────────────────────────

    function init() {
        // Load data or create defaults
        if (!Store.load()) {
            Store.initDefaultData();
        }

        // Ensure we have a valid project selected
        if (!Store.getCurrentProject()) {
            const projects = Store.getProjects();
            if (projects.length > 0) {
                Store.setCurrentProject(projects[0].id);
            }
        }

        renderProjectSelector();
        renderYearTabs();
        bindGlobalEvents();
        navigateTo('dashboard');
        updateLockUI();

        // 구글 드라이브 연동 초기화
        if (typeof GDrive !== 'undefined') {
            GDrive.init(updateGDriveUI);
            startPresenceCheck();
        }
    }

    // ── Navigation ───────────────────────────────────────────

    function navigateTo(tab) {
        currentTab = tab;

        // Update nav active state
        document.querySelectorAll('.sidebar__nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.tab === tab);
        });

        // Toggle header visibility based on consolidated view
        const headerLeft = document.querySelector('.header__left');
        const headerYearTabs = document.getElementById('year-tabs');
        if (tab === 'integrated') {
            if (headerLeft) headerLeft.style.visibility = 'hidden';
            if (headerYearTabs) headerYearTabs.style.visibility = 'hidden';
        } else {
            if (headerLeft) headerLeft.style.visibility = 'visible';
            if (headerYearTabs) headerYearTabs.style.visibility = 'visible';
        }

        // Render content
        if (tab === 'dashboard') {
            Dashboard.render();
        } else if (tab === 'integrated') {
            IntegratedDashboard.render();
        } else if (tab === 'expenses') {
            Expenses.render();
        }
        updateLockUI();
    }

    function getCurrentTab() {
        return currentTab;
    }

    function refresh() {
        renderProjectSelector();
        renderYearTabs();
        navigateTo(currentTab);
    }

    // ── Project Selector ─────────────────────────────────────

    function renderProjectSelector() {
        const select = document.getElementById('project-select');
        if (!select) return;

        const projects = Store.getProjects();
        const currentId = Store.getCurrentProjectId();

        if (projects.length === 0) {
            select.innerHTML = '<option value="">과제가 없습니다</option>';
            return;
        }

        select.innerHTML = projects.map(p =>
            `<option value="${p.id}" ${p.id === currentId ? 'selected' : ''}>${p.name}</option>`
        ).join('');
    }

    // ── Year Tabs ────────────────────────────────────────────

    function renderYearTabs() {
        const container = document.getElementById('year-tabs');
        if (!container) return;

        const project = Store.getCurrentProject();
        if (!project || !project.years || project.years.length === 0) {
            container.innerHTML = '<span style="padding:10px;color:var(--text-muted);font-size:0.85rem">연차가 없습니다</span>';
            return;
        }

        const currentYearId = Store.getCurrentYearId();

        container.innerHTML = project.years.map(y =>
            `<button class="year-tab ${y.id === currentYearId ? 'active' : ''}" data-year-id="${y.id}">
                ${y.label}
                ${y.startDate ? `<span style="font-size:0.7rem;color:var(--text-muted);margin-left:4px">(${y.startDate.slice(0, 4)})</span>` : ''}
            </button>`
        ).join('');
    }

    // ── Modal System ─────────────────────────────────────────

    function showModal(html) {
        const overlay = document.getElementById('modal-overlay');
        const container = document.getElementById('modal-container');
        container.innerHTML = html;
        overlay.classList.add('active');

        // Close on overlay click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeModal();
        });

        // Close on Escape
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                closeModal();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);
    }

    function closeModal() {
        const overlay = document.getElementById('modal-overlay');
        overlay.classList.remove('active');
        document.getElementById('modal-container').innerHTML = '';
    }

    // ── Confirm Dialog ───────────────────────────────────────

    function showConfirm(title, message, onConfirm, onCancel) {
        const overlay = document.createElement('div');
        overlay.className = 'confirm-overlay';
        overlay.innerHTML = `
            <div class="confirm-dialog">
                <div class="confirm-dialog__icon">⚠️</div>
                <div class="confirm-dialog__title">${title}</div>
                <div class="confirm-dialog__message">${message.replace(/\n/g, '<br>')}</div>
                <div class="confirm-dialog__actions">
                    <button class="btn btn--ghost" id="confirm-cancel">취소</button>
                    <button class="btn btn--danger" id="confirm-ok">확인</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        overlay.querySelector('#confirm-ok').addEventListener('click', () => {
            overlay.remove();
            if (onConfirm) onConfirm();
        });

        overlay.querySelector('#confirm-cancel').addEventListener('click', () => {
            overlay.remove();
            if (onCancel) onCancel();
        });

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.remove();
                if (onCancel) onCancel();
            }
        });
    }

    // ── Toast Notifications ──────────────────────────────────

    function showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast toast--${type}`;

        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };

        toast.innerHTML = `<span>${icons[type] || icons.info}</span><span>${message}</span>`;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'toastOut 0.3s ease-out forwards';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    function showUnlockModal() {
        const html = `
        <div class="modal__header">
            <h3 class="modal__title">🔑 설정 잠금 해제</h3>
            <button class="modal__close" id="modal-close">&times;</button>
        </div>
        <div class="modal__body">
            <div class="form-group">
                <label class="form-label">관리자 비밀번호</label>
                <input type="password" class="form-input" id="lock-password-input" placeholder="비밀번호를 입력하세요">
                <div class="form-hint" style="color:var(--text-muted);margin-top:6px">기본 비밀번호는 <strong>1234</strong> 입니다.</div>
            </div>
        </div>
        <div class="modal__footer">
            <button class="btn btn--ghost" id="modal-cancel">취소</button>
            <button class="btn btn--primary" id="btn-lock-confirm">확인</button>
        </div>`;

        showModal(html);

        const pwInput = document.getElementById('lock-password-input');
        pwInput.focus();

        function tryUnlock() {
            const pw = pwInput.value;
            if (Store.checkPassword(pw)) {
                Store.setLocked(false);
                closeModal();
                updateLockUI();
                showToast('🔓 설정 잠금이 해제되었습니다.', 'success');
            } else {
                showToast('❌ 비밀번호가 올바르지 않습니다.', 'error');
                pwInput.value = '';
                pwInput.focus();
            }
        }

        document.getElementById('btn-lock-confirm').addEventListener('click', tryUnlock);
        pwInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') tryUnlock();
        });
        document.getElementById('modal-cancel').addEventListener('click', closeModal);
        document.getElementById('modal-close').addEventListener('click', closeModal);
    }

    function updateLockUI() {
        const locked = Store.isLocked();
        const body = document.body;
        const lockBtn = document.getElementById('btn-toggle-lock');

        if (locked) {
            body.classList.add('is-locked');
        } else {
            body.classList.remove('is-locked');
        }

        if (lockBtn) {
            lockBtn.innerHTML = locked
                ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right:6px"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> <span>🔒 설정 잠김</span>`
                : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right:6px"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg> <span>🔓 잠금 해제됨</span>`;
        }

        const isLoggedIn = typeof GDrive !== 'undefined' && GDrive.isLoggedIn && GDrive.isLoggedIn();

        const configButtonIds = [
            'btn-add-project', 'btn-edit-project', 'btn-delete-project',
            'btn-rcms-upload', 'btn-image-budget', 'btn-import', 'btn-restore'
        ];

        configButtonIds.forEach(id => {
            const btn = document.getElementById(id);
            if (btn) {
                // 구글 로그인이 안 되어 있거나 설정이 잠겨 있으면 비활성화
                btn.disabled = locked || !isLoggedIn;
            }
        });

        // 구글 설정 기어 아이콘은 로그인 여부와 관계없이 설정 잠금만 확인
        const gdriveConfigBtn = document.getElementById('btn-gdrive-config');
        if (gdriveConfigBtn) {
            gdriveConfigBtn.disabled = locked;
        }
    }

    // ── Google Drive UI & Modals ──────────────────────────────

    function updateGDriveUI(state, message, userInfo) {
        const statusText = document.getElementById('gdrive-status-text');
        const noIdState = document.getElementById('gdrive-noid-state');
        const loggedOutState = document.getElementById('gdrive-loggedout-state');
        const loggedInState = document.getElementById('gdrive-loggedin-state');
        const userEmail = document.getElementById('gdrive-user-email');

        if (!statusText) return;

        // Reset classes
        statusText.className = 'gdrive-status';

        if (state === 'no_client_id') {
            statusText.textContent = '클라이언트 ID 미설정';
            statusText.classList.add('text-muted');
            if (noIdState) noIdState.style.display = 'block';
            if (loggedOutState) loggedOutState.style.display = 'none';
            if (loggedInState) loggedInState.style.display = 'none';
        } else if (state === 'logged_out') {
            statusText.textContent = '로그인 대기 중';
            statusText.classList.add('text-muted');
            if (noIdState) noIdState.style.display = 'none';
            if (loggedOutState) loggedOutState.style.display = 'block';
            if (loggedInState) loggedInState.style.display = 'none';
        } else if (state === 'syncing') {
            statusText.textContent = message || '동기화 진행 중...';
            statusText.classList.add('syncing');
            if (noIdState) noIdState.style.display = 'none';
            if (loggedOutState) loggedOutState.style.display = 'none';
            if (loggedInState) loggedInState.style.display = 'block';
            if (userEmail && userInfo) userEmail.textContent = userInfo.email;
        } else if (state === 'success') {
            statusText.textContent = message || '동기화 완료';
            statusText.classList.add('success');
            if (noIdState) noIdState.style.display = 'none';
            if (loggedOutState) loggedOutState.style.display = 'none';
            if (loggedInState) loggedInState.style.display = 'block';
            if (userEmail && userInfo) userEmail.textContent = userInfo.email;

            // 동기화 완료 시 상단 경고 배너 숨김
            const banner = document.getElementById('sync-warning-banner');
            if (banner) banner.style.display = 'none';
        } else if (state === 'logged_in') {
            statusText.textContent = '구글 로그인 완료';
            statusText.classList.add('success');
            if (noIdState) noIdState.style.display = 'none';
            if (loggedOutState) loggedOutState.style.display = 'none';
            if (loggedInState) loggedInState.style.display = 'block';
            if (userEmail && userInfo) userEmail.textContent = userInfo.email;
        } else if (state === 'error') {
            statusText.textContent = message || '에러 발생';
            statusText.classList.add('error');
            
            // DEFAULT_CLIENT_ID가 항상 존재하므로 절대 noid-state를 보여주지 않음
            // 로그인 여부에 따라 적절한 상태 표시
            if (noIdState) noIdState.style.display = 'none';
            if (GDrive.isLoggedIn && GDrive.isLoggedIn()) {
                if (loggedOutState) loggedOutState.style.display = 'none';
                if (loggedInState) loggedInState.style.display = 'block';
                if (userEmail && userInfo) userEmail.textContent = userInfo.email;
            } else {
                if (loggedOutState) loggedOutState.style.display = 'block';
                if (loggedInState) loggedInState.style.display = 'none';
            }
        }

        // 로그인 상태 변경 시 잠금/편집 버튼 활성화 여부 갱신
        updateLockUI();
        
        // 지출 탭인 경우 동기화 여부에 맞춰 지출 추가 버튼 등을 다시 렌더링하기 위해 리프레시
        if (currentTab === 'expenses') {
            Expenses.render();
        }
    }

    function showGDriveConfigModal() {
        const config = Store.getGDriveConfig();
        const html = `
        <div class="modal__header">
            <h3 class="modal__title">⚙️ 구글 드라이브 연동 설정</h3>
            <button class="modal__close" id="modal-close">&times;</button>
        </div>
        <div class="modal__body" style="display:flex;flex-direction:column;gap:12px">
            <div class="form-group">
                <label class="form-label" style="font-weight:600">Google Cloud Console OAuth 클라이언트 ID</label>
                <input type="text" class="form-input" id="gdrive-client-id-input" placeholder="xxxxx.apps.googleusercontent.com" value="${config.clientId}" style="font-family:monospace;font-size:0.85rem">
                <div class="form-hint" style="color:var(--text-muted);margin-top:8px;line-height:1.4">
                    정적 웹사이트(GitHub Pages)에서 구글 드라이브를 연동하기 위해서는 본인의 Google Cloud 프로젝트에서 생성한 <strong>OAuth Client ID</strong>가 필요합니다.
                    <br><br>
                    <strong>설정 순서:</strong>
                    <ol style="margin-left:16px;margin-top:4px">
                        <li><a href="https://console.cloud.google.com" target="_blank" style="color:var(--primary);text-decoration:underline">Google Cloud Console</a>에 접속</li>
                        <li>프로젝트 생성 및 <strong>Google Drive API</strong> 활성화</li>
                        <li>OAuth 동의 화면을 구성 (외부 사용자 테스트 지정)</li>
                        <li>사용자 인증 정보에서 <strong>OAuth 클라이언트 ID (웹 애플리케이션)</strong> 생성</li>
                        <li>승인된 JavaScript 원본(Origins)에 현재 주소 추가</li>
                        <li>발급된 Client ID를 여기에 붙여넣고 저장</li>
                    </ol>
                </div>
            </div>
        </div>
        <div class="modal__footer">
            <button class="btn btn--ghost" id="modal-cancel">취소</button>
            <button class="btn btn--primary" id="btn-gdrive-config-save">저장</button>
        </div>`;

        showModal(html);

        document.getElementById('btn-gdrive-config-save').addEventListener('click', () => {
            const val = document.getElementById('gdrive-client-id-input').value.trim();
            if (!val) {
                alert('클라이언트 ID를 입력해 주세요.');
                return;
            }
            GDrive.setClientId(val);
            closeModal();
            showToast('구글 클라이언트 ID가 저장 및 반영되었습니다.', 'success');
        });
        document.getElementById('modal-cancel').addEventListener('click', closeModal);
        document.getElementById('modal-close').addEventListener('click', closeModal);
    }

    // 구글 드라이브 백그라운드 변경 사항 감지
    function startPresenceCheck() {
        if (presenceCheckInterval) clearInterval(presenceCheckInterval);
        presenceCheckInterval = setInterval(async () => {
            if (typeof GDrive !== 'undefined' && GDrive.isLoggedIn && GDrive.isLoggedIn()) {
                const updateNeeded = await GDrive.checkNewerVersion();
                const banner = document.getElementById('sync-warning-banner');
                const emailEl = document.getElementById('sync-warning-email');
                if (updateNeeded && updateNeeded.newer) {
                    if (banner) banner.style.display = 'flex';
                    if (emailEl) emailEl.textContent = updateNeeded.email;
                } else {
                    if (banner) banner.style.display = 'none';
                }
            }
        }, 60000); // 1분 주기
    }

    // ── Global Event Binding ─────────────────────────────────

    function bindGlobalEvents() {
        // Sidebar navigation
        document.querySelectorAll('.sidebar__nav-item').forEach(item => {
            item.addEventListener('click', () => {
                const tab = item.dataset.tab;
                if (tab) {
                    if (tab === 'expenses') Expenses.resetFilters();
                    navigateTo(tab);
                }
            });
        });

        // Project selector
        document.getElementById('project-select').addEventListener('change', (e) => {
            Store.setCurrentProject(e.target.value);
            renderYearTabs();
            navigateTo(currentTab);
        });

        // Year tabs (delegation)
        document.getElementById('year-tabs').addEventListener('click', (e) => {
            const tab = e.target.closest('.year-tab');
            if (tab) {
                Store.setCurrentYear(tab.dataset.yearId);
                renderYearTabs();
                if (currentTab === 'expenses') Expenses.resetFilters();
                navigateTo(currentTab);
            }
        });

        // Project management buttons
        document.getElementById('btn-add-project').addEventListener('click', Projects.showAddModal);
        document.getElementById('btn-edit-project').addEventListener('click', Projects.showEditModal);
        document.getElementById('btn-delete-project').addEventListener('click', Projects.deleteCurrentProject);

        // Export / Import buttons
        document.getElementById('btn-export-dashboard').addEventListener('click', Export.exportDashboard);
        document.getElementById('btn-export-expenses').addEventListener('click', Export.exportExpenses);
        document.getElementById('btn-import').addEventListener('click', Export.showImportModal);
        document.getElementById('btn-backup').addEventListener('click', Export.backupData);
        document.getElementById('btn-restore').addEventListener('click', Export.showRestoreModal);
        document.getElementById('btn-rcms-upload').addEventListener('click', Export.showRCMSImportModal);
        document.getElementById('btn-image-budget').addEventListener('click', Export.showImageBudgetModal);

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Ctrl+1: Dashboard, Ctrl+2: Integrated Dashboard, Ctrl+3: Expenses
            if (e.ctrlKey && e.key === '1') { e.preventDefault(); navigateTo('dashboard'); }
            if (e.ctrlKey && e.key === '2') { e.preventDefault(); navigateTo('integrated'); }
            if (e.ctrlKey && e.key === '3') { e.preventDefault(); navigateTo('expenses'); }
            // Ctrl+N: New expense (when on expenses tab)
            if (e.ctrlKey && e.key === 'n' && currentTab === 'expenses') {
                e.preventDefault();
                Expenses.showExpenseModal();
            }
        });

        // Settings Lock toggle
        const toggleLockBtn = document.getElementById('btn-toggle-lock');
        if (toggleLockBtn) {
            toggleLockBtn.addEventListener('click', () => {
                if (Store.isLocked()) {
                    showUnlockModal();
                } else {
                    Store.setLocked(true);
                    updateLockUI();
                    showToast('🔒 설정 편집이 잠겼습니다.', 'info');
                }
            });
        }

        // Google Drive Sync Controls
        const btnGDriveConfig = document.getElementById('btn-gdrive-config');
        if (btnGDriveConfig) btnGDriveConfig.addEventListener('click', showGDriveConfigModal);

        const btnGDriveSetupPrompt = document.getElementById('btn-gdrive-setup-prompt');
        if (btnGDriveSetupPrompt) btnGDriveSetupPrompt.addEventListener('click', showGDriveConfigModal);

        const btnGDriveLogin = document.getElementById('btn-gdrive-login');
        if (btnGDriveLogin) btnGDriveLogin.addEventListener('click', () => GDrive.login());

        const btnGDriveSync = document.getElementById('btn-gdrive-sync');
        if (btnGDriveSync) btnGDriveSync.addEventListener('click', () => GDrive.sync());

        const btnGDriveLogout = document.getElementById('btn-gdrive-logout');
        if (btnGDriveLogout) btnGDriveLogout.addEventListener('click', () => GDrive.logout());

        // Warning Banner Sync Action
        const btnSyncBannerTrigger = document.getElementById('btn-sync-banner-trigger');
        if (btnSyncBannerTrigger) {
            btnSyncBannerTrigger.addEventListener('click', async () => {
                const banner = document.getElementById('sync-warning-banner');
                if (banner) banner.style.display = 'none';
                if (typeof GDrive !== 'undefined') {
                    await GDrive.sync();
                }
            });
        }
    }

    return {
        init, navigateTo, getCurrentTab, refresh,
        showModal, closeModal, showConfirm, showToast, updateLockUI
    };
})();

// ── Boot ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', App.init);
