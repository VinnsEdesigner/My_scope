// ── FFT.JS v1.0.3 — overlay renderers ──

const FFT = {

    // ── FFT OVERLAY: bottom 52% of canvas ──
    drawOverlay(ctx, w, h) {
        if (w < 10 || h < 10 || !State.freqArray) return;

        const splitY  = Math.round(h * 0.48); // where overlay starts
        const sc      = State.scopeTextColor || '#00ff41';

        // ── backdrop panel ──
        ctx.fillStyle = 'rgba(0,0,0,0.88)';
        ctx.fillRect(0, splitY, w, h - splitY);

        // ── top border ──
        ctx.strokeStyle = sc + '55';
        ctx.lineWidth   = 1;
        ctx.beginPath();
        ctx.moveTo(0, splitY);
        ctx.lineTo(w, splitY);
        ctx.stroke();

        // ── FFT bars in the overlay area ──
        const barCount = 120;
        const step     = Math.floor(State.freqArray.length / barCount);
        const barW     = w / barCount;
        const barArea  = h - splitY - 18; // leave room for freq labels

        for (let i = 0; i < barCount; i++) {
            let sum = 0;
            for (let j = 0; j < step; j++) sum += State.freqArray[i * step + j];
            const avg   = sum / step;
            const barH  = (avg / 255) * barArea;
            const hue   = 120 - (avg / 255) * 100;
            ctx.fillStyle   = `hsl(${hue},100%,50%)`;
            ctx.shadowBlur  = 3;
            ctx.shadowColor = `hsl(${hue},100%,60%)`;
            ctx.fillRect(
                i * barW,
                h - 18 - barH,   // sit above label row
                Math.max(1, barW - 1),
                barH
            );
        }
        ctx.shadowBlur = 0;

        // ── freq axis labels ──
        ctx.fillStyle = sc + '99';
        ctx.font      = "9px 'Share Tech Mono'";
        const nyquist = State.audioCtx ? State.audioCtx.sampleRate / 2 : 22050;
        for (let k = 0; k <= 4; k++) {
            const freq  = (nyquist / 4) * k;
            const x     = (freq / nyquist) * w;
            const label = freq >= 1000 ? (freq / 1000).toFixed(1) + 'k' : freq + 'Hz';
            ctx.fillText(label, x + 2, h - 4);
        }

        // ── panel title ──
        ctx.fillStyle = sc + 'cc';
        ctx.font      = "bold 10px 'Share Tech Mono'";
        ctx.fillText('▼ FFT SPECTRUM', 8, splitY + 13);

        // ── dominant freq callout ──
        const mFreqEl = document.getElementById('mFreq');
        if (mFreqEl && mFreqEl.innerText !== '---') {
            const label = 'PEAK: ' + mFreqEl.innerText;
            const lw    = ctx.measureText(label).width;
            ctx.fillStyle = 'rgba(0,0,0,0.7)';
            ctx.fillRect(w - lw - 14, splitY + 3, lw + 10, 16);
            ctx.fillStyle = (State.measColor || '#00e5ff') + 'ee';
            ctx.fillText(label, w - lw - 9, splitY + 14);
        }
    }
};

// ── INFO VIEW OVERLAY: full canvas backdrop ──
const InfoView = {

    drawOverlay(ctx, w, h) {
        if (w < 10 || h < 10) return;

        const ic   = State.infoTextColor  || '#00e5ff';
        const font = FONT_MAP[State.infoFont] || FONT_MAP.mono;
        // FIXED: Properly apply font size scaling
        const baseSz = 11;
        const sz = Math.round(baseSz * (State.infoFontSize || 100) / 100);
        const sc   = State.scopeTextColor || '#00ff41';

        // ── full-canvas glass backdrop ──
        ctx.fillStyle = 'rgba(0,0,0,0.84)';
        ctx.fillRect(0, 0, w, h);

        // subtle border
        ctx.strokeStyle = ic + '33';
        ctx.lineWidth   = 1;
        ctx.strokeRect(4, 4, w - 8, h - 8);

        // ── two-column layout ──
        const colL  = 12;
        const colR  = Math.round(w * 0.46);
        const lineH = sz + 11;
        const startY = 34;

        const typeColors = {
            SINE: '#00e5ff', SQUARE: '#ffb300', TRIANGLE: '#e040fb',
            SAWTOOTH: '#ff6d00', NOISE: '#ff1744', DC: '#00ff41', '---': '#444',
        };
        const typeColor = typeColors[State.lastSignalType] || ic;

        const lines = [
            { label: 'SIGNAL',      val: State.lastSignalType,                              color: typeColor },
            { label: 'FREQUENCY',   val: document.getElementById('mFreq').innerText },
            { label: 'Vpp',         val: document.getElementById('mVpp').innerText },
            { label: 'RMS',         val: document.getElementById('mRms').innerText },
            { label: 'dBFS',        val: document.getElementById('mDb').innerText },
            { label: 'ZOOM',        val: State.zoom.toFixed(1) + 'x' },
            { label: 'GAIN',        val: State.gain.toFixed(1) + 'x' },
            { label: 'TRIGGER',     val: State.triggerEnabled
                ? `${State.triggerMode.toUpperCase()} ${State.triggerEdge === 'rising' ? '↑' : State.triggerEdge === 'falling' ? '↓' : '↕'} ${State.triggerUpper.toFixed(2)}V`
                : 'FREE RUN' },
            { label: 'CALIB F',     val: State.calibFreq.toFixed(3) + 'x' },
            { label: 'CALIB V',     val: State.calibVpp.toFixed(3)  + 'x' },
            { label: 'SAMPLE RATE', val: State.audioCtx ? State.audioCtx.sampleRate / 1000 + 'kHz' : '---' },
            { label: 'FFT SIZE',    val: State.fftSize.toString() },
            { label: 'STATUS',      val: State.isRunning ? (State.paused ? 'PAUSED' : 'LIVE') : 'IDLE',
              color: State.paused ? '#ffb300' : (State.isRunning ? '#00ff41' : '#444') },
        ];

        ctx.font = `${sz}px ${font}`;

        lines.forEach((line, i) => {
            const y = startY + i * lineH;
            if (y > h - 10) return;

            // label
            ctx.fillStyle = ic + '55';
            ctx.fillText(line.label, colL, y);

            // separator dot
            ctx.fillStyle = ic + '33';
            ctx.fillText(':', colR - 10, y);

            // value
            ctx.fillStyle = line.color || ic;
            ctx.fillText(line.val, colR, y);
        });

        // ── panel header ──
        ctx.font      = "bold 10px 'Share Tech Mono'";
        ctx.fillStyle = ic + 'aa';
        ctx.fillText('▼ SIGNAL DIAGNOSTICS', 8, 16);

        // ── live indicator top right ──
        if (State.isRunning && !State.paused) {
            ctx.fillStyle = '#00ff41cc';
            ctx.font      = "9px 'Share Tech Mono'";
            ctx.fillText('● LIVE', w - 42, 16);
        }
    }
};
