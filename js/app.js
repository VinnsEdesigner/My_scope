// ── APP.JS v1.1.1 — Worker-wired main loop ──
// Main thread: canvas draw + DOM only
// Worker thread: ALL DSP math via js/worker.js

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
    worker:   null,    // Web Worker instance
    _msgId:   0,       // incrementing message ID per postMessage call
    _pending: {},      // pending worker callbacks { id: resolveFn }

    // ── Latest frame state — written by worker, read by draw ──
    _frame: {
        dataArray: null,
        freqArray: null,
        meas:      null,   // { vpp, rms, db, freq, rawVpp }
        classify:  null,   // { type, confidence, features }
        analyse:   null,   // full H(f) analysis result
        bode:      null,   // bode sweep result
    },

    // ══════════════════════════════════════
    // BOOT
    // ══════════════════════════════════════
    init() {
        this.canvas = document.getElementById('scopeCanvas');
        this.ctx    = this.canvas.getContext('2d');

        window.addEventListener('resize', () => this.resize());
        this.resize();
        this.drawIdle();

        this._initWorker();

        // ── BUG1 FIX: theme init AFTER all scripts are loaded ──
        this._initializeTheme();
    },

    // ══════════════════════════════════════
    // WORKER INIT + MESSAGE ROUTING
    // ══════════════════════════════════════
    _initWorker() {
        try {
            this.worker = new Worker('js/worker.js');
            this.worker.onmessage = (e) => this._onWorkerMessage(e.data);
            this.worker.onerror   = (err) => console.error('Worker error:', err.message);
        } catch (err) {
            // GitHub Pages or file:// may block workers — fall back gracefully
            console.warn('Worker unavailable, falling back to main-thread DSP:', err.message);
            this.worker = null;
        }
    },

    _onWorkerMessage(data) {
        const { cmd, id } = data;

        // resolve any waiting promise
        if (id && this._pending[id]) {
            this._pending[id](data);
            delete this._pending[id];
        }

        // update shared frame state
        switch (cmd) {
            case 'generate':
                // worker returns new typed arrays — copy into State buffers
                if (State.dataArray && data.dataArray) State.dataArray.set(data.dataArray);
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

    // ── Post message to worker — returns Promise ──
    _post(payload, transfers) {
        if (!this.worker) return this._fallback(payload);

        const id = ++this._msgId;
        return new Promise((resolve) => {
            this._pending[id] = resolve;
            transfers
                ? this.worker.postMessage({ ...payload, id }, transfers)
                : this.worker.postMessage({ ...payload, id });
        });
    },

    // ── Fallback: run on main thread if worker unavailable ──
    _fallback(payload) {
        try {
            switch (payload.cmd) {
                case 'generate': {
                    const r = simGenerate(payload.simState, payload.fftSize, payload.simSampleRate);
                    if (State.dataArray) State.dataArray.set(r.dataArray);
                    if (State.freqArray) State.freqArray.set(r.freqArray);
                    break;
                }
                case 'measure': {
                    const r = dspMeasure(
                        payload.dataArray, payload.freqArray,
                        payload.sampleRate, payload.fftSize,
                        payload.calibFreq,  payload.calibVpp,
                        payload.simMode,    payload.simFreq
                    );
                    Measurements.applyWorkerResult(r);
                    break;
                }
                case 'artifacts': {
                    const r = applyArtifacts(payload.dataArray, payload.params);
                    if (State.dataArray) State.dataArray.set(r);
                    break;
                }
                case 'classify': {
                    const r = dspClassify(payload.dataArray, payload.sampleRate);
                    SignalDetect.updateBadge(r.type);
                    break;
                }
            }
        } catch (e) {
            console.warn('Fallback DSP error:', e.message);
        }
        return Promise.resolve({});
    },

    // ══════════════════════════════════════
    // RENDER LOOP
    // ══════════════════════════════════════
    startLoop() {
        const tick = () => {
            State.animId = requestAnimationFrame(tick);
            if (State.paused) return;

            const w = this.canvas.width, h = this.canvas.height;

            // ── SIM MODE ──
            if (State.simMode) {
                if (!State.sim.playing) return;

                // generate waveform in worker every frame
                this._post({
                    cmd:           'generate',
                    simState:      { ...State.sim },
                    fftSize:       State.fftSize,
                    simSampleRate: State.simSampleRate,
                });

                // measure every frame
                if (State.dataArray) {
                    this._post({
                        cmd:        'measure',
                        dataArray:  new Uint8Array(State.dataArray),
                        freqArray:  State.freqArray ? new Uint8Array(State.freqArray) : null,
                        sampleRate: State.simSampleRate,
                        fftSize:    State.fftSize,
                        calibFreq:  State.calibFreq,
                        calibVpp:   State.calibVpp,
                        simMode:    true,
                        simFreq:    State.sim.frequency,
                    });
                }

                // classify every 10 frames — save CPU
                if (State.dataArray && this._msgId % 10 === 0) {
                    this._post({
                        cmd:        'classify',
                        dataArray:  new Uint8Array(State.dataArray),
                        sampleRate: State.simSampleRate,
                    });
                }

                // apply artifact pipeline if any knobs are non-zero
                if (State.dataArray && this._hasArtifacts()) {
                    this._post({
                        cmd:       'artifacts',
                        dataArray: new Uint8Array(State.dataArray),
                        params:    { ...Artifacts.params },
                    });
                }

                // ── DRAW — main thread only, zero math ──
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

            // measure in worker every frame
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

            // classify every 15 frames
            if (this._msgId % 15 === 0) {
                this._post({
                    cmd:        'classify',
                    dataArray:  new Uint8Array(State.dataArray),
                    sampleRate: State.audioCtx ? State.audioCtx.sampleRate : 44100,
                });
            }

            // ── DRAW — main thread only ──
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
    // PUBLIC DSP CALLS — called by UI buttons
    // ══════════════════════════════════════

    // Full transfer function — called when ANALYSER tab opens
    runAnalysis() {
        if (!State.dataArray) return;
        const sr = State.simMode
            ? State.simSampleRate
            : (State.audioCtx ? State.audioCtx.sampleRate : 44100);
        this._post({
            cmd:        'analyse',
            ch1Array:   new Uint8Array(State.dataArray),
            ch2Array:   new Uint8Array(State.dataArray), // CH2 wired in v2.0
            sampleRate: sr,
            fftSize:    State.fftSize,
        });
    },

    // Bode sweep — called by RUN BODE SWEEP button in SIM SET ANALYSER tab
    runBodeSweep(startHz, stopHz, steps) {
        if (!State.dataArray) return Promise.resolve(null);
        const sr = State.simMode
            ? State.simSampleRate
            : (State.audioCtx ? State.audioCtx.sampleRate : 44100);
        return this._post({
            cmd:        'bode_sweep',
            ch1Array:   new Uint8Array(State.dataArray),
            ch2Array:   new Uint8Array(State.dataArray),
            startHz:    startHz || 20,
            stopHz:     stopHz  || 20000,
            steps:      steps   || 50,
            sampleRate: sr,
        });
    },

    // ── Getters for UI to read latest results ──
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
        const area        = this.canvas.parentElement;
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
