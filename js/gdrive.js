// ═══════════════════════════════════════════════════════════════
// Government Project Budget Manager - Google Drive API Connector
// ═══════════════════════════════════════════════════════════════

const GDrive = (() => {
    let tokenClient = null;
    let tokenInfo = {
        accessToken: sessionStorage.getItem('gdrive_token') || null,
        expiresAt: Number(sessionStorage.getItem('gdrive_token_expires')) || 0
    };
    let userInfo = null;
    let onStateChangeCallback = null;

    // 현재 토큰이 유효한지 체크
    function isLoggedIn() {
        return !!(tokenInfo.accessToken && tokenInfo.expiresAt > Date.now());
    }

    function getAccessToken() {
        if (isLoggedIn()) return tokenInfo.accessToken;
        return null;
    }

    // Google Drive SDK/TokenClient 초기화
    function init(onStateChange) {
        if (onStateChange) {
            onStateChangeCallback = onStateChange;
        }

        const config = Store.getGDriveConfig();
        if (!config.clientId) {
            triggerStateChange('no_client_id');
            return;
        }

        try {
            if (typeof google === 'undefined' || !google.accounts || !google.accounts.oauth2) {
                console.warn('Google Identity Services SDK가 로드되지 않았습니다.');
                triggerStateChange('sdk_not_loaded');
                return;
            }

            tokenClient = google.accounts.oauth2.initTokenClient({
                client_id: config.clientId,
                scope: 'https://www.googleapis.com/auth/drive.file email',
                callback: async (response) => {
                    if (response.error) {
                        console.error('OAuth 에러:', response.error);
                        triggerStateChange('error', '로그인 실패: ' + response.error);
                        return;
                    }

                    tokenInfo.accessToken = response.access_token;
                    tokenInfo.expiresAt = Date.now() + (Number(response.expires_in) * 1000) - 60000;
                    sessionStorage.setItem('gdrive_token', tokenInfo.accessToken);
                    sessionStorage.setItem('gdrive_token_expires', tokenInfo.expiresAt);

                    triggerStateChange('syncing', '사용자 정보 확인 중...');
                    await fetchUserInfo();
                    triggerStateChange('logged_in');
                    
                    // 로그인 성공 직후 자동 동기화 시도
                    await sync();
                }
            });

            // 이미 유효한 토큰이 세션에 있는 경우 사용자 정보 로드 및 동기화 진행
            if (isLoggedIn()) {
                fetchUserInfo().then(() => {
                    triggerStateChange('logged_in');
                    sync();
                }).catch(err => {
                    console.error('세션 토큰 기반 로그인 정보 로드 실패:', err);
                    logout();
                });
            } else {
                triggerStateChange('logged_out');
            }
        } catch (e) {
            console.error('Google Drive 초기화 실패:', e);
            triggerStateChange('error', '초기화 에러');
        }
    }

    function triggerStateChange(state, message = '') {
        if (onStateChangeCallback) {
            onStateChangeCallback(state, message, userInfo);
        }
    }

    // 사용자 프로필 정보(이메일) 획득
    async function fetchUserInfo() {
        const token = getAccessToken();
        if (!token) return;

        try {
            const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                userInfo = await res.json();
            } else {
                throw new Error('Userinfo status: ' + res.status);
            }
        } catch (e) {
            console.error('사용자 프로필 획득 실패:', e);
            userInfo = { email: '구글 연동 계정' };
        }
    }

    // 로그인 실행 (OAuth 팝업창 호출)
    function login() {
        if (!tokenClient) {
            const config = Store.getGDriveConfig();
            if (!config.clientId) {
                alert('구글 클라이언트 ID 설정이 필요합니다.');
                return;
            }
            init();
        }
        if (tokenClient) {
            tokenClient.requestAccessToken({ prompt: 'consent' });
        } else {
            alert('구글 로그인 모듈을 초기화할 수 없습니다. 클라이언트 ID를 확인하세요.');
        }
    }

    // 로그아웃 (토큰 만료 및 상태 초기화)
    function logout() {
        const token = getAccessToken();
        if (token) {
            try {
                google.accounts.oauth2.revokeToken(token, () => {});
            } catch (e) {
                console.error('토큰 해제 실패:', e);
            }
        }
        tokenInfo.accessToken = null;
        tokenInfo.expiresAt = 0;
        userInfo = null;
        sessionStorage.removeItem('gdrive_token');
        sessionStorage.removeItem('gdrive_token_expires');
        
        // 로컬 저장소에 기록된 파일 ID 초기화
        const config = Store.getGDriveConfig();
        Store.saveGDriveConfig(config.clientId, '', '');
        
        triggerStateChange('logged_out');
    }

    // Google Drive REST API 요청 공통 헬퍼
    async function driveApiRequest(path, options = {}) {
        const token = getAccessToken();
        if (!token) {
            throw new Error('인증 토큰이 없습니다. 다시 로그인해 주세요.');
        }

        options.headers = options.headers || {};
        options.headers['Authorization'] = `Bearer ${token}`;

        const url = path.startsWith('http') ? path : `https://www.googleapis.com/drive/v3${path}`;
        const res = await fetch(url, options);

        if (!res.ok) {
            const errBody = await res.text().catch(() => '');
            console.error(`Google API Error (${res.status}):`, errBody);
            if (res.status === 401) {
                logout();
                throw new Error('인증 세션이 만료되었습니다. 다시 로그인해 주세요.');
            }
            throw new Error(`구글 드라이브 API 통신 오류 (${res.status})`);
        }

        return res;
    }

    // 파일 존재 여부 확인
    async function findFile() {
        const query = encodeURIComponent("name='zetaelec_budget_data.json' and trashed=false");
        const res = await driveApiRequest(`/files?q=${query}&fields=files(id,name,modifiedTime)&spaces=drive`);
        const data = await res.json();
        if (data.files && data.files.length > 0) {
            return data.files[0];
        }
        return null;
    }

    // 파일 신규 생성 (메타데이터 등록)
    async function createFile() {
        const res = await driveApiRequest('/files', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'zetaelec_budget_data.json',
                mimeType: 'application/json'
            })
        });
        const file = await res.json();
        return file.id;
    }

    // 동기화 메인 프로세스 (비교 및 양방향 제어)
    async function sync(forceUpload = false) {
        if (!isLoggedIn()) return;

        try {
            triggerStateChange('syncing', '동기화 상태 확인 중...');
            
            let file = await findFile();
            let fileId = file ? file.id : null;

            if (!fileId) {
                // 구글 드라이브에 파일이 존재하지 않는 경우 새로 만들고 업로드
                fileId = await createFile();
                const config = Store.getGDriveConfig();
                Store.saveGDriveConfig(config.clientId, fileId);
                await uploadFileContent(fileId);
                const nowStr = new Date().toLocaleString();
                Store.saveGDriveConfig(config.clientId, fileId, nowStr);
                triggerStateChange('success', `동기화 완료: ${nowStr}`);
                return;
            }

            // 파일 ID 기록
            const config = Store.getGDriveConfig();
            Store.saveGDriveConfig(config.clientId, fileId);

            if (forceUpload) {
                await uploadFileContent(fileId);
                const nowStr = new Date().toLocaleString();
                Store.saveGDriveConfig(config.clientId, fileId, nowStr);
                triggerStateChange('success', `업로드 완료: ${nowStr}`);
                return;
            }

            // 구글 드라이브 데이터 내려받기
            const remoteData = await downloadFileContent(fileId);
            if (!remoteData || !remoteData.projects) {
                // 다운로드 실패 또는 파일 비어있음 -> 로컬 데이터 업로드
                await uploadFileContent(fileId);
                const nowStr = new Date().toLocaleString();
                Store.saveGDriveConfig(config.clientId, fileId, nowStr);
                triggerStateChange('success', `초기 업로드 완료: ${nowStr}`);
                return;
            }

            // 데이터 충돌 판정 및 확인창 표시
            const localData = Store.exportData();
            
            // 로컬 데이터가 단순히 샘플 프로젝트만 있고 지출 데이터가 미미한 초기 상태인지 확인
            const isLocalDefault = localData.projects.length === 1 && 
                                   localData.projects[0].name === '정부과제 샘플 프로젝트' && 
                                   localData.expenses.length <= 31;
            
            if (isLocalDefault) {
                // 로컬이 기본 샘플 상태면 아무 팝업 없이 클라우드 데이터를 로컬에 즉시 적용
                Store.importData(remoteData);
                const nowStr = new Date().toLocaleString();
                Store.saveGDriveConfig(config.clientId, fileId, nowStr);
                triggerStateChange('success', `구글 드라이브 데이터 불러옴: ${nowStr}`);
                
                // UI 새로고침
                if (typeof App !== 'undefined' && App.refresh) {
                    App.refresh();
                } else {
                    window.location.reload();
                }
                return;
            }

            // 로컬과 원격지 데이터 모두에 사용자 정보가 있으면 선택을 요청
            const confirmPull = confirm(
                "구글 드라이브에 기존 예산 데이터 파일이 존재합니다.\n\n" +
                "[확인] 버튼을 누르면 구글 드라이브 데이터로 로컬 데이터를 덮어씁니다 (기기 간 연동 시 권장).\n" +
                "[취소] 버튼을 누르면 현재 기기의 로컬 데이터를 구글 드라이브에 업로드하여 저장합니다."
            );

            if (confirmPull) {
                Store.importData(remoteData);
                const nowStr = new Date().toLocaleString();
                Store.saveGDriveConfig(config.clientId, fileId, nowStr);
                triggerStateChange('success', `가져오기 완료: ${nowStr}`);
                
                if (typeof App !== 'undefined' && App.refresh) {
                    App.refresh();
                } else {
                    window.location.reload();
                }
            } else {
                await uploadFileContent(fileId);
                const nowStr = new Date().toLocaleString();
                Store.saveGDriveConfig(config.clientId, fileId, nowStr);
                triggerStateChange('success', `내보내기 완료: ${nowStr}`);
            }

        } catch (e) {
            console.error('구글 드라이브 동기화 실패:', e);
            triggerStateChange('error', '동기화 실패: ' + e.message);
        }
    }

    // 파일 콘텐츠 다운로드
    async function downloadFileContent(fileId) {
        const res = await driveApiRequest(`/files/${fileId}?alt=media`);
        try {
            return await res.json();
        } catch (e) {
            console.warn('JSON 파싱 실패 (빈 파일일 수 있음):', e);
            return null;
        }
    }

    // 파일 콘텐츠 업로드 (Patch/Overwrite)
    async function uploadFileContent(fileId) {
        const localData = Store.exportData();
        
        // 동기화 불필요 정보 삭제 (구글 설정은 로컬 브라우저 기기별로 관리하도록 분리)
        const cleanData = JSON.parse(JSON.stringify(localData));
        delete cleanData.gdriveClientId;
        delete cleanData.gdriveFileId;
        delete cleanData.lastSyncTime;

        await driveApiRequest(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(cleanData)
        });
    }

    // 데이터 저장 시 연동 자동 업로드 훅
    async function autoUpload() {
        if (!isLoggedIn()) return;
        const config = Store.getGDriveConfig();
        if (!config.fileId) return;

        try {
            await uploadFileContent(config.fileId);
            const nowStr = new Date().toLocaleString();
            Store.saveGDriveConfig(config.clientId, config.fileId, nowStr);
            triggerStateChange('success', `자동 저장됨: ${nowStr}`);
        } catch (e) {
            console.error('자동 업로드 실패:', e);
            triggerStateChange('error', '자동 동기화 실패');
        }
    }

    return {
        init, login, logout, sync, autoUpload, isLoggedIn, getAccessToken,
        setClientId: function(clientId) {
            const config = Store.getGDriveConfig();
            Store.saveGDriveConfig(clientId, config.fileId, config.lastSyncTime);
            // 클라이언트 ID가 변경되었으므로 초기화 재시행
            init();
        }
    };
})();
