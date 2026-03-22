// ── FFT.JS v1.2.0 ──

const FFT = {
    drawOverlay(ctx, w, h) {
        if (w < 10 || h < 10 || !State.freqArray) return;

        const splitY = Math.round(h * 0.48);
        const sc     = State.scopeTextColor || '#00e5ff';

        ctx.fillStyle = 'rgba(0,0,0,0.88)';
        ctx.fillRect(0, splitY, w, h - splitY);

        ctx.strokeStyle = sc + '55';
        ctx.lineWidth   = 1;
        ctx.beginPath();
        ctx.moveTo(0, splitY);
        ctx.lineTo(w, splitY);
        ctx.stroke();

        const barCount = 120;
        const step     = Math.floor(State.freqArray.length / barCount);
        const barW     = w / barCount;
        const barArea  = h - splitY - 22;

        for (let i = 0; i < barCount; i++) {
            let sum = 0;
            for (let j = 0; j < step; j++) sum += State.freqArray[i * step + j];
            const avg  = sum / step;
            const barH = (avg / 255) * barArea;
            const hue  = 120 - (avg / 255) * 100;
            ctx.fillStyle   = `hsl(${hue},100%,50%)`;
            ctx.shadowBlur  = 3;
            ctx.shadowColor = `hsl(${hue},100%,60%)`;
            ctx.fillRect(i * barW, h - 22 - barH, Math.max(1, barW - 1), barH);
        }
        ctx.shadowBlur = 0;

        ctx.fillStyle = sc + '99';
        ctx.font      = "11px 'Share Tech Mono'";
        const nyquist = State.simMode
            ? State.simSampleRate / 2
            : (State.audioCtx ? State.audioCtx.sampleRate / 2 : 22050);
        for (let k = 0; k <= 4; k++) {
            const freq  = (nyquist / 4) * k;
            const x     = (freq / nyquist) * w;
            const label = freq >= 1000 ? (freq / 1000).toFixed(1) + 'k' : freq + 'Hz';
            ctx.fillText(label, x + 2, h - 5);
        }

        ctx.fillStyle = sc + 'cc';
        ctx.font      = "bold 11px 'Share Tech Mono'";
        ctx.fillText('▼ FFT SPECTRUM', 8, splitY + 15);

        const mFreqEl = document.getElementById('mFreq');
        if (mFreqEl && mFreqEl.innerText !== '---') {
            const label = 'PEAK: ' + mFreqEl.innerText;
            const lw    = ctx.measureText(label).width;
            ctx.fillStyle = 'rgba(0,0,0,0.7)';
            ctx.fillRect(w - lw - 14, splitY + 3, lw + 10, 18);
            ctx.fillStyle = (State.measColor || '#ffb300') + 'ee';
            ctx.fillText(label, w - lw - 9, splitY + 15);
        }
    }
};

// ── INFO VIEW OVERLAY ──
const InfoView = {
    drawOverlay(ctx, w, h) {
        if (w < 10 || h < 10) return;

        const ic   = State.infoTextColor  || '#ffb300';
        const font = FONT_MAP[State.infoFont] || FONT_MAP.mono;
        const sz   = Math.round(12 * (State.infoFontSize || 100) / 100);

        ctx.fillStyle = 'rgba(0,0,0,0.84)';
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = ic + '33';
        ctx.lineWidth   = 1;
        ctx.strokeRect(4, 4, w - 8, h - 8);

        const colL  = 12;
        const colR  = Math.round(w * 0.46);
        const lineH = sz + 12;
        const startY = 36;

        const typeColors = {
            SINE:'#00e5ff', SQUARE:'#ffb300', TRIANGLE:'#e040fb',
            SAWTOOTH:'#ff6d00', NOISE:'#ff1744', DC:'#00ff41', '---':'#444',
        };
        const sr = State.simMode ? State.simSampleRate : (State.audioCtx ? State.audioCtx.sampleRate : 0);

        const lines = [
            { label: 'SIGNAL',      val: State.lastSignalType, color: typeColors[State.lastSignalType] || ic },
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
            { label: 'SAMPLE RATE', val: sr ? sr / 1000 + 'kHz' : '---' },
            { label: 'FFT SIZE',    val: State.fftSize.toString() },
            { label: 'MODE',        val: State.simMode ? 'SIMULATOR' : 'LIVE MIC', color: State.simMode ? '#e040fb' : '#00ff41' },
            { label: 'STATUS',      val: State.isRunning ? (State.paused ? 'PAUSED' : 'LIVE') : (State.simMode ? 'SIM' : 'IDLE'),
              color: State.paused ? '#ffb300' : (State.isRunning || State.simMode ? '#00ff41' : '#444') },
        ];

        ctx.font = `${sz}px ${font}`;
        lines.forEach((line, i) => {
            const y = startY + i * lineH;
            if (y > h - 10) return;
            ctx.fillStyle = ic + '55';
            ctx.fillText(line.label, colL, y);
            ctx.fillStyle = ic + '33';
            ctx.fillText(':', colR - 10, y);
            ctx.fillStyle = line.color || ic;
            ctx.fillText(line.val, colR, y);
        });

        ctx.font      = "bold 11px 'Share Tech Mono'";
        ctx.fillStyle = ic + 'aa';
        ctx.fillText('▼ SIGNAL DIAGNOSTICS', 8, 18);

        if ((State.isRunning || State.simMode) && !State.paused) {
            ctx.fillStyle = '#00ff41cc';
            ctx.font      = "10px 'Share Tech Mono'";
            ctx.fillText(State.simMode ? '● SIM' : '● LIVE', w - 50, 18);
        }
    }
};

// ── SIM VIEW OVERLAY — bigger detected box ──
const SimView = {
    drawOverlay(ctx, w, h) {
        if (w < 10 || h < 10) return;
        const sc = State.scopeTextColor || '#00e5ff';
        const ac = '#ffb300';

        // Top-left: channel labels
        ctx.fillStyle = sc + '88';
        ctx.font      = "11px 'Share Tech Mono'";
        let label = '';
        if (State.sim.ch1Enabled) label = '●CH1';
        if (State.sim.ch2Enabled) label += (label ? ' ●CH2' : '●CH2');
        if (State.sim.ch3Enabled) label += (label ? ' ●CH3' : '●CH3');
        ctx.fillText(label + ' | SIM', 8, 18);

        // Top-right: sample rate
        ctx.fillStyle = sc + '66';
        const srLabel = `${(State.simSampleRate / 1000).toFixed(1)}kHz`;
        const srW     = ctx.measureText(srLabel).width;
        ctx.fillText(srLabel, w - srW - 8, 18);

        // ── DETECTED ARTIFACTS BOX — bigger and readable ──
        if (State.analyserResult && State.analyserResult.detected && State.sim.ch2Enabled) {
            const detected = State.analyserResult.detected;
            if (detected.length > 0) {
                const itemH  = 20;   // pixels per row (was 14)
                const boxW   = Math.min(w - 16, 260);  // wider (was 180)
                const boxH   = Math.min(detected.length * itemH + 28, 160);
                const boxX   = 8;
                const boxY   = h - boxH - 8;

                // Background
                ctx.fillStyle = 'rgba(0,0,0,0.82)';
                ctx.fillRect(boxX, boxY, boxW, boxH);
                ctx.strokeStyle = ac + '66';
                ctx.lineWidth = 1.5;
                ctx.strokeRect(boxX, boxY, boxW, boxH);

                // Title
                ctx.fillStyle = ac;
                ctx.font = "bold 11px 'Share Tech Mono'";
                ctx.fillText('⚡ DETECTED ARTIFACTS', boxX + 10, boxY + 16);

                // Horizontal separator
                ctx.strokeStyle = ac + '33';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(boxX + 6, boxY + 20);
                ctx.lineTo(boxX + boxW - 6, boxY + 20);
                ctx.stroke();

                // Items
                ctx.font = "11px 'Share Tech Mono'";
                const maxShow = Math.min(6, detected.length);
                for (let i = 0; i < maxShow; i++) {
                    const item = detected[i];
                    const iy   = boxY + 32 + i * itemH;

                    // Label
                    ctx.fillStyle = sc + 'dd';
                    ctx.fillText(item.label, boxX + 10, iy);

                    // Value — right side
                    ctx.fillStyle = ac;
                    const valTxt = item.value;
                    const valW   = ctx.measureText(valTxt).width;
                    ctx.fillText(valTxt, boxX + boxW - valW - 10, iy);

                    // Bar — middle
                    const barX   = boxX + 90;
                    const barMax = boxW - 100 - valW - 14;
                    if (barMax > 10) {
                        ctx.fillStyle = 'rgba(255,255,255,0.08)';
                        ctx.fillRect(barX, iy - 10, barMax, 6);
                        const barFill = Math.max(2, (item.barValue ?? item.confidence) / 100 * barMax);
                        ctx.fillStyle = item.confidence > 80 ? '#00ff41' : item.confidence > 60 ? '#ffb300' : '#ff6d00';
                        ctx.fillRect(barX, iy - 10, barFill, 6);
                    }
                }

                if (detected.length > 6) {
                    ctx.fillStyle = ac + '88';
                    ctx.font      = "10px 'Share Tech Mono'";
                    ctx.fillText(`+${detected.length - 6} more…`, boxX + 10, boxY + boxH - 6);
                }
            }
        }

        // Bottom-right: freq
        if (State.sim.frequency) {
            const fLabel = State.sim.frequency >= 1000
                ? (State.sim.frequency / 1000).toFixed(2) + 'kHz'
                : State.sim.frequency + 'Hz';
            ctx.fillStyle = (State.measColor || '#ffb300') + 'cc';
            ctx.font      = "bold 11px 'Share Tech Mono'";
            const fW = ctx.measureText(fLabel).width;
            ctx.fillText(fLabel, w - fW - 8, h - 8);
        }
    }
};
