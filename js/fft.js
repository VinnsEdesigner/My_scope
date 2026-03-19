// ── FFT.JS v1.1.2 FIXED — With compact analyser overlay ──

const FFT = {

    drawOverlay(ctx, w, h) {
        if (w < 10 || h < 10 || !State.freqArray) return;

        const splitY = Math.round(h * 0.48);
        const sc     = State.scopeTextColor || '#00e5ff';

        // backdrop
        ctx.fillStyle = 'rgba(0,0,0,0.88)';
        ctx.fillRect(0, splitY, w, h - splitY);

        // top border
        ctx.strokeStyle = sc + '55';
        ctx.lineWidth   = 1;
        ctx.beginPath();
        ctx.moveTo(0, splitY);
        ctx.lineTo(w, splitY);
        ctx.stroke();

        // FFT bars
        const barCount = 120;
        const step     = Math.floor(State.freqArray.length / barCount);
        const barW     = w / barCount;
        const barArea  = h - splitY - 18;

        for (let i = 0; i < barCount; i++) {
            let sum = 0;
            for (let j = 0; j < step; j++) sum += State.freqArray[i * step + j];
            const avg  = sum / step;
            const barH = (avg / 255) * barArea;
            const hue  = 120 - (avg / 255) * 100;
            ctx.fillStyle   = `hsl(${hue},100%,50%)`;
            ctx.shadowBlur  = 3;
            ctx.shadowColor = `hsl(${hue},100%,60%)`;
            ctx.fillRect(i * barW, h - 18 - barH, Math.max(1, barW - 1), barH);
        }
        ctx.shadowBlur = 0;

        // freq axis labels
        ctx.fillStyle = sc + '99';
        ctx.font      = "9px 'Share Tech Mono'";
        const nyquist = State.simMode
            ? State.simSampleRate / 2
            : (State.audioCtx ? State.audioCtx.sampleRate / 2 : 22050);
        for (let k = 0; k <= 4; k++) {
            const freq  = (nyquist / 4) * k;
            const x     = (freq / nyquist) * w;
            const label = freq >= 1000 ? (freq / 1000).toFixed(1) + 'k' : freq + 'Hz';
            ctx.fillText(label, x + 2, h - 4);
        }

        // panel title
        ctx.fillStyle = sc + 'cc';
        ctx.font      = "bold 10px 'Share Tech Mono'";
        ctx.fillText('▼ FFT SPECTRUM', 8, splitY + 13);

        // dominant freq callout
        const mFreqEl = document.getElementById('mFreq');
        if (mFreqEl && mFreqEl.innerText !== '---') {
            const label = 'PEAK: ' + mFreqEl.innerText;
            const lw    = ctx.measureText(label).width;
            ctx.fillStyle = 'rgba(0,0,0,0.7)';
            ctx.fillRect(w - lw - 14, splitY + 3, lw + 10, 16);
            ctx.fillStyle = (State.measColor || '#ffb300') + 'ee';
            ctx.fillText(label, w - lw - 9, splitY + 14);
        }
    }
};

// ── INFO VIEW OVERLAY ──
const InfoView = {
    drawOverlay(ctx, w, h) {
        if (w < 10 || h < 10) return;

        const ic   = State.infoTextColor  || '#ffb300';
        const font = FONT_MAP[State.infoFont] || FONT_MAP.mono;
        const baseSz = 11;
        const sz     = Math.round(baseSz * (State.infoFontSize || 100) / 100);

        ctx.fillStyle = 'rgba(0,0,0,0.84)';
        ctx.fillRect(0, 0, w, h);

        ctx.strokeStyle = ic + '33';
        ctx.lineWidth   = 1;
        ctx.strokeRect(4, 4, w - 8, h - 8);

        const colL  = 12;
        const colR  = Math.round(w * 0.46);
        const lineH = sz + 11;
        const startY = 34;

        const typeColors = {
            SINE: '#00e5ff', SQUARE: '#ffb300', TRIANGLE: '#e040fb',
            SAWTOOTH: '#ff6d00', NOISE: '#ff1744', DC: '#00ff41', '---': '#444',
        };
        const typeColor = typeColors[State.lastSignalType] || ic;

        const sr = State.simMode
            ? State.simSampleRate
            : (State.audioCtx ? State.audioCtx.sampleRate : 0);

        const lines = [
            { label: 'SIGNAL',      val: State.lastSignalType,                        color: typeColor },
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
            { label: 'MODE',        val: State.simMode ? 'SIMULATOR' : 'LIVE MIC',
              color: State.simMode ? '#e040fb' : '#00ff41' },
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

        ctx.font      = "bold 10px 'Share Tech Mono'";
        ctx.fillStyle = ic + 'aa';
        ctx.fillText('▼ SIGNAL DIAGNOSTICS', 8, 16);

        if ((State.isRunning || State.simMode) && !State.paused) {
            ctx.fillStyle = '#00ff41cc';
            ctx.font      = "9px 'Share Tech Mono'";
            ctx.fillText(State.simMode ? '● SIM' : '● LIVE', w - 42, 16);
        }
    }
};

// ✅ NEW: SIM VIEW OVERLAY with compact analyser
const SimView = {
    drawOverlay(ctx, w, h) {
        if (w < 10 || h < 10) return;
        const sc = State.scopeTextColor || '#00e5ff';
        const ac = '#ffb300'; // analyser color

        // Top-left: channel labels
        ctx.fillStyle = sc + '88';
        ctx.font      = "10px 'Share Tech Mono'";
        let label = '';
        if (State.sim.ch1Enabled) label = '●CH1';
        if (State.sim.ch2Enabled) label += (label ? ' ●CH2' : '●CH2');
        if (State.sim.ch3Enabled) label += (label ? ' ●CH3' : '●CH3');
        ctx.fillText(label + ' | SIM', 8, 16);

        // Top-right: sample rate
        ctx.fillStyle = sc + '66';
        const srLabel = `${(State.simSampleRate / 1000).toFixed(1)}kHz`;
        const srW     = ctx.measureText(srLabel).width;
        ctx.fillText(srLabel, w - srW - 8, 16);

        // ✅ COMPACT ANALYSER INFO (bottom-left corner)
        if (State.analyserResult && State.analyserResult.detected && State.sim.ch2Enabled) {
            const detected = State.analyserResult.detected;
            if (detected.length > 0) {
                // Semi-transparent background box
                const boxH = Math.min(detected.length * 14 + 20, 120);
                const boxW = 180;
                ctx.fillStyle = 'rgba(0,0,0,0.75)';
                ctx.fillRect(4, h - boxH - 4, boxW, boxH);
                
                // Border
                ctx.strokeStyle = ac + '44';
                ctx.lineWidth = 1;
                ctx.strokeRect(4, h - boxH - 4, boxW, boxH);

                // Title
                ctx.fillStyle = ac + 'cc';
                ctx.font = "bold 9px 'Share Tech Mono'";
                ctx.fillText('⚡ DETECTED', 10, h - boxH + 8);

                // Detected artifacts (max 6 shown)
                ctx.font = "8px 'Share Tech Mono'";
                const maxShow = Math.min(6, detected.length);
                for (let i = 0; i < maxShow; i++) {
                    const item = detected[i];
                    const y = h - boxH + 22 + (i * 14);
                    
                    // Label
                    ctx.fillStyle = '#00e5ff' + '99';
                    ctx.fillText(item.label, 10, y);
                    
                    // Value
                    ctx.fillStyle = ac;
                    const valW = ctx.measureText(item.value).width;
                    ctx.fillText(item.value, boxW - valW - 6, y);
                    
                    // Confidence bar (mini)
                    const barW = 30;
                    const barX = boxW - barW - valW - 12;
                    ctx.fillStyle = '#333';
                    ctx.fillRect(barX, y - 7, barW, 3);
                    ctx.fillStyle = item.confidence > 80 ? '#00ff41' : item.confidence > 60 ? '#ffb300' : '#ff6d00';
                    ctx.fillRect(barX, y - 7, barW * (item.confidence / 100), 3);
                }

                // "More..." indicator if truncated
                if (detected.length > 6) {
                    ctx.fillStyle = ac + '66';
                    ctx.fillText(`+${detected.length - 6} more...`, 10, h - 10);
                }
            }
        }

        // Bottom-right: freq display
        if (State.sim.frequency) {
            const fLabel = State.sim.frequency >= 1000
                ? (State.sim.frequency / 1000).toFixed(2) + 'kHz'
                : State.sim.frequency + 'Hz';
            ctx.fillStyle = (State.measColor || '#ffb300') + 'cc';
            ctx.font      = "bold 10px 'Share Tech Mono'";
            const fW = ctx.measureText(fLabel).width;
            ctx.fillText(fLabel, w - fW - 8, h - 8);
        }
    }
};
