// ── UI.JS v1.0.5 — FONT SIZE PROPERLY FIXED ──
const UI = {

    toggleMenu() {
        document.getElementById('sideMenu').classList.toggle('open');
        document.getElementById('menuOverlay').classList.toggle('open');
    },

    switchTab(tab) {
        State.currentTab = tab;
        document.querySelectorAll('.tab').forEach(t => {
            t.classList.toggle('active', t.dataset.tab === tab);
        });
        App.resize();
    },

    switchMenuTab(tab) {
        document.querySelectorAll('.mtab').forEach(t => {
            t.classList.toggle('active', t.dataset.mtab === tab);
        });
        document.querySelectorAll('.mpanel').forEach(p => {
            p.classList.toggle('active', p.id === 'mpanel-' + tab);
        });
    },

    togglePause() {
        State.paused = !State.paused;
        const btn = document.getElementById('pauseBtn');
        btn.innerText = State.paused ? '▶ RESUME' : '⏸ PAUSE';
        btn.className = State.paused ? 'btn-secondary' : 'btn-primary';
        document.getElementById('statusTxt').innerText = State.paused ? 'PAUSED' : 'LIVE';
        if (State.paused) document.getElementById('statusDot').classList.remove('active');
        else              document.getElementById('statusDot').classList.add('active');
    },

    updateZoom(v) {
        State.zoom = parseFloat(v);
        document.getElementById('zoomVal').innerText = State.zoom.toFixed(1) + 'x';
    },

    updateGain(v) {
        State.gain = parseFloat(v);
        document.getElementById('gainVal').innerText = State.gain.toFixed(1) + 'x';
    },

    updateSmoothing(v) {
        State.smoothing = parseFloat(v);
        if (State.analyser) State.analyser.smoothingTimeConstant = State.smoothing;
        document.getElementById('smoothVal').innerText = State.smoothing.toFixed(2);
    },

    adjustFFTSize(dir) {
        const sizes = [512, 1024, 2048, 4096, 8192];
        let idx = sizes.indexOf(State.fftSize);
        idx = Math.max(0, Math.min(sizes.length - 1, idx + dir));
        State.fftSize = sizes[idx];
        document.getElementById('fftSizeVal').innerText = State.fftSize;
        if (State.analyser) {
            State.analyser.fftSize = State.fftSize;
            State.dataArray = new Uint8Array(State.analyser.fftSize);
            State.freqArray = new Uint8Array(State.analyser.frequencyBinCount);
            const bFft = document.getElementById('bFftSize');
            if (bFft) bFft.innerText = State.fftSize;
            const bRes = document.getElementById('bFreqRes');
            if (bRes && State.audioCtx)
                bRes.innerText = (State.audioCtx.sampleRate / State.fftSize).toFixed(2) + 'Hz';
        }
    },

    adjustTimeDiv(dir) {
        if (State.timeDivIndex === null)
            State.timeDivIndex = Math.floor(TIME_DIV_STEPS.length / 2);
        State.timeDivIndex = Math.max(0, Math.min(TIME_DIV_STEPS.length - 1, State.timeDivIndex + dir));
        const ms    = TIME_DIV_STEPS[State.timeDivIndex];
        const label = ms >= 1 ? ms.toFixed(0) + 'ms' : (ms * 1000).toFixed(0) + 'µs';
        document.getElementById('timeDivVal').innerText = label;
        const menu = document.getElementById('timeDivValMenu');
        if (menu) menu.innerText = label;
        if (State.audioCtx && State.dataArray) {
            const spd  = (ms / 1000) * State.audioCtx.sampleRate;
            State.zoom = Math.max(1, Math.min(8, State.dataArray.length / (spd * 10)));
            document.getElementById('zoomSlider').value  = State.zoom;
            document.getElementById('zoomVal').innerText = State.zoom.toFixed(1) + 'x';
        }
    },

    adjustVoltDiv(dir) {
        if (State.voltDivIndex === null)
            State.voltDivIndex = Math.floor(VOLT_DIV_STEPS.length / 2);
        State.voltDivIndex = Math.max(0, Math.min(VOLT_DIV_STEPS.length - 1, State.voltDivIndex + dir));
        const v     = VOLT_DIV_STEPS[State.voltDivIndex];
        const label = v.toFixed(2) + 'V';
        document.getElementById('voltDivVal').innerText = label;
        const menu = document.getElementById('voltDivValMenu');
        if (menu) menu.innerText = label;
        State.gain = Math.max(1, Math.min(10, 1 / (v * 4)));
        document.getElementById('gainSlider').value  = State.gain;
        document.getElementById('gainVal').innerText = State.gain.toFixed(1) + 'x';
    },

    captureSnapshot() {
        const canvas = document.getElementById('scopeCanvas');
        const link   = document.createElement('a');
        link.download = `labscope_${Date.now()}.png`;
        link.href     = canvas.toDataURL('image/png');
        link.click();
    },

    // ══ THEME ══
    setTheme(theme) {
        State.theme = theme;
        document.documentElement.setAttribute('data-theme', theme);
        document.querySelectorAll('.theme-btn[data-theme]').forEach(b => {
            b.classList.toggle('active', b.dataset.theme === theme);
        });
    },

    // ══ CANVAS COLORS ══
    setWaveColor(color) {
        State.waveColor = color;
        this._swatch('wave', color);
    },

    setGridColor(color) {
        State.gridColor = color;
        this._swatch('grid', color);
    },

    setMeasColor(color) {
        State.measColor = color;
        document.documentElement.style.setProperty('--cyan', color);
        this._swatch('meas', color);
    },

    // ══ SETTINGS SECTION ══
    setSettingsTextColor(color) {
        State.settingsTextColor = color;
        document.documentElement.style.setProperty('--text-mid',  color);
        document.documentElement.style.setProperty('--text-main', color);
        this._swatch('settings-text', color);
    },

    setSettingsFont(font) {
        State.settingsFont = font;
        const sideMenu = document.getElementById('sideMenu');
        if (sideMenu) sideMenu.style.fontFamily = FONT_MAP[font] || FONT_MAP.retro;
        this._font('settings-font', font);
    },

    setSettingsFontSize(v) {
        State.settingsFontSize = parseInt(v);
        // FIXED: Update CSS variable instead of fighting inline styles
        document.documentElement.style.setProperty('--settings-fs', (15 * State.settingsFontSize / 100) + 'px');
        const el = document.getElementById('settingsSizeVal');
        if (el) el.innerText = v + '%';
    },

    // ══ SCOPE SECTION ══
    setScopeTextColor(color) {
        State.scopeTextColor = color;
        document.documentElement.style.setProperty('--neon',      color);
        document.documentElement.style.setProperty('--neon-glow', color + '55');
        this._swatch('scope-text', color);
    },

    setScopeFont(font) {
        State.scopeFont = font;
        document.documentElement.style.setProperty('--font-display', FONT_MAP[font] || FONT_MAP.retro);
        document.documentElement.style.setProperty('--font-scope',   FONT_MAP[font] || FONT_MAP.retro);
        this._font('scope-font', font);
    },

    setScopeFontSize(v) {
        State.scopeFontSize = parseInt(v);
        // FIXED: Update CSS variable instead of fighting inline styles
        document.documentElement.style.setProperty('--scope-fs', (15 * State.scopeFontSize / 100) + 'px');
        const el = document.getElementById('scopeSizeVal');
        if (el) el.innerText = v + '%';
    },

    // ══ INFO SECTION ══
    setInfoTextColor(color) {
        State.infoTextColor = color;
        this._swatch('info-text', color);
    },

    setInfoFont(font) {
        State.infoFont = font;
        document.documentElement.style.setProperty('--font-data', FONT_MAP[font] || FONT_MAP.mono);
        this._font('info-font', font);
    },

    setInfoFontSize(v) {
        State.infoFontSize = parseInt(v);
        // Info view uses this value directly in fft.js InfoView.drawOverlay
        const el = document.getElementById('infoSizeVal');
        if (el) el.innerText = v + '%';
    },

    // ══ HELPERS ══
    _swatch(group, value) {
        document.querySelectorAll(`.swatch-btn[data-group="${group}"]`).forEach(b => {
            b.classList.toggle('active', b.dataset.color === value);
        });
    },

    _font(group, value) {
        document.querySelectorAll(`.font-pick-btn[data-group="${group}"]`).forEach(b => {
            b.classList.toggle('active', b.dataset.font === value);
        });
    },
};
