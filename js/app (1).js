// ── APP.JS v1.0.3 — overlay architecture ──
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

    init() {
        this.canvas = document.getElementById('scopeCanvas');
        this.ctx    = this.canvas.getContext('2d');
        window.addEventListener('load',   () => this.resize());
        window.addEventListener('resize', () => this.resize());
        this.resize();
        this.drawIdle();
    },

    resize() {
        const area         = this.canvas.parentElement;
        this.canvas.width  = area.clientWidth;
        this.canvas.height = area.clientHeight;
        if (!State.isRunning) this.drawIdle();
    },

    drawIdle() {
        const w = this.canvas.width, h = this.canvas.height;
        if (w < 10 || h < 10) return;
        Grid.draw(this.ctx, w, h);
        this.ctx.fillStyle = (State.scopeTextColor || '#00ff41') + '44';
        this.ctx.font      = "13px 'Share Tech Mono'";
        this.ctx.fillText('AWAITING SIGNAL...', 10, 20);
    },

    startLoop() {
        const tick = () => {
            State.animId = requestAnimationFrame(tick);
            if (State.paused || !State.analyser) return;

            // pull fresh audio data every frame
            State.analyser.getByteTimeDomainData(State.dataArray);
            State.analyser.getByteFrequencyData(State.freqArray);

            Measurements.update();
            SignalDetect.updateBadge(SignalDetect.run(State.dataArray));

            const w = this.canvas.width, h = this.canvas.height;

            // ── LAYER 1: Oscilloscope ALWAYS renders ──
            Oscilloscope.draw(this.ctx, w, h);

            // ── LAYER 2: Overlay FFT or INFO on top ──
            if      (State.currentTab === 'fft')  FFT.drawOverlay(this.ctx, w, h);
            else if (State.currentTab === 'info') InfoView.drawOverlay(this.ctx, w, h);
            // OSC tab = no overlay, pure waveform view
        };
        tick();
    },

    stopLoop() {
        if (State.animId) {
            cancelAnimationFrame(State.animId);
            State.animId = null;
        }
    }
};

App.init();
