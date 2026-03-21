// ── APP.JS v1.1.7 ──
// CH1 = State.dataArray  = mic live OR file PCM  (reference)
// CH2 = State.ch2Data    = synth generated OR file PCM (comparison)
// CH3 = State.ch3Data    = inverse artifact corrected
// Single mic stream shared via State.micSource
// Session persistence via Persist

window.onerror = function(msg, src, line, col, err) {
    document.body.insertAdjacentHTML('afterbegin',
        `<div style="position:fixed;top:0;left:0;right:0;background:#ff1744;color:#fff;
        padding:10px;font-size:12px;z-index:9999;font-family:monospace;word-break:break-all">
        ERR: ${msg} | Line ${line} | ${src?.split('/').pop()}</div>`
    );
    return false;
};

const App = {
    canvas:   null,
    ctx:      null,
    worker:   null,
    _msgId:   0,
    _pending: {},

    _frame: {
        dataArray: null,
        freqArray: null,
        meas:      null,
        classify:  null,
        analyse:   null,
        bode:      null,
    },

    _lastAnalyseTime:  0,
    _analyseInterval:  2000,
    _lastCorrectTime:  0,
    _correctInterval:  100,

    // CH1 mic analyser — taps into shared State.micSource
    _micAnalyser:  null,
    _micDataArray: null,

    // ══════════════════════════════════════
    // BOOT — async to support permission check + auto-start
    // ══════════════════════════════════════
    async init() {
        // ── 1. Restore State from localStorage FIRST ──
        // Must happen before UI renders so sliders/buttons
        // get correct values on first paint
        const hadSession = Persist.restoreFromLocalStorage();

        // ── 2. Canvas setup ──
        this.canvas = document.getElementById('scopeCanvas');
        this.ctx    = this.canvas.getContext('2d');
        window.addEventListener('resize', () => this.resize());
        this.resize();
        this.drawIdle();

        // ── 3. Worker + theme (reads already-restored State) ──
        this._initWorker();
        this._initializeTheme();

        // ── 4. Sync all DOM elements to restored State ──
        Persist.syncUIAfterRestore();

        // ── 5. Switch to last active tab ──
        UI.switchTab(State.currentTab);

        // ── 6. IndexedDB restore (async, does not block boot) ──
        // PCM buffers and analyserResult load in background
        Persist.restoreFromIndexedDB();

        // ── 7. Reset runtime buffers ──
        State.ch2Data = null;
        State.ch3Data = null;

        // ── 8. Permission check → auto-start if session exists ──
        if (hadSession) {
            const granted = await Persist.checkMicPermission();
            if (granted) {
                // Silent auto-start — no splash button needed
                await Audio.initSilent();

                // If last tab was SIM, re-enter sim mode
                if (State.currentTab === 'sim') {
                    this.initMicStream();
                    // Don't auto-play — user taps PLAY
                }
                return;
            }
        }

        // ── First launch or permission not granted — show splash ──
        document.getElementById('splash').style.display = 'flex';
    },

    // ══════════════════════════════════════
    // WORKER
    // ══════════════════════════════════════
    _initWorker() {
        try {
            this.worker = new Worker('./js/worker.js');
            this.worker.onmessage = (e) => this._onWorkerMessage(e.data);
            this.worker.onerror   = (err) => {
                console.error('Worker error:', err.message);
                const banner = document.createElement('div');
                banner.style.cssText =
                    'position:fixed;top:60px;left:0;right:0;background:#ff6d00;' +
                    'color:#fff;padding:8px;font-size:11px;z-index:9998;' +
                    'text-align:center;font-family:monospace';
                banner.innerText = '⚠️ Worker failed — using fallback mode (slower)';
                document.body.appendChild(banner);
                setTimeout(() => banner.remove(), 5000);
            };
        } catch (err) {
            console.warn('Worker unavailable:', err.message);
            this.worker = null;
        }
    },

    _onWorkerMessage(data) {
        const { cmd, id } = data;

        if (id && this._pending[id]) {
            this._pending[id](data);
            delete this._pending[id];
        }

        switch (cmd) {
            case 'generate':
                // Synth output → CH2 buffer
                if (State.ch2Data && data.dataArray) State.ch2Data.set(data.dataArray);
                if (State.freqArray && data.freqArray) State.freqArray.set(data.freqArray);
                break;

            case 'measure':
                this._frame.meas = data;
                Measurements.applyWorkerResult(data);
                break;

            case 'classify':
                this._frame.classify = data;
                SignalDetect.updateBadge(data.type);
                break;

            case 'analyse':
                this._frame.analyse = data;
                this._updateAnalyserDisplay(data);
                break;

            case 'correct':
                if (State.ch3Data && data.ch3Array) {
                    State.ch3Data.set(data.ch3Array);
                } else if (data.ch3Array) {
                    State.ch3Data = new Uint8Array(data.ch3Array);
                }
                break;

            case 'bode_sweep':
            case 'bode_point':
                this._frame.bode = data;
                break;

            case 'artifacts':
                if (State.dataArray && data.dataArray) State.dataArray.set(data.dataArray);
                break;

            case 'error':
                console.error(`Worker [${data.cmd}] error:`, data.msg);
                break;
        }
    },

    _post(payload, transfers) {
        if (!this.worker) return Promise.resolve({});
        const id = ++this._msgId;
        return new Promise((resolve) => {
            this._pending[id] = resolve;
            if (transfers) {
                this.worker.postMessage({ ...payload, id }, transfers);
            } else {
                this.worker.postMessage({ ...payload, id });
            }
        });
    },

    // ══════════════════════════════════════
    // MIC SETUP — taps into State.micSource
    // ══════════════════════════════════════
    initMicStream() {
        if (!State.micSource || !State.audioCtx) {
            console.warn('initMicStream: micSource not ready — START PROBE first');
            return;
        }
        if (this._micAnalyser) return;

        try {
            this._micAnalyser = State.audioCtx.createAnalyser();
            this._micAnalyser.fftSize               = State.fftSize;
            this._micAnalyser.smoothingTimeConstant  = 0.3;
            State.micSource.connect(this._micAnalyser);
            this._micDataArray = new Uint8Array(this._micAnalyser.fftSize);
            console.log('✓ CH1 mic analyser connected to shared micSource');
        } catch (err) {
            console.error('initMicStream failed:', err);
        }
    },

    _teardownMicStream() {
        if (this._micAnalyser && State.micSource) {
            try { State.micSource.disconnect(this._micAnalyser); } catch(e) {}
        }
        this._micAnalyser  = null;
        this._micDataArray = null;
    },

    // ══════════════════════════════════════
    // RENDER LOOP
    // ══════════════════════════════════════
    startLoop() {
        const tick = () => {
            State.animId = requestAnimationFrame(tick);
            if (State.paused) return;

            const w = this.canvas.width;
            const h = this.canvas.height;

            // ── SIM MODE ──
            if (State.simMode) {
                if (!State.sim.playing) return;

                if (!State.dataArray) State.dataArray = new Uint8Array(State.fftSize);
                if (!State.ch2Data)   State.ch2Data   = new Uint8Array(State.fftSize);

                this._handleCH1();

                if (State.sim.ch2Enabled) {
                    this._handleCH2();
                }

                if (State.sim.ch3Enabled && State.ch2Data && State.analyserResult) {
                    const now = Date.now();
                    if (now - this._lastCorrectTime > this._correctInterval) {
                        this._handleCH3();
                        this._lastCorrectTime = now;
                    }
                }

                if (State.dataArray) {
                    this._post({
                        cmd:        'measure',
                        dataArray:  new Uint8Array(State.dataArray),
                        freqArray:  State.freqArray
                            ? new Uint8Array(State.freqArray) : null,
                        sampleRate: State.simSampleRate,
                        fftSize:    State.fftSize,
                        calibFreq:  State.calibFreq,
                        calibVpp:   State.calibVpp,
                        simMode:    true,
                        simFreq:    State.sim.frequency,
                    });
                }

                if (State.dataArray && this._msgId % 10 === 0) {
                    this._post({
                        cmd:        'classify',
                        dataArray:  new Uint8Array(State.dataArray),
                        sampleRate: State.simSampleRate,
                    });
                }

                const now = Date.now();
                const ch1Active =
                    (State.ch1Source === 'mic'  && !!this._micAnalyser) ||
                    (State.ch1Source === 'file' && AudioLoader.hasCH1File);

                if (
                    ch1Active &&
                    State.sim.ch2Enabled &&
                    State.ch2Data &&
                    (now - this._lastAnalyseTime) > this._analyseInterval
                ) {
                    this._runAnalyser();
                    this._lastAnalyseTime = now;
                }

                if (State.dataArray && this._hasArtifacts()) {
                    this._post({
                        cmd:       'artifacts',
                        dataArray: new Uint8Array(State.dataArray),
                        params:    { ...Artifacts.params },
                    });
                }

                Oscilloscope.draw(this.ctx, w, h);
                if      (State.currentTab === 'fft')  FFT.drawOverlay(this.ctx, w, h);
                else if (State.currentTab === 'info') InfoView.drawOverlay(this.ctx, w, h);
                else if (State.currentTab === 'sim')  SimView.drawOverlay(this.ctx, w, h);
                return;
            }

            // ── LIVE MODE ──
            if (!State.analyser) return;
            State.analyser.getByteTimeDomainData(State.dataArray);
            State.analyser.getByteFrequencyData(State.freqArray);

            this._post({
                cmd:        'measure',
                dataArray:  new Uint8Array(State.dataArray),
                freqArray:  new Uint8Array(State.freqArray),
                sampleRate: State.audioCtx ? State.audioCtx.sampleRate : 44100,
                fftSize:    State.fftSize,
                calibFreq:  State.calibFreq,
                calibVpp:   State.calibVpp,
                simMode:    false,
            });

            if (this._msgId % 15 === 0) {
                this._post({
                    cmd:        'classify',
                    dataArray:  new Uint8Array(State.dataArray),
                    sampleRate: State.audioCtx ? State.audioCtx.sampleRate : 44100,
                });
            }

            Oscilloscope.draw(this.ctx, w, h);
            if      (State.currentTab === 'fft')  FFT.drawOverlay(this.ctx, w, h);
            else if (State.currentTab === 'info') InfoView.drawOverlay(this.ctx, w, h);
        };
        tick();
    },

    stopLoop() {
        if (State.animId) {
            cancelAnimationFrame(State.animId);
            State.animId = null;
        }
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
            } else {
                State.dataArray.fill(128);
            }
        } else if (State.ch1Source === 'file' && AudioLoader.hasCH1File) {
            AudioLoader.fillFromFileCH1(State.dataArray);
        } else {
            State.dataArray.fill(128);
        }
    },

    _handleCH2() {
        if (!State.ch2Data) State.ch2Data = new Uint8Array(State.fftSize);

        if (State.ch2Source === 'synth') {
            this._post({
                cmd:           'generate',
                simState:      { ...State.sim },
                fftSize:       State.fftSize,
                simSampleRate: State.simSampleRate,
            });
        } else if (State.ch2Source === 'file' && AudioLoader.hasFile) {
            AudioLoader.fillFromFile(State.ch2Data);
        } else {
            State.ch2Data.fill(128);
        }
    },

    _handleCH3() {
        if (!State.ch2Data || !State.analyserResult) return;
        if (!State.ch3Data) State.ch3Data = new Uint8Array(State.fftSize);

        this._post({
            cmd:            'correct',
            ch2Array:       new Uint8Array(State.ch2Data),
            analyserResult: State.analyserResult,
            sampleRate:     State.simSampleRate,
        });
    },

    // ══════════════════════════════════════
    // ANALYSER
    // ══════════════════════════════════════
    _runAnalyser() {
        if (!State.dataArray || !State.ch2Data) return;
        this._post({
            cmd:        'analyse',
            ch1Array:   new Uint8Array(State.dataArray),
            ch2Array:   new Uint8Array(State.ch2Data),
            sampleRate: State.simSampleRate,
            fftSize:    State.fftSize,
        });
    },

    _updateAnalyserDisplay(result) {
        if (!result || !result.detected) return;
        State.analyserResult = result;
        // Persist analyser result to IndexedDB
        Persist.saveAnalyserResult(result);
        if (typeof UI !== 'undefined' && UI.updateAnalyserDisplay) {
            UI.updateAnalyserDisplay(result);
        }
    },

    // ══════════════════════════════════════
    // PUBLIC API
    // ══════════════════════════════════════
    runAnalysis() { this._runAnalyser(); },

    async runBodeSweep(startHz, stopHz, steps) {
        if (!State.dataArray) return null;
        const sr = State.simMode
            ? State.simSampleRate
            : (State.audioCtx ? State.audioCtx.sampleRate : 44100);
        return this._post({
            cmd:        'bode_sweep',
            ch1Array:   new Uint8Array(State.dataArray),
            ch2Array:   new Uint8Array(State.ch2Data || State.dataArray),
            startHz:    startHz || 20,
            stopHz:     stopHz  || 20000,
            steps:      steps   || 50,
            sampleRate: sr,
        });
    },

    getAnalysis()  { return this._frame.analyse; },
    getBode()      { return this._frame.bode; },
    getClassify()  { return this._frame.classify; },
    getMeas()      { return this._frame.meas; },

    // ══════════════════════════════════════
    // HELPERS
    // ══════════════════════════════════════
    _hasArtifacts() {
        return Object.values(Artifacts.params).some(v => v !== 0);
    },

    resize() {
        const area         = this.canvas.parentElement;
        this.canvas.width  = area.clientWidth;
        this.canvas.height = area.clientHeight;
        if (!State.isRunning && !State.simMode) this.drawIdle();
    },

    drawIdle() {
        const w = this.canvas.width, h = this.canvas.height;
        if (w < 10 || h < 10) return;
        Grid.draw(this.ctx, w, h);
        this.ctx.fillStyle = (State.scopeTextColor || '#00e5ff') + '44';
        this.ctx.font      = "13px 'Share Tech Mono'";
        this.ctx.fillText('AWAITING SIGNAL...', 10, 20);
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
};

// ── Boot ──
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => App.init());
} else {
    App.init();
}
