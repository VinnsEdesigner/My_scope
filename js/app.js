// ── APP.JS — main animation loop + boot ──
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
        const area = this.canvas.parentElement;
        this.canvas.width  = area.clientWidth;
        this.canvas.height = area.clientHeight;
        if (!State.isRunning) this.drawIdle();
    },

    drawIdle() {
        const w = this.canvas.width, h = this.canvas.height;
        if (w < 10 || h < 10) return;
        Grid.draw(this.ctx, w, h);
        this.ctx.fillStyle = '#002200';
        this.ctx.font      = "12px 'Share Tech Mono'";
        this.ctx.fillText('AWAITING SIGNAL...', 10, 20);
    },

    startLoop() {
        const tick = () => {
            State.animId = requestAnimationFrame(tick);
            if (State.paused || !State.analyser) return;

            // pull fresh data
            State.analyser.getByteTimeDomainData(State.dataArray);
            State.analyser.getByteFrequencyData(State.freqArray);

            // run analysis
            Measurements.update();
            SignalDetect.updateBadge(SignalDetect.run(State.dataArray));

            // render active tab
            const w = this.canvas.width, h = this.canvas.height;
            if      (State.currentTab === 'osc')  Oscilloscope.draw(this.ctx, w, h);
            else if (State.currentTab === 'fft')  FFT.draw(this.ctx, w, h);
            else                                  InfoView.draw(this.ctx, w, h);
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

// ── BOOT ──
App.init();
