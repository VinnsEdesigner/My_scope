// ── APP.JS v1.3.0 — 100% MAIN THREAD, ZERO WORKER ──

window.onerror = function(msg, src, line, col, err) {
    document.body.insertAdjacentHTML('afterbegin',
        `<div style="position:fixed;top:0;left:0;right:0;background:#ff1744;color:#fff;
        padding:10px;font-size:12px;z-index:9999;font-family:monospace;word-break:break-all">
        ERR: ${msg} | Line ${line} | ${src?.split('/').pop()}</div>`
    );
    return false;
};

const App = {
    canvas: null,
    ctx:    null,

    _lastAnalyseTime: 0,
    _analyseInterval: 3000,   // run heavy analyser every 3s
    _micAnalyser:     null,
    _micDataArray:    null,

    // ══════════════════════════════════════
    // BOOT
    // ══════════════════════════════════════
    async init() {
        const hadSession = Persist.restoreFromLocalStorage();

        this.canvas = document.getElementById('scopeCanvas');
        this.ctx    = this.canvas.getContext('2d');
        window.addEventListener('resize', () => this.resize());
        this.resize();
        this.drawIdle();

        this._initializeTheme();
        Persist.syncUIAfterRestore();
        UI.switchTab(State.currentTab);
        Persist.restoreFromIndexedDB();

        State.ch2Data = null;
        State.ch3Data = null;

        if (hadSession) {
            const granted = await Persist.checkMicPermission();
            if (granted) {
                await Audio.initSilent();
                if (State.currentTab === 'sim') this.initMicStream();
                return;
            }
        }
        document.getElementById('splash').style.display = 'flex';
    },

    // ══════════════════════════════════════
    // MIC SETUP
    // ══════════════════════════════════════
    initMicStream() {
        if (!State.micSource || !State.audioCtx || this._micAnalyser) return;
        try {
            this._micAnalyser = State.audioCtx.createAnalyser();
            this._micAnalyser.fftSize              = State.fftSize;
            this._micAnalyser.smoothingTimeConstant = 0.3;
            State.micSource.connect(this._micAnalyser);
            this._micDataArray = new Uint8Array(this._micAnalyser.fftSize);
        } catch (err) { console.error('initMicStream failed:', err); }
    },

    // ══════════════════════════════════════
    // RENDER LOOP — all DSP inline, zero workers
    // ══════════════════════════════════════
    startLoop() {
        let frame = 0;
        const tick = () => {
            State.animId = requestAnimationFrame(tick);
            if (State.paused) return;
            frame++;

            const w = this.canvas.width;
            const h = this.canvas.height;

            // ── SIM MODE ──────────────────────────
            if (State.simMode) {
                if (!State.sim.playing) return;

                if (!State.dataArray) State.dataArray = new Uint8Array(State.fftSize);
                if (!State.ch2Data)   State.ch2Data   = new Uint8Array(State.fftSize);
                if (!State.freqArray) State.freqArray = new Uint8Array(State.fftSize / 2);

                // CH1
                this._handleCH1();

                // CH2 — synth generated inline
                if (State.sim.ch2Enabled) this._handleCH2();

                // Measurements (every frame, fast)
                const meas = dspMeasure(
                    State.dataArray, State.freqArray,
                    State.simSampleRate, State.fftSize,
                    State.calibFreq, State.calibVpp,
                    true, State.sim.frequency
                );
                Measurements.applyWorkerResult(meas);

                // Classify (every 8 frames)
                if (frame % 8 === 0) {
                    const cl = dspClassify(State.dataArray, State.simSampleRate);
                    SignalDetect.updateBadge(cl.type);
                }

                // Artifacts (every frame if active)
                if (this._hasArtifacts()) {
                    const aOut = applyArtifacts(State.dataArray, Artifacts.params, State.simSampleRate);
                    State.dataArray.set(aOut);
                }

                // CH3 correction (every frame if enabled + result exists)
                if (State.sim.ch3Enabled && State.ch2Data && State.analyserResult) {
                    const c3 = dspCorrect(State.ch2Data, State.analyserResult, State.simSampleRate);
                    if (!State.ch3Data) State.ch3Data = new Uint8Array(State.fftSize);
                    State.ch3Data.set(c3);
                }

                // Heavy analyser — only every _analyseInterval ms
                const now = Date.now();
                const ch1Active =
                    (State.ch1Source === 'mic' && !!this._micAnalyser) ||
                    (State.ch1Source === 'file' && AudioLoader.hasCH1File);
                if (ch1Active && State.sim.ch2Enabled && State.ch2Data &&
                    (now - this._lastAnalyseTime) > this._analyseInterval) {
                    const ar = dspAnalyse(State.dataArray, State.ch2Data, State.simSampleRate, State.fftSize);
                    if (ar && ar.detected) {
                        State.analyserResult = ar;
                        Persist.saveAnalyserResult(ar);
                        if (UI.updateAnalyserDisplay) UI.updateAnalyserDisplay(ar);
                    }
                    this._lastAnalyseTime = now;
                }

                Oscilloscope.draw(this.ctx, w, h);
                if      (State.currentTab === 'fft')  FFT.drawOverlay(this.ctx, w, h);
                else if (State.currentTab === 'info') InfoView.drawOverlay(this.ctx, w, h);
                else if (State.currentTab === 'sim')  SimView.drawOverlay(this.ctx, w, h);
                return;
            }

            // ── LIVE MODE ─────────────────────────
            if (!State.analyser) return;
            State.analyser.getByteTimeDomainData(State.dataArray);
            State.analyser.getByteFrequencyData(State.freqArray);

            const sr   = State.audioCtx ? State.audioCtx.sampleRate : 44100;
            const meas = dspMeasure(
                State.dataArray, State.freqArray,
                sr, State.fftSize,
                State.calibFreq, State.calibVpp,
                false, 0
            );
            Measurements.applyWorkerResult(meas);

            if (frame % 12 === 0) {
                const cl = dspClassify(State.dataArray, sr);
                SignalDetect.updateBadge(cl.type);
            }

            Oscilloscope.draw(this.ctx, w, h);
            if      (State.currentTab === 'fft')  FFT.drawOverlay(this.ctx, w, h);
            else if (State.currentTab === 'info') InfoView.drawOverlay(this.ctx, w, h);
        };
        tick();
    },

    stopLoop() {
        if (State.animId) { cancelAnimationFrame(State.animId); State.animId = null; }
    },

    // ══════════════════════════════════════
    // CHANNEL HANDLERS
    // ══════════════════════════════════════
    _handleCH1() {
        if (!State.dataArray) State.dataArray = new Uint8Array(State.fftSize);
        if (State.ch1Source === 'mic') {
            if (this._micAnalyser && this._micDataArray) {
                this._micAnalyser.getByteTimeDomainData(this._micDataArray);
                State.dataArray.set(this._micDataArray);
            } else State.dataArray.fill(128);
        } else if (State.ch1Source === 'file' && AudioLoader.hasCH1File) {
            AudioLoader.fillFromFileCH1(State.dataArray);
        } else State.dataArray.fill(128);
    },

    _handleCH2() {
        if (!State.ch2Data) State.ch2Data = new Uint8Array(State.fftSize);
        if (State.ch2Source === 'synth') {
            const r = simGenerate({ ...State.sim }, State.fftSize, State.simSampleRate);
            State.ch2Data.set(r.dataArray);
            if (State.freqArray && r.freqArray) State.freqArray.set(r.freqArray);
        } else if (State.ch2Source === 'file' && AudioLoader.hasFile) {
            AudioLoader.fillFromFile(State.ch2Data);
        } else State.ch2Data.fill(128);
    },

    // ══════════════════════════════════════
    // PUBLIC API
    // ══════════════════════════════════════
    runAnalysis() {
        if (!State.dataArray || !State.ch2Data) return;
        // Yield to browser first so UI stays responsive, THEN run DSP
        const snap1 = new Uint8Array(State.dataArray);   // snapshot — safe to use off-frame
        const snap2 = new Uint8Array(State.ch2Data);
        const sr    = State.simSampleRate;
        const fsz   = State.fftSize;
        setTimeout(() => {
            const ar = dspAnalyse(snap1, snap2, sr, fsz);
            if (ar && ar.detected) {
                State.analyserResult = ar;
                Persist.saveAnalyserResult(ar);
                if (UI.updateAnalyserDisplay) UI.updateAnalyserDisplay(ar);
            }
        }, 0);
    },

    async runBodeSweep(startHz, stopHz, steps) {
        if (!State.dataArray) return null;
        const sr = State.simMode ? State.simSampleRate : (State.audioCtx ? State.audioCtx.sampleRate : 44100);
        return dspBodeSweep(
            State.dataArray, State.ch2Data || State.dataArray,
            startHz || 20, stopHz || 20000, steps || 50, sr
        );
    },

    _hasArtifacts() { return Object.values(Artifacts.params).some(v => v !== 0); },

    resize() {
        const area = this.canvas.parentElement;
        this.canvas.width  = area.clientWidth;
        this.canvas.height = area.clientHeight;
        if (!State.isRunning && !State.simMode) this.drawIdle();
    },

    drawIdle() {
        const w = this.canvas.width, h = this.canvas.height;
        if (w < 10 || h < 10) return;
        Grid.draw(this.ctx, w, h);
        this.ctx.fillStyle = (State.scopeTextColor || '#00e5ff') + '66';
        this.ctx.font      = "14px 'Share Tech Mono'";
        this.ctx.fillText('AWAITING SIGNAL...', 14, 24);
    },

    _initializeTheme() {
        UI.setWaveColor(State.waveColor);
        UI.setGridColor(State.gridColor);
        UI.setMeasColor(State.measColor);
        UI.setSettingsTextColor(State.settingsTextColor);
        UI.setSettingsFont(State.settingsFont);
        UI.setSettingsFontSize(State.settingsFontSize);
        UI.setScopeTextColor(State.scopeTextColor);
        UI.setScopeFont(State.scopeFont);
        UI.setScopeFontSize(State.scopeFontSize);
        UI.setInfoTextColor(State.infoTextColor);
        UI.setInfoFont(State.infoFont);
        UI.setInfoFontSize(State.infoFontSize);
    },

    getAnalysis() { return State.analyserResult; },
    getBode()     { return null; },
};

if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', () => App.init()); }
else { App.init(); }
