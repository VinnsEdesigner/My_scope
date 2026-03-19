// ── AUDIO.JS v1.1.3 FIXED — Single unified mic permission ──
const Audio = {
    async init() {
        try {
            document.getElementById('splash').style.display = 'none';
            document.getElementById('statusTxt').innerText  = 'CONNECTING...';

            // ✅ Request mic permission ONCE - will be shared with App.initMicStream()
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation:  false,
                    noiseSuppression:  false,
                    autoGainControl:   false,
                    channelCount:      1,
                }
            });

            // ✅ Create live mode audio context + analyser
            State.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const source   = State.audioCtx.createMediaStreamSource(stream);
            State.analyser = State.audioCtx.createAnalyser();
            State.analyser.fftSize              = State.fftSize;
            State.analyser.smoothingTimeConstant = State.smoothing;
            source.connect(State.analyser);

            State.dataArray = new Uint8Array(State.analyser.fftSize);
            State.freqArray = new Uint8Array(State.analyser.frequencyBinCount);
            State.isRunning = true;

            document.getElementById('statusTxt').innerText = 'LIVE';
            document.getElementById('statusDot').classList.add('active');
            document.getElementById('pauseBtn').disabled   = false;
            document.getElementById('overlayRight').innerText =
                `SR: ${State.audioCtx.sampleRate / 1000}kHz`;

            // build info panel runtime data
            document.getElementById('bSampleRate').innerText =
                State.audioCtx.sampleRate / 1000 + 'kHz';
            document.getElementById('bFftSize').innerText    = State.fftSize;
            document.getElementById('bFreqRes').innerText    =
                (State.audioCtx.sampleRate / State.fftSize).toFixed(2) + 'Hz';
            document.getElementById('bBrowser').innerText    =
                navigator.userAgent.includes('Chrome') ? 'Chrome' : 'Other';

            App.startLoop();

        } catch (err) {
            console.error('Mic init failed:', err);
            document.getElementById('splash').style.display = 'flex';
            document.getElementById('statusTxt').innerText  = 'MIC DENIED';
            
            // ✅ More helpful error message
            alert('🎤 Microphone access required.\n\nLab Scope needs mic permission for:\n• Live signal capture (OSC tabs)\n• Simulator CH2 capture (SIM tab)\n\nPlease allow and click START PROBE again.');
        }
    },

    reset() {
        App.stopLoop();
        if (State.audioCtx) State.audioCtx.close();
        State.audioCtx   = null;
        State.analyser   = null;
        State.dataArray  = null;
        State.freqArray  = null;
        State.isRunning  = false;
        State.paused     = false;
        State.triggerFired = false;
        State.triggerArmed = true;
        State.triggerFrame = null;
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
            document.getElementById(id).innerText   = '---';
            document.getElementById(id).className   = 'meas-value';
        });
        App.resize();
    }
};
