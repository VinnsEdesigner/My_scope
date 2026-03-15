// ── UI.JS v1.0.1 ──
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
        // show inline osc controls ONLY on osc tab
        const osc = document.getElementById('oscControls');
        if (osc) osc.style.display = tab === 'osc' ? 'flex' : 'none';
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
            const b = document.getElementById('bFftSize');
            if (b) b.innerText = State.fftSize;
            const r = document.getElementById('bFreqRes');
            if (r && State.audioCtx)
                r.innerText = (State.audioCtx.sampleRate / State.fftSize).toFixed(2) + 'Hz';
        }
    },

    adjustTimeDiv(dir) {
        if (State.timeDivIndex === null)
            State.timeDivIndex = Math.floor(TIME_DIV_STEPS.length / 2);
        State.timeDivIndex = Math.max(0, Math.min(TIME_DIV_STEPS.length - 1, State.timeDivIndex + dir));
        const ms = TIME_DIV_STEPS[State.timeDivIndex];
        const label = ms >= 1 ? ms.toFixed(0) + 'ms' : (ms * 1000).toFixed(0) + 'µs';
        document.getElementById('timeDivVal').innerText = label;
        if (State.audioCtx && State.dataArray) {
            const samplesPerDiv = (ms / 1000) * State.audioCtx.sampleRate;
            State.zoom = Math.max(1, Math.min(8,
                State.dataArray.length / (samplesPerDiv * 10)));
            document.getElementById('zoomSlider').value = State.zoom;
            document.getElementById('zoomVal').innerText = State.zoom.toFixed(1) + 'x';
        }
    },

    adjustVoltDiv(dir) {
        if (State.voltDivIndex === null)
            State.voltDivIndex = Math.floor(VOLT_DIV_STEPS.length / 2);
        State.voltDivIndex = Math.max(0, Math.min(VOLT_DIV_STEPS.length - 1, State.voltDivIndex + dir));
        const v = VOLT_DIV_STEPS[State.voltDivIndex];
        document.getElementById('voltDivVal').innerText = v.toFixed(2) + 'V';
        State.gain = Math.max(1, Math.min(10, 1 / (v * 4)));
        document.getElementById('gainSlider').value = State.gain;
        document.getElementById('gainVal').innerText = State.gain.toFixed(1) + 'x';
    },

    captureSnapshot() {
        const canvas = document.getElementById('scopeCanvas');
        const link   = document.createElement('a');
        link.download = `labscope_${Date.now()}.png`;
        link.href     = canvas.toDataURL('image/png');
        link.click();
    },

    // ── THEME ──
    setTheme(theme) {
        State.theme = theme;
        document.documentElement.setAttribute('data-theme', theme);
        document.querySelectorAll('.theme-btn[data-theme]').forEach(b => {
            b.classList.toggle('active', b.dataset.theme === theme);
        });
        // light theme — hide font theme pickers, force black
        const fontSection = document.getElementById('fontThemeSection');
        if (fontSection) {
            fontSection.style.display = theme === 'light' ? 'none' : 'block';
        }
    },

    // ── PER-SECTION FONTS ──
    setFontSettings(font) {
        State.fontSettings = font;
        const f = FONT_MAP[font];
        document.documentElement.style.setProperty('--font-settings-display', f);
        document.documentElement.style.setProperty('--font-settings-body', f);
        this._markFontBtn('settings', font);
    },

    setFontScope(font) {
        State.fontScope = font;
        const f = FONT_MAP[font];
        document.documentElement.style.setProperty('--font-scope-display', f);
        document.documentElement.style.setProperty('--font-scope-body', f);
        document.documentElement.style.setProperty('--font-display', f);
        document.documentElement.style.setProperty('--font-ui', f);
        this._markFontBtn('scope', font);
    },

    setFontInfo(font) {
        State.fontInfo = font;
        const f = FONT_MAP[font];
        document.documentElement.style.setProperty('--font-info-display', f);
        document.documentElement.style.setProperty('--font-info-body', f);
        document.documentElement.style.setProperty('--font-data', f);
        this._markFontBtn('info', font);
    },

    _markFontBtn(section, font) {
        document.querySelectorAll(`.font-btn-${section}`).forEach(b => {
            b.classList.toggle('active', b.dataset.font === font);
        });
    },

    // ── FONT SIZE ──
    updateFontSize(v) {
        State.fontSizeScale = parseFloat(v);
        document.documentElement.style.setProperty('--font-size-scale', State.fontSizeScale);
        document.getElementById('fontSizeVal').innerText = Math.round(State.fontSizeScale * 100) + '%';
    },
};
