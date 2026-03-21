// ── PERSIST.JS v1.0.2 ──
// Session persistence for Lab Scope PRO
// Layer 1: localStorage  — lightweight state, saves on every change
// Layer 2: IndexedDB     — heavy binary data (PCM buffers, analyser result)

const Persist = {

    _DB_NAME:    'labscope-db',
    _DB_VERSION: 1,
    _STORE:      'session',
    _db:         null,
    _saveTimer:  null,
    _DEBOUNCE:   300,

    // ══════════════════════════════════════
    // INDEXEDDB SETUP
    // ══════════════════════════════════════
    _openDB() {
        return new Promise((resolve) => {
            if (this._db) { resolve(this._db); return; }

            const req = indexedDB.open(this._DB_NAME, this._DB_VERSION);

            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(this._STORE)) {
                    db.createObjectStore(this._STORE);
                }
            };

            req.onsuccess = (e) => {
                this._db = e.target.result;
                resolve(this._db);
            };

            req.onerror = () => {
                console.warn('Persist: IndexedDB open failed');
                resolve(null); // non-fatal — localStorage still works
            };
        });
    },

    _idbSet(key, value) {
        if (!this._db) return Promise.resolve();
        return new Promise((resolve) => {
            try {
                const tx    = this._db.transaction(this._STORE, 'readwrite');
                const store = tx.objectStore(this._STORE);
                store.put(value, key);
                tx.oncomplete = () => resolve();
                tx.onerror    = () => resolve();
            } catch(e) { resolve(); }
        });
    },

    _idbGet(key) {
        if (!this._db) return Promise.resolve(null);
        return new Promise((resolve) => {
            try {
                const tx    = this._db.transaction(this._STORE, 'readonly');
                const store = tx.objectStore(this._STORE);
                const req   = store.get(key);
                req.onsuccess = () => resolve(req.result ?? null);
                req.onerror   = () => resolve(null);
            } catch(e) { resolve(null); }
        });
    },

    _idbDelete(key) {
        if (!this._db) return Promise.resolve();
        return new Promise((resolve) => {
            try {
                const tx    = this._db.transaction(this._STORE, 'readwrite');
                const store = tx.objectStore(this._STORE);
                store.delete(key);
                tx.oncomplete = () => resolve();
                tx.onerror    = () => resolve();
            } catch(e) { resolve(); }
        });
    },

    // ══════════════════════════════════════
    // SESSION CHECK
    // ══════════════════════════════════════
    hasSession() {
        return !!localStorage.getItem('labscope_session');
    },

    // ══════════════════════════════════════
    // LOCALSTORAGE SAVE
    // ══════════════════════════════════════
    saveToLocalStorage() {
        try {
            const s = State;
            const data = {
                currentTab:        s.currentTab,
                ch1Source:         s.ch1Source,
                ch2Source:         s.ch2Source,
                ch1Gain:           s.ch1Gain,
                ch2Gain:           s.ch2Gain,
                ch2Offset:         s.ch2Offset,
                zoom:              s.zoom,
                gain:              s.gain,
                smoothing:         s.smoothing,
                fftSize:           s.fftSize,
                timeDivIndex:      s.timeDivIndex,
                voltDivIndex:      s.voltDivIndex,
                simSampleRate:     s.simSampleRate,
                waveColor:         s.waveColor,
                gridColor:         s.gridColor,
                measColor:         s.measColor,
                settingsTextColor: s.settingsTextColor,
                settingsFont:      s.settingsFont,
                settingsFontSize:  s.settingsFontSize,
                scopeTextColor:    s.scopeTextColor,
                scopeFont:         s.scopeFont,
                scopeFontSize:     s.scopeFontSize,
                infoTextColor:     s.infoTextColor,
                infoFont:          s.infoFont,
                infoFontSize:      s.infoFontSize,
                triggerEnabled:    s.triggerEnabled,
                triggerMode:       s.triggerMode,
                triggerEdge:       s.triggerEdge,
                triggerUpper:      s.triggerUpper,
                triggerLower:      s.triggerLower,
                calibFreq:         s.calibFreq,
                calibVpp:          s.calibVpp,
                bodeStartHz:       s.bode.startHz,
                bodeStopHz:        s.bode.stopHz,
                bodeSteps:         s.bode.steps,
                simWaveType:       s.sim.waveType,
                simFrequency:      s.sim.frequency,
                simAmplitude:      s.sim.amplitude,
                simPhase:          s.sim.phase,
                simDutyCycle:      s.sim.dutyCycle,
                simCh1Enabled:     s.sim.ch1Enabled,
                simCh2Enabled:     s.sim.ch2Enabled,
                simCh3Enabled:     s.sim.ch3Enabled,
                artifacts:         { ...Artifacts.params },
            };
            localStorage.setItem('labscope_session', JSON.stringify(data));
        } catch(e) {
            console.warn('Persist.saveToLocalStorage failed:', e);
        }
    },

    // ══════════════════════════════════════
    // LOCALSTORAGE RESTORE
    // Called synchronously at boot BEFORE UI renders
    // ══════════════════════════════════════
    restoreFromLocalStorage() {
        try {
            const raw = localStorage.getItem('labscope_session');
            if (!raw) return false; // first ever launch

            const d = JSON.parse(raw);
            const s = State;

            if (d.currentTab)           s.currentTab    = d.currentTab;
            if (d.ch1Source)            s.ch1Source     = d.ch1Source;
            if (d.ch2Source)            s.ch2Source     = d.ch2Source;

            if (d.ch1Gain    != null)   s.ch1Gain       = d.ch1Gain;
            if (d.ch2Gain    != null)   s.ch2Gain       = d.ch2Gain;
            if (d.ch2Offset  != null)   s.ch2Offset     = d.ch2Offset;
            if (d.zoom       != null)   s.zoom          = d.zoom;
            if (d.gain       != null)   s.gain          = d.gain;
            if (d.smoothing  != null)   s.smoothing     = d.smoothing;
            if (d.fftSize    != null)   s.fftSize       = d.fftSize;
            if (d.simSampleRate != null) s.simSampleRate = d.simSampleRate;

            // Clamp index values to prevent out-of-bounds array access
            if (d.timeDivIndex != null) {
                s.timeDivIndex = Math.max(0,
                    Math.min(TIME_DIV_STEPS.length - 1, d.timeDivIndex));
            }
            if (d.voltDivIndex != null) {
                s.voltDivIndex = Math.max(0,
                    Math.min(VOLT_DIV_STEPS.length - 1, d.voltDivIndex));
            }

            if (d.waveColor)            s.waveColor          = d.waveColor;
            if (d.gridColor)            s.gridColor          = d.gridColor;
            if (d.measColor)            s.measColor          = d.measColor;
            if (d.settingsTextColor)    s.settingsTextColor  = d.settingsTextColor;
            if (d.settingsFont)         s.settingsFont       = d.settingsFont;
            if (d.settingsFontSize != null) s.settingsFontSize = d.settingsFontSize;
            if (d.scopeTextColor)       s.scopeTextColor     = d.scopeTextColor;
            if (d.scopeFont)            s.scopeFont          = d.scopeFont;
            if (d.scopeFontSize != null) s.scopeFontSize     = d.scopeFontSize;
            if (d.infoTextColor)        s.infoTextColor      = d.infoTextColor;
            if (d.infoFont)             s.infoFont           = d.infoFont;
            if (d.infoFontSize != null) s.infoFontSize       = d.infoFontSize;

            if (d.triggerEnabled != null) s.triggerEnabled   = d.triggerEnabled;
            if (d.triggerMode)            s.triggerMode      = d.triggerMode;
            if (d.triggerEdge)            s.triggerEdge      = d.triggerEdge;
            if (d.triggerUpper != null)   s.triggerUpper     = d.triggerUpper;
            if (d.triggerLower != null)   s.triggerLower     = d.triggerLower;

            if (d.calibFreq != null)    s.calibFreq         = d.calibFreq;
            if (d.calibVpp  != null)    s.calibVpp          = d.calibVpp;

            if (d.bodeStartHz != null)  s.bode.startHz      = d.bodeStartHz;
            if (d.bodeStopHz  != null)  s.bode.stopHz       = d.bodeStopHz;
            if (d.bodeSteps   != null)  s.bode.steps        = d.bodeSteps;

            if (d.simWaveType)          s.sim.waveType      = d.simWaveType;
            if (d.simFrequency  != null) s.sim.frequency    = d.simFrequency;
            if (d.simAmplitude  != null) s.sim.amplitude    = d.simAmplitude;
            if (d.simPhase      != null) s.sim.phase        = d.simPhase;
            if (d.simDutyCycle  != null) s.sim.dutyCycle    = d.simDutyCycle;

            // Never restore playing=true — user must tap PLAY explicitly
            s.sim.playing = false;

            if (d.simCh1Enabled != null) s.sim.ch1Enabled   = d.simCh1Enabled;
            if (d.simCh2Enabled != null) s.sim.ch2Enabled   = d.simCh2Enabled;
            if (d.simCh3Enabled != null) s.sim.ch3Enabled   = d.simCh3Enabled;

            if (d.artifacts && typeof d.artifacts === 'object') {
                Object.keys(Artifacts.params).forEach(k => {
                    if (d.artifacts[k] != null) Artifacts.params[k] = d.artifacts[k];
                });
            }

            return true; // session existed
        } catch(e) {
            console.warn('Persist.restoreFromLocalStorage failed:', e);
            return false;
        }
    },

    // ══════════════════════════════════════
    // INDEXEDDB SAVE
    // ══════════════════════════════════════
    async saveCH1Buffer(float32Array, filename) {
        if (!float32Array) return;
        if (!this._db) await this._openDB();
        await this._idbSet('ch1PcmBuffer', float32Array);
        localStorage.setItem('labscope_ch1FileName', filename || '');
        this.saveToLocalStorage();
    },

    async saveCH2Buffer(float32Array, filename) {
        if (!float32Array) return;
        if (!this._db) await this._openDB();
        await this._idbSet('ch2PcmBuffer', float32Array);
        localStorage.setItem('labscope_ch2FileName', filename || '');
        this.saveToLocalStorage();
    },

    async saveAnalyserResult(result) {
        if (!result) return;
        if (!this._db) await this._openDB();
        try {
            await this._idbSet('analyserResult', JSON.stringify(result));
        } catch(e) {
            console.warn('Persist.saveAnalyserResult failed:', e);
        }
    },

    async clearCH1Buffer() {
        await this._idbDelete('ch1PcmBuffer');
        localStorage.removeItem('labscope_ch1FileName');
    },

    async clearCH2Buffer() {
        await this._idbDelete('ch2PcmBuffer');
        localStorage.removeItem('labscope_ch2FileName');
    },

    // ══════════════════════════════════════
    // INDEXEDDB RESTORE
    // Called async at boot — does not block UI
    // ══════════════════════════════════════
    async restoreFromIndexedDB() {
        if (!this._db) await this._openDB();
        try {
            // Restore CH1 PCM buffer
            const ch1Raw = await this._idbGet('ch1PcmBuffer');
            const ch1Buf = this._toFloat32(ch1Raw);
            if (ch1Buf) {
                AudioLoader._pcmBufferCH1 = ch1Buf;
                AudioLoader._playheadCH1  = 0;
                const ch1Name = localStorage.getItem('labscope_ch1FileName') || 'restored file';
                this._updateFilenameDisplay('ch1', ch1Name);
                // Update CH1 source status now file is loaded
                if (typeof UI !== 'undefined') UI._updateCH1Status();
            }

            // Restore CH2 PCM buffer
            const ch2Raw = await this._idbGet('ch2PcmBuffer');
            const ch2Buf = this._toFloat32(ch2Raw);
            if (ch2Buf) {
                AudioLoader._pcmBuffer = ch2Buf;
                AudioLoader._playhead  = 0;
                const ch2Name = localStorage.getItem('labscope_ch2FileName') || 'restored file';
                this._updateFilenameDisplay('ch2', ch2Name);
                if (typeof UI !== 'undefined') UI._updateCH2Status();
            }

            // Restore analyser result
            const arRaw = await this._idbGet('analyserResult');
            if (arRaw && typeof arRaw === 'string') {
                try {
                    State.analyserResult = JSON.parse(arRaw);
                } catch(e) {
                    State.analyserResult = null;
                }
            }

        } catch(e) {
            console.warn('Persist.restoreFromIndexedDB failed:', e);
        }
    },

    // ══════════════════════════════════════
    // CLEAR ALL — hard reset
    // ══════════════════════════════════════
    async clearAll() {
        try {
            localStorage.removeItem('labscope_session');
            localStorage.removeItem('labscope_ch1FileName');
            localStorage.removeItem('labscope_ch2FileName');
            if (!this._db) await this._openDB();
            await this._idbDelete('ch1PcmBuffer');
            await this._idbDelete('ch2PcmBuffer');
            await this._idbDelete('analyserResult');
        } catch(e) {
            console.warn('Persist.clearAll failed:', e);
        }
    },

    // ══════════════════════════════════════
    // SAVE TRIGGERS
    // ══════════════════════════════════════

    // Debounced 300ms — for sliders (oninput fires many times per second)
    scheduleSave() {
        if (this._saveTimer) clearTimeout(this._saveTimer);
        this._saveTimer = setTimeout(() => {
            this.saveToLocalStorage();
            this._saveTimer = null;
        }, this._DEBOUNCE);
    },

    // Immediate — for toggles, tab switches, source changes
    save() {
        if (this._saveTimer) {
            clearTimeout(this._saveTimer);
            this._saveTimer = null;
        }
        this.saveToLocalStorage();
    },

    // ══════════════════════════════════════
    // AUTO-START — check mic permission
    // Returns true if mic already granted
    // Handles iOS Safari gracefully (no permissions.query support)
    // ══════════════════════════════════════
    async checkMicPermission() {
        try {
            if (!navigator.permissions) {
                // No permissions API — fall back to session check
                return this.hasSession();
            }
            const result = await navigator.permissions.query({ name: 'microphone' });
            return result.state === 'granted';
        } catch(e) {
            // iOS Safari throws on 'microphone' query — use session as proxy
            return this.hasSession();
        }
    },

    // ══════════════════════════════════════
    // UI SYNC — apply restored State to DOM
    // Called after restoreFromLocalStorage()
    // Must run after all scripts loaded
    // ══════════════════════════════════════
    syncUIAfterRestore() {
        try {
            const s = State;

            // Sliders
            this._setSlider('zoomSlider',   s.zoom);
            this._setSlider('gainSlider',   s.gain);
            this._setSlider('smoothSlider', s.smoothing);

            // Slider display values
            this._setText('zoomVal',   s.zoom.toFixed(1) + 'x');
            this._setText('gainVal',   s.gain.toFixed(1) + 'x');
            this._setText('smoothVal', s.smoothing.toFixed(2));

            // FFT size
            this._setText('fftSizeVal', s.fftSize);
            this._setText('bFftSize',   s.fftSize);

            // Time/volt div
            if (s.timeDivIndex !== null) {
                const idx   = Math.max(0, Math.min(TIME_DIV_STEPS.length - 1, s.timeDivIndex));
                const ms    = TIME_DIV_STEPS[idx];
                const label = ms >= 1 ? ms.toFixed(0) + 'ms' : (ms * 1000).toFixed(0) + 'µs';
                this._setText('timeDivVal',     label);
                this._setText('timeDivValMenu', label);
            }
            if (s.voltDivIndex !== null) {
                const idx   = Math.max(0, Math.min(VOLT_DIV_STEPS.length - 1, s.voltDivIndex));
                const label = VOLT_DIV_STEPS[idx].toFixed(2) + 'V';
                this._setText('voltDivVal',     label);
                this._setText('voltDivValMenu', label);
            }

            // Trigger sliders
            this._setSlider('trigUpperSlider', s.triggerUpper * 100);
            this._setSlider('trigLowerSlider', s.triggerLower * 100);
            this._setText('trigUpperVal',
                (s.triggerUpper >= 0 ? '+' : '') + s.triggerUpper.toFixed(2) + 'V');
            this._setText('trigLowerVal',
                (s.triggerLower >= 0 ? '+' : '') + s.triggerLower.toFixed(2) + 'V');

            // Trigger button state
            if (s.triggerEnabled) {
                const btn = document.getElementById('triggerBtn');
                if (btn) { btn.innerText = '⚡ TRIG ON'; btn.className = 'btn-active'; }
            }

            // Trigger mode/edge buttons
            ['auto','normal','single'].forEach(m => {
                const el = document.getElementById('tmode-' + m);
                if (el) el.classList.toggle('active', m === s.triggerMode);
            });
            ['rising','falling','both'].forEach(e => {
                const el = document.getElementById('tedge-' + e);
                if (el) el.classList.toggle('active', e === s.triggerEdge);
            });

            // Calibration display
            this._setText('calibFreqResult', s.calibFreq.toFixed(3) + 'x');
            this._setText('calibVppResult',  s.calibVpp.toFixed(3)  + 'x');

            // Bode settings
            this._setText('bodeSweepStart',
                s.bode.startHz < 1000
                    ? s.bode.startHz + 'Hz'
                    : (s.bode.startHz / 1000).toFixed(0) + 'kHz');
            this._setText('bodeSweepStop',
                s.bode.stopHz < 1000
                    ? s.bode.stopHz + 'Hz'
                    : (s.bode.stopHz / 1000).toFixed(0) + 'kHz');

            // Sim params
            const freqLabel = s.sim.frequency >= 1000
                ? (s.sim.frequency / 1000).toFixed(2) + 'kHz'
                : s.sim.frequency + 'Hz';
            this._setText('simFreqVal',      freqLabel);
            this._setText('simFreqValMenu',  freqLabel);
            this._setText('simAmpVal',       s.sim.amplitude.toFixed(2));
            this._setText('simAmpValMenu',   s.sim.amplitude.toFixed(2));
            this._setText('simPhaseVal',     Math.round(s.sim.phase) + '°');
            this._setText('simPhaseValMenu', Math.round(s.sim.phase) + '°');
            this._setText('simDutyVal',      Math.round(s.sim.dutyCycle * 100) + '%');
            this._setText('simDutyValMenu',  Math.round(s.sim.dutyCycle * 100) + '%');

            // Wave buttons
            document.querySelectorAll('.wave-btn, .ss-wavebtn').forEach(b => {
                b.classList.toggle('active', b.dataset.wave === s.sim.waveType);
            });

            // Channel pills
            const pill1 = document.getElementById('pill1');
            const pill2 = document.getElementById('pill2');
            const pill3 = document.getElementById('pill3');
            if (pill1) pill1.classList.toggle('off', !s.sim.ch1Enabled);
            if (pill2) pill2.classList.toggle('off', !s.sim.ch2Enabled);
            if (pill3) pill3.classList.toggle('off', !s.sim.ch3Enabled);

            // Artifact display spans
            const artFmt = {
                dcOffset:    (v) => (v >= 0 ? '+' : '') + parseFloat(v).toFixed(2) + 'V',
                harmDistort: (v) => Math.round(v * 100) + '%',
                srcClip:     (v) => Math.round(v * 100) + '%',
                acCouple:    (v) => Math.round(v * 100) + '%',
                micBias:     (v) => parseFloat(v).toFixed(2) + 'V',
                asymClip:    (v) => Math.round(v * 100) + '%',
                agcPumping:  (v) => Math.round(v * 100) + '%',
                hpfCorner:   (v) => Math.round(v * 300) + 'Hz',
                rolloff:     (v) => Math.round(v * 100) + '%',
                noiseFloor:  (v) => Math.round(v * 100) + '%',
                quantize:    (v) => Math.round(16 - v * 12) + 'bit',
            };
            Object.entries(artFmt).forEach(([key, fmt]) => {
                const val = Artifacts.params[key];
                const el  = document.getElementById('art-' + key);
                if (el && val != null) el.innerText = fmt(val);
            });

            // Theme colors and fonts
            UI.setWaveColor(s.waveColor);
            UI.setGridColor(s.gridColor);
            UI.setMeasColor(s.measColor);
            UI.setSettingsTextColor(s.settingsTextColor);
            UI.setSettingsFont(s.settingsFont);
            UI.setSettingsFontSize(s.settingsFontSize);
            UI.setScopeTextColor(s.scopeTextColor);
            UI.setScopeFont(s.scopeFont);
            UI.setScopeFontSize(s.scopeFontSize);
            UI.setInfoTextColor(s.infoTextColor);
            UI.setInfoFont(s.infoFont);
            UI.setInfoFontSize(s.infoFontSize);

            // Source selectors
            UI.setCH1Source(s.ch1Source);
            UI.setCH2Source(s.ch2Source);

        } catch(e) {
            console.warn('Persist.syncUIAfterRestore failed:', e);
        }
    },

    // ══════════════════════════════════════
    // HELPERS
    // ══════════════════════════════════════
    _setText(id, val) {
        const el = document.getElementById(id);
        if (el && val != null) el.innerText = val;
    },

    _setSlider(id, val) {
        const el = document.getElementById(id);
        if (el && val != null) el.value = val;
    },

    // Convert IDB result to Float32Array safely
    // IDB may return Float32Array, ArrayBuffer, or object depending on browser
    _toFloat32(val) {
        if (!val) return null;
        if (val instanceof Float32Array) return val;
        if (val instanceof ArrayBuffer)  return new Float32Array(val);
        if (val.buffer instanceof ArrayBuffer) return new Float32Array(val.buffer);
        return null;
    },

    _updateFilenameDisplay(ch, name) {
        if (ch === 'ch1') {
            const el = document.getElementById('ch1FileName');
            if (el) { el.innerText = name; el.style.color = '#00e5ff'; }
        } else {
            ['simFileName', 'ch2FileName'].forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    el.innerText = name;
                    el.classList.remove('empty');
                    el.style.color = '#00e5ff';
                }
            });
        }
    },
};
