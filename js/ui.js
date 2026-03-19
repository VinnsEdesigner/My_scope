// ── UI.JS v1.1.3 PROPER ARCHITECTURE ──
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

        const simOnly = tab === 'sim';
        const chPills  = document.getElementById('chPills');
        const micBar   = document.getElementById('micBar');
        const simWrap  = document.getElementById('simChevronWrap');
        if (chPills) chPills.classList.toggle('visible', simOnly);
        if (micBar)  micBar.classList.toggle('visible', simOnly);
        if (simWrap) simWrap.classList.toggle('visible', simOnly);

        const simBtns  = document.getElementById('simBtns');
        const mainBtns = document.getElementById('mainBtns');
        if (simBtns)  simBtns.style.display  = simOnly ? ''  : 'none';
        if (mainBtns) mainBtns.style.display = simOnly ? 'none' : '';

        if (simOnly && !State.simMode) this._enterSimMode();
        if (!simOnly && State.simMode)  this._exitSimMode();

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

    // ── SIM MODE ──
    _enterSimMode() {
        State.simMode = true;
        if (!State.dataArray) {
            State.dataArray = new Uint8Array(State.fftSize);
            State.freqArray = new Uint8Array(State.fftSize / 2);
        }
        const dot = document.getElementById('statusDot');
        if (dot) { dot.classList.remove('active'); dot.classList.add('sim'); }
        document.getElementById('statusTxt').innerText = 'SIM';
        
        // ✅ Init mic stream when entering SIM mode (stays on, we just choose when to use it)
        App.initMicStream();
        
        App.startLoop();
    },

    _exitSimMode() {
        State.simMode = false;
        State.sim.playing = false;
        App.stopLoop();
        const dot = document.getElementById('statusDot');
        if (dot) { dot.classList.remove('sim'); }
        if (State.isRunning) {
            document.getElementById('statusTxt').innerText = 'LIVE';
            document.getElementById('statusDot').classList.add('active');
            App.startLoop();
        } else {
            document.getElementById('statusTxt').innerText = 'STANDBY';
            App.drawIdle();
        }
    },

    // ✅ CHANNEL TOGGLE
    toggleChannel(ch) {
        if (ch === 1) {
            State.sim.ch1Enabled = !State.sim.ch1Enabled;
            const pill = document.getElementById('pill1');
            const btn  = document.getElementById('ch1Toggle');
            if (pill) pill.classList.toggle('off', !State.sim.ch1Enabled);
            if (btn) {
                btn.innerText = State.sim.ch1Enabled ? 'ON' : 'OFF';
                btn.classList.toggle('active', State.sim.ch1Enabled);
            }
        } else if (ch === 2) {
            State.sim.ch2Enabled = !State.sim.ch2Enabled;
            const pill = document.getElementById('pill2');
            const btn  = document.getElementById('ch2Toggle');
            if (pill) pill.classList.toggle('off', !State.sim.ch2Enabled);
            if (btn) {
                btn.innerText = State.sim.ch2Enabled ? 'ON' : 'OFF';
                btn.classList.toggle('active', State.sim.ch2Enabled);
            }
        } else if (ch === 3) {
            State.sim.ch3Enabled = !State.sim.ch3Enabled;
            const pill = document.getElementById('pill3');
            const btn  = document.getElementById('ch3Toggle');
            if (pill) pill.classList.toggle('off', !State.sim.ch3Enabled);
            if (btn) {
                btn.innerText = State.sim.ch3Enabled ? 'ON' : 'OFF';
                btn.classList.toggle('active', State.sim.ch3Enabled);
            }
        }
    },

    // ✅ CH2 SOURCE TOGGLE (mic or file) - replaces toggleMic()
    toggleCH2Source() {
        const btn = document.getElementById('micToggleBtn');
        const dot = document.getElementById('micDot');
        const lbl = document.getElementById('micBarLabel');
        
        // Toggle between 'mic' and 'file'
        if (State.sim.ch2Source === 'mic') {
            State.sim.ch2Source = 'file';
            if (btn) { btn.classList.remove('on'); btn.classList.add('off'); btn.innerText = '∨ FILE'; }
            if (dot) dot.style.background = '#ff6d00'; // Orange for file mode
            if (lbl) lbl.innerText = 'CH2 FILE — playback mode';
        } else {
            State.sim.ch2Source = 'mic';
            if (btn) { btn.classList.remove('off'); btn.classList.add('on'); btn.innerText = '∨ MIC'; }
            if (dot) dot.style.background = '#00ff41'; // Green for mic mode
            if (lbl) lbl.innerText = 'CH2 MIC ● live capture';
        }
    },

    // ── SIM CONTROLS ──
    setSimWave(type) {
        State.sim.waveType = type;
        State.sim.phase_acc = 0;
        document.querySelectorAll('.wave-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.wave === type);
        });
        document.querySelectorAll('[data-wave]').forEach(b => {
            if (b.classList.contains('mbtn-sel')) {
                b.classList.toggle('active', b.dataset.wave === type);
            }
        });
        const dutyRow = document.getElementById('dutyRow');
        if (dutyRow) {
            dutyRow.style.display = (type === 'pwm' || type === 'square') ? 'flex' : 'none';
        }
    },

    setSimFreq(val) {
        State.sim.frequency = parseFloat(val);
        document.querySelectorAll('#simFreqVal, #simFreqValMenu').forEach(el => {
            if (el) el.innerText = val >= 1000
                ? (val / 1000).toFixed(2) + 'kHz'
                : Math.round(val) + 'Hz';
        });
    },

    setSimAmp(val) {
        State.sim.amplitude = parseFloat(val);
        document.querySelectorAll('#simAmpVal, #simAmpValMenu').forEach(el => {
            if (el) el.innerText = parseFloat(val).toFixed(2);
        });
    },

    setSimPhase(val) {
        State.sim.phase = parseFloat(val);
        document.querySelectorAll('#simPhaseVal, #simPhaseValMenu').forEach(el => {
            if (el) el.innerText = Math.round(val) + '°';
        });
    },

    setSimDuty(val) {
        State.sim.dutyCycle = parseFloat(val) / 100;
        document.querySelectorAll('#simDutyVal, #simDutyValMenu').forEach(el => {
            if (el) el.innerText = Math.round(val) + '%';
        });
    },

    toggleSimPlay() {
        State.sim.playing = !State.sim.playing;
        const btn = document.getElementById('simPlayBtn');
        if (btn) {
            btn.innerText  = State.sim.playing ? '⏸ PAUSE' : '▶ PLAY';
            btn.className  = State.sim.playing ? 'btn-primary' : 'btn-secondary';
        }
    },

    stopSim() {
        State.sim.playing   = false;
        State.sim.phase_acc = 0;
        const btn = document.getElementById('simPlayBtn');
        if (btn) { btn.innerText = '▶ PLAY'; btn.className = 'btn-secondary'; }
    },

    // ── CHEVRON PANEL ──
    toggleSimChevron() {
        const content  = document.getElementById('simChevronContent');
        const strip    = document.getElementById('simCollapsedStrip');
        const chevron  = document.getElementById('simChevronIcon');
        const expanded = content && content.style.display !== 'none';

        if (content) content.style.display = expanded ? 'none' : 'flex';
        if (strip)   strip.style.display   = expanded ? 'flex' : 'none';
        if (chevron) chevron.innerText      = expanded ? '∨' : '∧';
        App.resize();
    },

    // ── SIM SOURCE ──
    setSimSource(src) {
        State.sim.ch2Source = src; // ✅ Set ch2Source directly
        
        document.querySelectorAll('.src-btn').forEach(b => {
            b.className = 'src-btn' + (b.dataset.src === src
                ? (src === 'synth' ? ' active-synth' : ' active-file')
                : '');
        });
        document.querySelectorAll('[data-src]').forEach(b => {
            if (b.classList.contains('mbtn-sel')) {
                b.classList.toggle('active', b.dataset.src === src);
            }
        });
        
        const synthPanel = document.getElementById('simSynthPanel');
        const filePanel  = document.getElementById('simFilePanel');
        if (synthPanel) synthPanel.style.display = src === 'synth' ? 'flex' : 'none';
        if (filePanel)  filePanel.style.display  = src === 'file'  ? 'flex' : 'none';
        
        // ✅ Update mic bar label
        const lbl = document.getElementById('micBarLabel');
        if (lbl) {
            lbl.innerText = src === 'mic' ? 'CH2 MIC ● live capture' : 'CH2 FILE — playback mode';
        }
    },

    // ── FILE PICKER ──
    loadSimFile() {
        const picker = document.getElementById('simFilePicker');
        if (picker) picker.click();
    },

    onSimFileSelected(input) {
        if (!input.files || !input.files[0]) return;
        const file = input.files[0];
        
        document.querySelectorAll('#simFileName, #simFileNameMenu').forEach(el => {
            if (el) {
                el.innerText = file.name;
                el.classList.remove('empty');
            }
        });
        
        AudioLoader.loadFile(file);
        
        // ✅ Auto-switch to file source when file loaded
        State.sim.ch2Source = 'file';
        this.setSimSource('file');
    },

    // ── RECORD TOGGLE ──
    async toggleSimRecord() {
        await AudioLoader.toggleRecord();
    },

    // ── EXISTING CONTROLS ──
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
        const sr = State.simMode ? State.simSampleRate : (State.audioCtx ? State.audioCtx.sampleRate : null);
        if (sr && State.dataArray) {
            const spd  = (ms / 1000) * sr;
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

        const maxIdx = VOLT_DIV_STEPS.length - 1;
        State.gain = 10 - (State.voltDivIndex / maxIdx) * 9;
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

    setTheme(theme) {
        State.theme = 'dark';
        document.documentElement.setAttribute('data-theme', 'dark');
        document.querySelectorAll('.theme-btn[data-theme]').forEach(b => {
            b.classList.toggle('active', b.dataset.theme === 'dark');
        });
    },

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
        document.documentElement.style.setProperty('--amber', color);
        this._swatch('meas', color);
    },

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
        document.documentElement.style.setProperty('--settings-fs', (15 * State.settingsFontSize / 100) + 'px');
        const el = document.getElementById('settingsSizeVal');
        if (el) el.innerText = v + '%';
    },

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
        document.documentElement.style.setProperty('--scope-fs', (15 * State.scopeFontSize / 100) + 'px');
        const el = document.getElementById('scopeSizeVal');
        if (el) el.innerText = v + '%';
    },

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
        const el = document.getElementById('infoSizeVal');
        if (el) el.innerText = v + '%';
    },

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
