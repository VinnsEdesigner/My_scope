// ── FFT.JS — frequency spectrum + signal info renderer ──
const FFT = {
    draw(ctx, w, h) {
        if (w < 10 || h < 10) return;
        Grid.draw(ctx, w, h);
        if (!State.freqArray) return;

        const barCount = 128;
        const step     = Math.floor(State.freqArray.length / barCount);
        const barW     = w / barCount;

        for (let i = 0; i < barCount; i++) {
            let sum = 0;
            for (let j = 0; j < step; j++) sum += State.freqArray[i * step + j];
            const avg  = sum / step;
            const barH = (avg / 255) * h;
            const hue  = 120 - (avg / 255) * 100;
            ctx.fillStyle  = `hsl(${hue}, 100%, 50%)`;
            ctx.shadowBlur = 4;
            ctx.shadowColor= `hsl(${hue}, 100%, 60%)`;
            ctx.fillRect(i * barW, h - barH, barW - 1, barH);
        }
        ctx.shadowBlur = 0;

        // freq axis labels
        ctx.fillStyle = '#005500';
        ctx.font      = "9px 'Share Tech Mono'";
        const nyquist = State.audioCtx ? State.audioCtx.sampleRate / 2 : 22050;
        for (let k = 0; k <= 4; k++) {
            const freq = (nyquist / 4) * k;
            const x    = (freq / nyquist) * w;
            const label = freq >= 1000 ? (freq / 1000).toFixed(1) + 'k' : freq + 'Hz';
            ctx.fillText(label, x + 2, h - 18);
        }

        ctx.fillStyle = '#004400';
        ctx.font      = "10px 'Share Tech Mono'";
        ctx.fillText('FFT SPECTRUM', 8, 16);
    }
};

// ── SIGNAL INFO RENDERER ──
const InfoView = {
    draw(ctx, w, h) {
        if (w < 10 || h < 10) return;
        Grid.draw(ctx, w, h);

        const freq = document.getElementById('mFreq').innerText;
        const vpp  = document.getElementById('mVpp').innerText;
        const rms  = document.getElementById('mRms').innerText;
        const db   = document.getElementById('mDb').innerText;

        const typeColors = {
            SINE: '#00e5ff', SQUARE: '#ffb300', TRIANGLE: '#e040fb',
            SAWTOOTH: '#ff6d00', NOISE: '#ff1744', DC: '#00ff41', '---': '#006600'
        };
        const typeColor = typeColors[State.lastSignalType] || '#00ff41';

        const lines = [
            { label: 'SIGNAL TYPE', val: State.lastSignalType, color: typeColor },
            { label: 'FREQUENCY',   val: freq },
            { label: 'Vpp',         val: vpp  },
            { label: 'RMS',         val: rms  },
            { label: 'dBFS',        val: db   },
            { label: 'ZOOM',        val: State.zoom.toFixed(1) + 'x' },
            { label: 'GAIN',        val: State.gain.toFixed(1) + 'x' },
            { label: 'TRIGGER',     val: State.triggerEnabled
                ? `ON | ${State.triggerMode.toUpperCase()} | T+${State.triggerUpper.toFixed(2)}`
                : 'OFF (FREE RUN)' },
            { label: 'CALIB FREQ',  val: State.calibFreq.toFixed(3) + 'x' },
            { label: 'CALIB Vpp',   val: State.calibVpp.toFixed(3)  + 'x' },
            { label: 'SAMPLE RATE', val: State.audioCtx ? State.audioCtx.sampleRate / 1000 + 'kHz' : '---' },
            { label: 'FFT SIZE',    val: State.fftSize.toString() },
            { label: 'STATUS',      val: State.isRunning ? (State.paused ? 'PAUSED' : 'LIVE') : 'IDLE' },
        ];

        ctx.font = "11px 'Share Tech Mono'";
        lines.forEach((line, i) => {
            const y = 36 + i * 22;
            if (y > h - 10) return;
            // label
            ctx.fillStyle = '#006600';
            ctx.fillText('> ' + line.label, 12, y);
            // value
            ctx.fillStyle = line.color || (i % 2 === 0 ? '#00ff41' : '#00cc33');
            ctx.fillText(': ' + line.val, w * 0.45, y);
        });

        ctx.fillStyle = '#003300';
        ctx.font      = "10px 'Share Tech Mono'";
        ctx.fillText('SIGNAL DIAGNOSTICS', 8, 16);
    }
};
