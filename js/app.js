// ── APP.JS v1.1.3 PROPER ARCHITECTURE ──
// CH1 = synth reference (always user-controlled)
// CH2 = captured signal (mic live OR file playback)
// CH3 = reconstructed (CH2 with artifacts removed)

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

    // ── Frame state ──
    _frame: {
        dataArray: null,
        freqArray: null,
        meas:      null,
        classify:  null,
        analyse:   null,
        bode:      null,
    },

    // ── Analyser timing ──
    _lastAnalyseTime: 0,
    _analyseInterval: 2000, // Run every 2 seconds

    // ✅ Mic stream (stays active but we choose when to use it)
    _micStream:    null,
    _micAnalyser:  null,
    _micDataArray: null,

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
        this._initializeTheme();
        
        // Initialize channel buffers
        State.ch2Data = null;
        State.ch3Data = null;
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
                banner.style.cssText = 'position:fixed;top:60px;left:0;right:0;background:#ff6d00;color:#fff;padding:8px;font-size:11px;z-index:9998;text-align:center;font-family:monospace';
                banner.innerText = '⚠️ Worker failed - using fallback mode (slower)';
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
                this._updateAnalyserDisplay(data);
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
    // MIC SETUP (stays on, we just choose when to use it)
    // ══════════════════════════════════════
    async initMicStream() {
        if (this._micStream) return; // Already initialized

        try {
            // ✅ Request mic permission (or reuse already-granted permission)
            this._micStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation:  false,
                    noiseSuppression:  false,
                    autoGainControl:   false,
                    channelCount:      1,
                }
            });

            // Create dedicated analyser for mic
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const source   = audioCtx.createMediaStreamSource(this._micStream);
            this._micAnalyser = audioCtx.createAnalyser();
            this._micAnalyser.fftSize = State.fftSize;
            this._micAnalyser.smoothingTimeConstant = 0.3; // Less smoothing for capture
            source.connect(this._micAnalyser);

            this._micDataArray = new Uint8Array(this._micAnalyser.fftSize);

            console.log('✓ Mic stream initialized for CH2 capture');
        } catch (err) {
            console.error('CH2 mic init failed:', err);
            
            // ✅ Don't block - show warning but continue
            const banner = document.createElement('div');
            banner.style.cssText = 'position:fixed;top:60px;left:0;right:0;background:#ff6d00;color:#fff;padding:8px;font-size:11px;z-index:9998;text-align:center;font-family:monospace';
            banner.innerText = '⚠️ CH2 mic unavailable - grant permission or use FILE mode';
            document.body.appendChild(banner);
            setTimeout(() => banner.remove(), 5000);
        }
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

                // ✅ Generate CH1 (reference synth signal)
                this._post({
                    cmd:           'generate',
                    simState:      { ...State.sim },
                    fftSize:       State.fftSize,
                    simSampleRate: State.simSampleRate,
                });

                // ✅ Handle CH2 (captured signal - mic OR file)
                if (State.sim.ch2Enabled) {
                    this._handleCH2();
                }

                // ✅ Handle CH3 (reconstructed signal)
                if (State.sim.ch3Enabled && State.ch2Data) {
                    this._handleCH3();
                }

                // Measure CH1
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

                // Classify CH1 (every 10 frames)
                if (State.dataArray && this._msgId % 10 === 0) {
                    this._post({
                        cmd:        'classify',
                        dataArray:  new Uint8Array(State.dataArray),
                        sampleRate: State.simSampleRate,
                    });
                }

                // ✅ Run analyser (every 2 seconds when CH2 active)
                const now = Date.now();
                if (State.sim.ch2Enabled && State.ch2Data && (now - this._lastAnalyseTime) > this._analyseInterval) {
                    this._runAnalyser();
                    this._lastAnalyseTime = now;
                }

                // Apply artifacts to CH1 if knobs turned
                if (State.dataArray && this._hasArtifacts()) {
                    this._post({
                        cmd:       'artifacts',
                        dataArray: new Uint8Array(State.dataArray),
                        params:    { ...Artifacts.params },
                    });
                }

                // ── DRAW ──
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

    // ✅ CH2: Captured signal (mic live OR file playback)
    _handleCH2() {
        if (!State.ch2Data) {
            State.ch2Data = new Uint8Array(State.fftSize);
        }

        // Decide source: mic or file
        if (State.sim.ch2Source === 'mic') {
            // ✅ Use LIVE MIC for CH2
            if (this._micAnalyser && this._micDataArray) {
                this._micAnalyser.getByteTimeDomainData(this._micDataArray);
                State.ch2Data.set(this._micDataArray);
            } else {
                // Mic not ready, init it
                this.initMicStream();
            }
        } else if (State.sim.ch2Source === 'file' && AudioLoader.hasFile) {
            // ✅ Use FILE PLAYBACK for CH2
            AudioLoader.fillFromFile(State.ch2Data);
        } else {
            // No source - fill with silence
            State.ch2Data.fill(128);
        }
    },

    // ✅ CH3: Reconstructed signal (CH2 with artifacts removed)
    _handleCH3() {
        if (!State.ch3Data) {
            State.ch3Data = new Uint8Array(State.fftSize);
        }

        // Copy CH2
        if (State.ch2Data) {
            State.ch3Data.set(State.ch2Data);
        }

        // TODO: Apply inverse artifact correction based on analyser results
        // For now, just shows CH2 copy - full implementation would:
        // 1. Read detected artifacts from State.analyserResult
        // 2. Apply inverse HPF, AGC compensation, declipping, etc.
        // 3. Result = "cleaned" version of CH2
    },

    // ✅ Run transfer function analyser
    _runAnalyser() {
        if (!State.dataArray || !State.ch2Data) return;
        
        this._post({
            cmd:        'analyse',
            ch1Array:   new Uint8Array(State.dataArray),  // Reference synth
            ch2Array:   new Uint8Array(State.ch2Data),    // Captured
            sampleRate: State.simSampleRate,
            fftSize:    State.fftSize,
        });
    },

    // ✅ Update analyser info display
    _updateAnalyserDisplay(result) {
        if (!result || !result.detected) return;
        State.analyserResult = result;
    },

    // ══════════════════════════════════════
    // PUBLIC API
    // ══════════════════════════════════════
    runAnalysis() {
        this._runAnalyser();
    },

    runBodeSweep(startHz, stopHz, steps) {
        if (!State.dataArray) return Promise.resolve(null);
        const sr = State.simMode ? State.simSampleRate : (State.audioCtx ? State.audioCtx.sampleRate : 44100);
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
