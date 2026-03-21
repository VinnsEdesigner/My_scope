// ── AUDIO.JS v1.1.5 ── single mic stream, shared via State.micSource
const Audio = {

    // ── Standard init — shows/hides splash, called by user tap ──
    async init() {
        try {
            document.getElementById('splash').style.display = 'none';
            document.getElementById('statusTxt').innerText  = 'CONNECTING...';

            await this._startMic();
            App.startLoop();

        } catch (err) {
            console.error('Mic init failed:', err);
            document.getElementById('splash').style.display = 'flex';
            document.getElementById('statusTxt').innerText  = 'MIC DENIED';
            alert(
                '🎤 Microphone access required.\n\n' +
                'Lab Scope needs mic permission for:\n' +
                '• Live signal capture (OSC tabs)\n' +
                '• Simulator CH1 capture (SIM tab)\n\n' +
                'Please allow and click START PROBE again.'
            );
        }
    },

    // ── Silent init — no splash manipulation, called on auto-resume ──
    // Used when mic permission is already granted and session is restored
    async initSilent() {
        try {
            document.getElementById('statusTxt').innerText = 'CONNECTING...';
            await this._startMic();
            App.startLoop();
        } catch (err) {
            // Auto-start failed silently — show splash so user can tap START PROBE
            console.warn('Audio.initSilent failed:', err);
            document.getElementById('splash').style.display = 'flex';
            document.getElementById('statusTxt').innerText  = 'TAP TO START';
        }
    },

    // ── Shared mic setup — called by both init() and initSilent() ──
    async _startMic() {
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl:  false,
                channelCount:     1,
            }
        });

        State.audioCtx  = new (window.AudioContext || window.webkitAudioContext)();
        State.micSource = State.audioCtx.createMediaStreamSource(stream);

        State.analyser                      = State.audioCtx.createAnalyser();
        State.analyser.fftSize              = State.fftSize;
        State.analyser.smoothingTimeConstant = State.smoothing;
        State.micSource.connect(State.analyser);

        State.dataArray = new Uint8Array(State.analyser.fftSize);
        State.freqArray = new Uint8Array(State.analyser.frequencyBinCount);
        State.isRunning = true;

        // UI updates
        document.getElementById('statusTxt').innerText  = 'LIVE';
        document.getElementById('statusDot').classList.add('active');
        document.getElementById('pauseBtn').disabled    = false;
        document.getElementById('splash').style.display = 'none';
        document.getElementById('overlayRight').innerText =
            `SR: ${State.audioCtx.sampleRate / 1000}kHz`;

        // Build info panel
        document.getElementById('bSampleRate').innerText =
            State.audioCtx.sampleRate / 1000 + 'kHz';
        document.getElementById('bFftSize').innerText    = State.fftSize;
        document.getElementById('bFreqRes').innerText    =
            (State.audioCtx.sampleRate / State.fftSize).toFixed(2) + 'Hz';
        document.getElementById('bBrowser').innerText   =
            navigator.userAgent.includes('Chrome') ? 'Chrome' : 'Other';
    },

    reset() {
        App.stopLoop();

        if (State.micSource) {
            try { State.micSource.disconnect(); } catch(e) {}
        }
        if (State.audioCtx) State.audioCtx.close();

        State.audioCtx       = null;
        State.micSource      = null;
        State.analyser       = null;
        State.dataArray      = null;
        State.freqArray      = null;
        State.isRunning      = false;
        State.paused         = false;
        State.triggerFired   = false;
        State.triggerArmed   = true;
        State.triggerFrame   = null;
        State.lastSignalType = '---';

        document.getElementById('statusTxt').innerText    = 'STANDBY';
        document.getElementById('statusDot').classList.remove('active');
        document.getElementById('pauseBtn').disabled      = true;
        document.getElementById('pauseBtn').innerText     = '⏸ PAUSE';
        document.getElementById('pauseBtn').className     = 'btn-primary';
        document.getElementById('triggerBtn').innerText   = '⚡ TRIG';
        document.getElementById('triggerBtn').className   = 'btn-secondary';
        document.getElementById('sigTypeBadge').innerText = '---';
        document.getElementById('sigTypeBadge').className = 'sig-badge';
        document.getElementById('splash').style.display   = 'flex';

        ['mFreq','mVpp','mRms','mDb'].forEach(id => {
            const el = document.getElementById(id);
            if (el) { el.innerText = '---'; el.className = 'meas-value'; }
        });

        // Clear session on explicit reset
        Persist.clearAll();

        App.resize();
    }
};
