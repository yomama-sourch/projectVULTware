/* ══════════════════════════════════════════════════════
   VultShare — App Logic
   Auth, CRUD, Settings (Color/Wallpaper/Opacity/Reset)
   ══════════════════════════════════════════════════════ */

(function () {
    'use strict';

    // ─── Storage Keys ───
    const KEYS = {
        USERS: 'vultshare_users',
        SCRIPTS: 'vultshare_scripts',
        SESSION: 'vultshare_session',
        SETTINGS: 'vultshare_settings',
    };

    const DEFAULT_SETTINGS = {
        accentColor: '#22d3ee',
        wallpaper: null,
        wallpaperOpacity: 30,
        wallpaperBlur: 8,
    };

    // ─── Seed Owner ───
    function seedOwner() {
        const users = getUsers();
        if (!users.find(u => u.username === 'vult')) {
            users.push({
                username: 'vult',
                password: 'maybeVult3xternal2000',
                role: 'owner',
                created: new Date().toISOString(),
            });
            saveUsers(users);
        }
    }

    // ─── Shared Database API & LocalStorage helpers ───
    function getUsers() {
        try { return JSON.parse(localStorage.getItem(KEYS.USERS)) || []; }
        catch { return []; }
    }
    function saveUsers(u) { 
        localStorage.setItem(KEYS.USERS, JSON.stringify(u));
        syncWithServer();
    }

    function getScripts() {
        try { return JSON.parse(localStorage.getItem(KEYS.SCRIPTS)) || []; }
        catch { return []; }
    }
    function saveScripts(s) { 
        localStorage.setItem(KEYS.SCRIPTS, JSON.stringify(s));
        syncWithServer();
    }

    function syncWithServer() {
        const payload = {
            users: getUsers(),
            scripts: getScripts()
        };
        fetch('/api/db', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }).catch(() => {});
    }

    async function fetchServerDB() {
        try {
            const res = await fetch('/api/db');
            if (res.ok) {
                const data = await res.json();
                if (data.users && Array.isArray(data.users)) {
                    localStorage.setItem(KEYS.USERS, JSON.stringify(data.users));
                }
                if (data.scripts && Array.isArray(data.scripts)) {
                    localStorage.setItem(KEYS.SCRIPTS, JSON.stringify(data.scripts));
                }
                renderFeed();
            }
        } catch {}
    }

    function getSession() {
        try { return JSON.parse(localStorage.getItem(KEYS.SESSION)); }
        catch { return null; }
    }
    function setSession(s) { localStorage.setItem(KEYS.SESSION, JSON.stringify(s)); }
    function clearSession() { localStorage.removeItem(KEYS.SESSION); }

    function getSettings() {
        try {
            const saved = JSON.parse(localStorage.getItem(KEYS.SETTINGS));
            return Object.assign({}, DEFAULT_SETTINGS, saved);
        } catch {
            return Object.assign({}, DEFAULT_SETTINGS);
        }
    }
    function saveSettings(st) { localStorage.setItem(KEYS.SETTINGS, JSON.stringify(st)); }

    // ─── DOM refs ───
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    const wallpaperLayer = $('#custom-wallpaper-bg');
    const authContainer = $('#auth-container');
    const appContainer = $('#app-container');

    // Auth
    const loginForm = $('#login-form');
    const signupForm = $('#signup-form');
    const loginError = $('#login-error');
    const signupError = $('#signup-error');
    const showSignupLink = $('#show-signup');
    const showLoginLink = $('#show-login');

    // App Header
    const userAvatar = $('#user-avatar');
    const userDisplayName = $('#user-display-name');
    const userBadge = $('#user-badge');
    const logoutBtn = $('#logout-btn');
    const settingsBtn = $('#settings-btn');

    // Post Form
    const newPostToggle = $('#new-post-toggle');
    const postFormWrapper = $('#post-form-wrapper');
    const postForm = $('#post-form');
    const cancelPostBtn = $('#cancel-post');
    const postFormHeading = $('#post-form-heading');
    const postSubmitLabel = $('#post-submit-label');
    const editPostIdInput = $('#edit-post-id');
    const postTitleInput = $('#post-title');
    const postCategorySelect = $('#post-category');
    const postDescInput = $('#post-description');
    const postCodeInput = $('#post-code');

    // Thumbnail elements
    const thumbnailUpload = $('#thumbnail-upload');
    const thumbnailInput = $('#post-thumbnail');
    const thumbnailDropzone = $('#thumbnail-dropzone');
    const thumbnailPreview = $('#thumbnail-preview');
    const thumbnailPreviewImg = $('#thumbnail-preview-img');
    const thumbnailRemove = $('#thumbnail-remove');

    // Settings Modal elements
    const settingsModal = $('#settings-modal');
    const closeSettingsBtn = $('#close-settings-btn');
    const saveSettingsBtn = $('#save-settings-btn');
    const resetSettingsBtn = $('#reset-settings-btn');
    const customAccentColorInput = $('#custom-accent-color');
    const wallpaperFileInput = $('#wallpaper-file-input');
    const wallpaperDropzone = $('#wallpaper-dropzone');
    const wallpaperPreview = $('#wallpaper-preview');
    const wallpaperPreviewImg = $('#wallpaper-preview-img');
    const removeWallpaperBtn = $('#remove-wallpaper-btn');
    const wallpaperOpacitySlider = $('#wallpaper-opacity-slider');
    const wallpaperOpacityVal = $('#wallpaper-opacity-val');
    const wallpaperBlurSlider = $('#wallpaper-blur-slider');
    const wallpaperBlurVal = $('#wallpaper-blur-val');

    // Feed & Filter
    const codeFeed = $('#code-feed');
    const emptyState = $('#empty-state');
    const searchInput = $('#search-input');
    const toastContainer = $('#toast-container');

    // Modal
    const deleteModal = $('#delete-modal');
    const cancelDeleteBtn = $('#cancel-delete');
    const confirmDeleteBtn = $('#confirm-delete');

    let currentFilter = 'script';
    let pendingDeleteId = null;
    let currentThumbnailBase64 = null;
    let activeSettings = getSettings();

    // ─── Init ───
    function init() {
        seedOwner();
        fetchServerDB();
        applySettings(activeSettings);
        bindAuthEvents();
        bindAppEvents();
        bindSettingsEvents();

        // Poll for new scripts from friends every 6s
        setInterval(fetchServerDB, 6000);

        const session = getSession();
        if (session) {
            showApp(session);
        } else {
            showAuth();
        }
    }

    // ─── Theme & Settings Application ───
    function applySettings(st) {
        const root = document.documentElement;
        const color = st.accentColor || DEFAULT_SETTINGS.accentColor;

        root.style.setProperty('--accent', color);
        root.style.setProperty('--accent-hover', adjustColorBrightness(color, -15));
        root.style.setProperty('--accent-subtle', hexToRgba(color, 0.16));
        root.style.setProperty('--accent-glow', hexToRgba(color, 0.08));

        // Sync settings UI controls
        customAccentColorInput.value = color.startsWith('#') ? color : '#22d3ee';
        $$('.color-preset').forEach(btn => {
            if (btn.dataset.color.toLowerCase() === color.toLowerCase()) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Wallpaper
        if (st.wallpaper) {
            wallpaperLayer.style.backgroundImage = `url(${st.wallpaper})`;
            wallpaperLayer.style.opacity = (st.wallpaperOpacity / 100).toString();
            wallpaperLayer.style.filter = `blur(${st.wallpaperBlur || 0}px)`;

            wallpaperPreviewImg.src = st.wallpaper;
            wallpaperPreview.classList.remove('hidden');
            wallpaperDropzone.classList.add('hidden');
        } else {
            wallpaperLayer.style.backgroundImage = 'none';
            wallpaperLayer.style.opacity = '0';
            wallpaperLayer.style.filter = 'none';

            wallpaperPreviewImg.src = '';
            wallpaperPreview.classList.add('hidden');
            wallpaperDropzone.classList.remove('hidden');
        }

        wallpaperOpacitySlider.value = st.wallpaperOpacity;
        wallpaperOpacityVal.textContent = `${st.wallpaperOpacity}%`;

        wallpaperBlurSlider.value = st.wallpaperBlur || 0;
        wallpaperBlurVal.textContent = `${st.wallpaperBlur || 0}px`;
    }

    function hexToRgba(hex, alpha) {
        let c = hex.replace('#', '');
        if (c.length === 3) c = c.split('').map(x => x + x).join('');
        const num = parseInt(c, 16);
        return `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, ${alpha})`;
    }

    function adjustColorBrightness(hex, percent) {
        let c = hex.replace('#', '');
        if (c.length === 3) c = c.split('').map(x => x + x).join('');
        const num = parseInt(c, 16);
        let r = (num >> 16) + Math.round(255 * (percent / 100));
        let g = ((num >> 8) & 0x00FF) + Math.round(255 * (percent / 100));
        let b = (num & 0x0000FF) + Math.round(255 * (percent / 100));
        r = Math.min(255, Math.max(0, r));
        g = Math.min(255, Math.max(0, g));
        b = Math.min(255, Math.max(0, b));
        return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
    }

    // ─── Auth Views ───
    function showAuth() {
        authContainer.classList.remove('hidden');
        appContainer.classList.add('hidden');
        loginForm.classList.add('active');
        signupForm.classList.remove('active');
        loginError.textContent = '';
        signupError.textContent = '';
    }

    function showApp(session) {
        authContainer.classList.add('hidden');
        appContainer.classList.remove('hidden');

        userAvatar.textContent = session.username.charAt(0);
        userDisplayName.textContent = session.username;

        if (session.role === 'owner') {
            userBadge.classList.remove('hidden');
        } else {
            userBadge.classList.add('hidden');
        }

        renderFeed();
    }

    // ─── Thumbnail Helper Functions ───
    function setThumbnailPreview(base64) {
        currentThumbnailBase64 = base64;
        thumbnailPreviewImg.src = base64;
        thumbnailDropzone.classList.add('hidden');
        thumbnailPreview.classList.remove('hidden');
        thumbnailInput.classList.add('hidden');
    }

    function clearThumbnailPreview() {
        currentThumbnailBase64 = null;
        thumbnailPreviewImg.src = '';
        thumbnailPreview.classList.add('hidden');
        thumbnailDropzone.classList.remove('hidden');
        thumbnailInput.classList.remove('hidden');
        thumbnailInput.value = '';
    }

    function handleThumbnailFile(file) {
        if (!file || !file.type.startsWith('image/')) return;
        if (file.size > 2 * 1024 * 1024) {
            toast('Image too large — max 2MB.', 'error');
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            setThumbnailPreview(e.target.result);
        };
        reader.readAsDataURL(file);
    }

    function resetPostForm() {
        postForm.reset();
        editPostIdInput.value = '';
        postFormHeading.textContent = 'Share New Script';
        postSubmitLabel.textContent = 'Share Script';
        clearThumbnailPreview();
    }

    // ─── Open Edit Mode ───
    function openEditMode(script) {
        editPostIdInput.value = script.id;
        postTitleInput.value = script.title;
        postCategorySelect.value = script.category;
        postDescInput.value = script.description || '';
        postCodeInput.value = script.code;
        postFormHeading.textContent = 'Edit Script';
        postSubmitLabel.textContent = 'Save Changes';

        if (script.thumbnail) {
            setThumbnailPreview(script.thumbnail);
        } else {
            clearThumbnailPreview();
        }

        newPostToggle.classList.add('hidden');
        postFormWrapper.classList.remove('hidden');
        postFormWrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
        postTitleInput.focus();
    }

    // ─── Auth Events ───
    function bindAuthEvents() {
        showSignupLink.addEventListener('click', (e) => {
            e.preventDefault();
            loginForm.classList.remove('active');
            signupForm.classList.add('active');
            loginError.textContent = '';
            signupError.textContent = '';
        });

        showLoginLink.addEventListener('click', (e) => {
            e.preventDefault();
            signupForm.classList.remove('active');
            loginForm.classList.add('active');
            loginError.textContent = '';
            signupError.textContent = '';
        });

        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const username = $('#login-username').value.trim();
            const password = $('#login-password').value;

            const users = getUsers();
            const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());

            if (!user || user.password !== password) {
                loginError.textContent = 'Invalid username or password.';
                shakeElement(loginForm);
                return;
            }

            loginError.textContent = '';
            const session = { username: user.username, role: user.role };
            setSession(session);
            showApp(session);
            toast('Welcome back, ' + user.username + '!', 'success');
        });

        signupForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const username = $('#signup-username').value.trim();
            const password = $('#signup-password').value;
            const confirm = $('#signup-confirm').value;

            if (password !== confirm) {
                signupError.textContent = 'Passwords do not match.';
                shakeElement(signupForm);
                return;
            }

            if (username.length < 3) {
                signupError.textContent = 'Username must be at least 3 characters.';
                shakeElement(signupForm);
                return;
            }

            if (password.length < 6) {
                signupError.textContent = 'Password must be at least 6 characters.';
                shakeElement(signupForm);
                return;
            }

            const users = getUsers();
            if (users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
                signupError.textContent = 'Username already taken.';
                shakeElement(signupForm);
                return;
            }

            users.push({
                username,
                password,
                role: 'member',
                created: new Date().toISOString(),
            });
            saveUsers(users);

            signupError.textContent = '';
            const session = { username, role: 'member' };
            setSession(session);
            showApp(session);
            toast('Account created! Welcome, ' + username + '.', 'success');
        });

        $$('.toggle-pw').forEach(btn => {
            btn.addEventListener('click', () => {
                const target = $('#' + btn.dataset.target);
                const isHidden = target.type === 'password';
                target.type = isHidden ? 'text' : 'password';
                btn.style.opacity = isHidden ? '1' : '0.5';
            });
        });
    }

    // ─── Settings Events ───
    function bindSettingsEvents() {
        // Open Settings Modal
        settingsBtn.addEventListener('click', () => {
            applySettings(activeSettings);
            settingsModal.classList.remove('hidden');
        });

        // Close Settings Modal
        closeSettingsBtn.addEventListener('click', () => {
            settingsModal.classList.add('hidden');
        });

        saveSettingsBtn.addEventListener('click', () => {
            saveSettings(activeSettings);
            settingsModal.classList.add('hidden');
            toast('Settings saved!', 'success');
        });

        settingsModal.addEventListener('click', (e) => {
            if (e.target === settingsModal) {
                settingsModal.classList.add('hidden');
            }
        });

        // Color Presets
        $$('.color-preset').forEach(btn => {
            btn.addEventListener('click', () => {
                const color = btn.dataset.color;
                activeSettings.accentColor = color;
                applySettings(activeSettings);
                saveSettings(activeSettings);
            });
        });

        // Custom Color Picker
        customAccentColorInput.addEventListener('input', (e) => {
            activeSettings.accentColor = e.target.value;
            applySettings(activeSettings);
            saveSettings(activeSettings);
        });

        // Wallpaper Upload
        wallpaperFileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                const file = e.target.files[0];
                if (file.size > 3 * 1024 * 1024) {
                    toast('Wallpaper image too large — max 3MB.', 'error');
                    return;
                }
                const reader = new FileReader();
                reader.onload = (evt) => {
                    activeSettings.wallpaper = evt.target.result;
                    applySettings(activeSettings);
                    saveSettings(activeSettings);
                    toast('Wallpaper updated!', 'success');
                };
                reader.readAsDataURL(file);
            }
        });

        // Remove Wallpaper
        removeWallpaperBtn.addEventListener('click', () => {
            activeSettings.wallpaper = null;
            wallpaperFileInput.value = '';
            applySettings(activeSettings);
            saveSettings(activeSettings);
            toast('Wallpaper removed.', 'success');
        });

        // Wallpaper Opacity Slider
        wallpaperOpacitySlider.addEventListener('input', (e) => {
            activeSettings.wallpaperOpacity = parseInt(e.target.value, 10);
            applySettings(activeSettings);
            saveSettings(activeSettings);
        });

        // Wallpaper Blur Slider
        wallpaperBlurSlider.addEventListener('input', (e) => {
            activeSettings.wallpaperBlur = parseInt(e.target.value, 10);
            applySettings(activeSettings);
            saveSettings(activeSettings);
        });

        // RESET SETTINGS TO DEFAULTS
        resetSettingsBtn.addEventListener('click', () => {
            activeSettings = Object.assign({}, DEFAULT_SETTINGS);
            wallpaperFileInput.value = '';
            saveSettings(activeSettings);
            applySettings(activeSettings);
            toast('Appearance reset to defaults!', 'success');
        });
    }

    // ─── App Events ───
    function bindAppEvents() {
        logoutBtn.addEventListener('click', () => {
            clearSession();
            showAuth();
            toast('Signed out.', 'success');
        });

        newPostToggle.addEventListener('click', () => {
            resetPostForm();
            newPostToggle.classList.add('hidden');
            postFormWrapper.classList.remove('hidden');
            postTitleInput.focus();
        });

        cancelPostBtn.addEventListener('click', () => {
            postFormWrapper.classList.add('hidden');
            newPostToggle.classList.remove('hidden');
            resetPostForm();
        });

        // Thumbnail file selection
        thumbnailInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                handleThumbnailFile(e.target.files[0]);
            }
        });

        thumbnailRemove.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            clearThumbnailPreview();
        });

        // Drag and drop for thumbnail
        thumbnailDropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            thumbnailUpload.classList.add('drag-over');
        });
        thumbnailDropzone.addEventListener('dragleave', () => {
            thumbnailUpload.classList.remove('drag-over');
        });
        thumbnailDropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            thumbnailUpload.classList.remove('drag-over');
            if (e.dataTransfer && e.dataTransfer.files[0]) {
                handleThumbnailFile(e.dataTransfer.files[0]);
            }
        });

        // Post Form Submit (New or Edit)
        postForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const session = getSession();
            if (!session) return;

            const editId = editPostIdInput.value.trim();
            const title = postTitleInput.value.trim();
            const description = postDescInput.value.trim();
            const category = postCategorySelect.value;
            const code = postCodeInput.value;

            if (!title || !code) return;

            const scripts = getScripts();

            if (editId) {
                // UPDATE existing post
                const idx = scripts.findIndex(s => s.id === editId);
                if (idx !== -1) {
                    scripts[idx].title = title;
                    scripts[idx].description = description;
                    scripts[idx].category = category;
                    scripts[idx].code = code;
                    scripts[idx].updated = new Date().toISOString();

                    if (currentThumbnailBase64) {
                        scripts[idx].thumbnail = currentThumbnailBase64;
                    } else {
                        delete scripts[idx].thumbnail;
                    }

                    saveScripts(scripts);
                    toast('Script updated successfully!', 'success');
                }
            } else {
                // CREATE new post
                const newScript = {
                    id: generateId(),
                    title,
                    description,
                    category,
                    code,
                    author: session.username,
                    authorRole: session.role,
                    created: new Date().toISOString(),
                };

                if (currentThumbnailBase64) {
                    newScript.thumbnail = currentThumbnailBase64;
                }

                scripts.unshift(newScript);
                saveScripts(scripts);
                toast('Script shared!', 'success');
            }

            resetPostForm();
            postFormWrapper.classList.add('hidden');
            newPostToggle.classList.remove('hidden');
            renderFeed();
        });

        // Category Filter Tabs
        $$('.filter-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                $$('.filter-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                currentFilter = tab.dataset.filter;
                renderFeed();
            });
        });

        // Search
        let searchTimeout;
        searchInput.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => renderFeed(), 200);
        });

        // Delete Modal
        cancelDeleteBtn.addEventListener('click', () => {
            deleteModal.classList.add('hidden');
            pendingDeleteId = null;
        });

        confirmDeleteBtn.addEventListener('click', () => {
            if (!pendingDeleteId) return;
            let scripts = getScripts();
            scripts = scripts.filter(s => s.id !== pendingDeleteId);
            saveScripts(scripts);
            deleteModal.classList.add('hidden');
            pendingDeleteId = null;
            renderFeed();
            toast('Script deleted.', 'success');
        });

        deleteModal.addEventListener('click', (e) => {
            if (e.target === deleteModal) {
                deleteModal.classList.add('hidden');
                pendingDeleteId = null;
            }
        });
    }

    // ─── Render Feed ───
    const changelogSection = $('#changelog-section');

    function renderFeed() {
        if (currentFilter === 'changelog') {
            codeFeed.classList.add('hidden');
            if (changelogSection) changelogSection.classList.remove('hidden');
            return;
        }

        if (changelogSection) changelogSection.classList.add('hidden');
        codeFeed.classList.remove('hidden');

        const session = getSession();
        let scripts = getScripts();
        const query = searchInput.value.trim().toLowerCase();

        if (currentFilter !== 'all') {
            scripts = scripts.filter(s => s.category === currentFilter);
        }

        if (query) {
            scripts = scripts.filter(s =>
                s.title.toLowerCase().includes(query) ||
                s.description.toLowerCase().includes(query) ||
                s.author.toLowerCase().includes(query) ||
                s.code.toLowerCase().includes(query)
            );
        }

        codeFeed.querySelectorAll('.script-card').forEach(c => c.remove());

        if (scripts.length === 0) {
            emptyState.classList.remove('hidden');
            return;
        }
        emptyState.classList.add('hidden');

        scripts.forEach((script, idx) => {
            const card = createScriptCard(script, session, idx);
            codeFeed.appendChild(card);
        });

        if (window.Prism) {
            Prism.highlightAllUnder(codeFeed);
        }
    }

    // ─── Create Card ───
    function createScriptCard(script, session, idx) {
        const card = document.createElement('div');
        card.className = 'script-card';
        card.style.animationDelay = `${idx * 0.05}s`;

        const isOwner = session && session.role === 'owner';
        const isAuthor = session && session.username === script.author;
        const canManage = isOwner || isAuthor;

        const timeAgo = getTimeAgo(script.created);
        const authorBadge = script.authorRole === 'owner'
            ? `<span class="card-author-badge">OWNER</span>`
            : '';

        const codeLines = script.code.split('\n').length;
        const collapsed = codeLines > 14 ? 'collapsed' : '';

        const thumbnailHtml = script.thumbnail
            ? `<div class="card-thumbnail"><img src="${script.thumbnail}" alt="${escapeHtml(script.title)} thumbnail" loading="lazy"></div>`
            : '';

        card.innerHTML = `
            ${thumbnailHtml}
            <div class="card-header">
                <div class="card-meta">
                    <div class="card-title-row">
                        <span class="card-title">${escapeHtml(script.title)}</span>
                        <span class="card-category" data-cat="${script.category}">${script.category}</span>
                    </div>
                    ${script.description ? `<p class="card-description">${escapeHtml(script.description)}</p>` : ''}
                    <div class="card-author-row">
                        <span class="card-author">${escapeHtml(script.author)}</span>
                        ${authorBadge}
                        <span>·</span>
                        <span>${timeAgo}</span>
                        ${script.updated ? `<span>· (edited)</span>` : ''}
                    </div>
                </div>
                <div class="card-actions">
                    <button class="card-action-btn copy-btn" title="Copy code" data-id="${script.id}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                    </button>
                    ${canManage ? `
                    <button class="card-action-btn edit-btn" title="Edit script" data-id="${script.id}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button class="card-action-btn delete-btn" title="Delete" data-id="${script.id}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                    </button>` : ''}
                </div>
            </div>
            <div class="card-code-wrapper ${collapsed}">
                <pre><code class="language-lua">${escapeHtml(script.code)}</code></pre>
                ${collapsed ? `<button class="code-expand-btn">Show full code ↓</button>` : ''}
            </div>
        `;

        // Copy button
        card.querySelector('.copy-btn').addEventListener('click', () => {
            navigator.clipboard.writeText(script.code).then(() => {
                toast('Copied to clipboard!', 'success');
            }).catch(() => {
                const ta = document.createElement('textarea');
                ta.value = script.code;
                ta.style.position = 'fixed';
                ta.style.opacity = '0';
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
                toast('Copied to clipboard!', 'success');
            });
        });

        // Edit button
        const editBtn = card.querySelector('.edit-btn');
        if (editBtn) {
            editBtn.addEventListener('click', () => {
                openEditMode(script);
            });
        }

        // Delete button
        const deleteBtn = card.querySelector('.delete-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                pendingDeleteId = script.id;
                deleteModal.classList.remove('hidden');
            });
        }

        // Expand code button
        const expandBtn = card.querySelector('.code-expand-btn');
        if (expandBtn) {
            expandBtn.addEventListener('click', () => {
                const wrapper = card.querySelector('.card-code-wrapper');
                wrapper.classList.remove('collapsed');
                expandBtn.remove();
            });
        }

        return card;
    }

    // ─── Utils ───
    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    }

    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function getTimeAgo(iso) {
        const diff = Date.now() - new Date(iso).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'just now';
        if (mins < 60) return mins + 'm ago';
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return hrs + 'h ago';
        const days = Math.floor(hrs / 24);
        if (days < 30) return days + 'd ago';
        const months = Math.floor(days / 30);
        return months + 'mo ago';
    }

    function toast(message, type = 'success') {
        const el = document.createElement('div');
        el.className = `toast ${type}`;
        el.textContent = message;
        toastContainer.appendChild(el);
        setTimeout(() => {
            el.classList.add('fade-out');
            setTimeout(() => el.remove(), 300);
        }, 2800);
    }

    function shakeElement(el) {
        el.style.animation = 'none';
        void el.offsetHeight;
        el.style.animation = 'shake 0.4s ease';
        setTimeout(() => el.style.animation = '', 400);
    }

    const shakeStyle = document.createElement('style');
    shakeStyle.textContent = `
        @keyframes shake {
            0%, 100% { transform: translateX(0); }
            20% { transform: translateX(-6px); }
            40% { transform: translateX(6px); }
            60% { transform: translateX(-4px); }
            80% { transform: translateX(4px); }
        }
    `;
    document.head.appendChild(shakeStyle);

    document.addEventListener('DOMContentLoaded', init);
})();
