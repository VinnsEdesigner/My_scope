// ── UI.JS — buttons, sliders, tabs, menu ──
const UI = {

    toggleMenu() {
        const menu    = document.getElementById('sideMenu');
        const overlay = document.getElementById('menuOverlay');
        menu.classList.toggle('open');
        overlay.classList.toggle('open');
    },

    switchTab(tab) {
        State.currentTab = tab;
        document.querySelectorAll('.tab').forEach(t => {
            t.classList.toggle('active', t.dataset.tab === tab);
        });
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
        const btn    = document.getElementById('pauseBtn');
        btn.innerText  = State.paused ? '▶ RESUME' : '⏸ PAUSE';
        btn.className  = State.paused ? 'btn-secondary' : 'btn-primary';
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
        const sizes  = [512, 1024, 2048, 4096, 8192];
        let idx      = sizes.indexOf(State.fftSize);
        idx          = Math.max(0, Math.min(sizes.length - 1, idx + dir));
        State.fftSize = sizes[idx];
        document.getElementById('fftSizeVal').innerText = State.fftSize;
        if (State.analyser) {
            State.analyser.fftSize = State.fftSize;
            State.dataArray = new Uint8Array(State.analyser.fftSize);
            State.freqArray = new Uint8Array(State.analyser.frequencyBinCount);
        }
    },

    adjustTimeDiv(dir) {
        if (State.timeDivIndex === null) State.timeDivIndex = Math.floor(TIME_DIV_STEPS.length / 2);
        State.timeDivIndex = Math.max(0, Math.min(TIME_DIV_STEPS.length - 1, State.timeDivIndex + dir));
        const ms = TIME_DIV_STEPS[State.timeDivIndex];
        document.getElementById('timeDivVal').innerText =
            ms >= 1 ? ms.toFixed(0) + 'ms' : (ms * 1000).toFixed(0) + 'µs';
        // sync zoom to match
        if (State.audioCtx) {
            const sr = State.audioCtx.sampleRate;
            const samplesPerDiv = (ms / 1000) * sr;
            State.zoom = Math.max(1, State.dataArray.length / (samplesPerDiv * Grid.COLS));
            document.getElementById('zoomSlider').value = Math.min(8, State.zoom);
            document.getElementById('zoomVal').innerText = State.zoom.toFixed(1) + 'x';
        }
    },

    adjustVoltDiv(dir) {
        if (State.voltDivIndex === null) State.voltDivIndex = Math.floor(VOLT_DIV_STEPS.length / 2);
        State.voltDivIndex = Math.max(0, Math.min(VOLT_DIV_STEPS.length - 1, State.voltDivIndex + dir));
        const v = VOLT_DIV_STEPS[State.voltDivIndex];
        document.getElementById('voltDivVal').innerText = v.toFixed(2) + 'V';
        // sync gain
        State.gain = Math.max(1, Math.min(10, 1 / (v * Grid.ROWS / 2)));
        document.getElementById('gainSlider').value = Math.min(10, State.gain);
        document.getElementById('gainVal').innerText = State.gain.toFixed(1) + 'x';
    },

    captureSnapshot() {
        const canvas = document.getElementById('scopeCanvas');
        const link   = document.createElement('a');
        link.download = `labscope_${Date.now()}.png`;
        link.href     = canvas.toDataURL('image/png');
        link.click();
    }
};
