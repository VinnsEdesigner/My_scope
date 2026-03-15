// ── OSCILLOSCOPE.JS v1.0.1 ──
const Oscilloscope = {
    draw(ctx, w, h) {
        if (w < 10 || h < 10) return;

        // ALWAYS clear full canvas before drawing
        ctx.clearRect(0, 0, w, h);
        Grid.draw(ctx, w, h);

        const data = State.triggerMode === 'single' && State.triggerFrame
            ? State.triggerFrame
            : State.dataArray;
        if (!data) return;

        const visibleSamples = Math.floor(data.length / State.zoom);
        const { offset, fired } = Trigger.findOffset(visibleSamples);

        // draw thresholds
        Trigger.drawThresholds(ctx, w, h);

        if (!fired && State.triggerMode === 'normal') {
            ctx.fillStyle = 'rgba(255,179,0,0.6)';
            ctx.font      = "13px 'Share Tech Mono'";
            ctx.fillText('WAITING FOR TRIGGER...', w/2 - 100, h/2);
            return;
        }

        // ── WAVEFORM ──
        ctx.save();
        ctx.strokeStyle = '#00ff41';
        ctx.lineWidth   = 2;
        ctx.shadowBlur  = 5;
        ctx.shadowColor = '#00ff41';
        ctx.beginPath();

        const sliceW = w / visibleSamples;
        let x = 0;
        for (let i = 0; i < visibleSamples; i++) {
            const idx = offset + i;
            if (idx >= data.length) break;
            const raw = data[idx];
            const v   = ((raw / 128.0) - 1.0) * State.gain;
            const y   = h/2 - (v * h / Grid.ROWS);
            if (i === 0) ctx.moveTo(x, Math.max(1, Math.min(h - 1, y)));
            else         ctx.lineTo(x, Math.max(1, Math.min(h - 1, y)));
            x += sliceW;
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.restore();

        // mode label
        ctx.fillStyle = '#004400';
        ctx.font      = "10px 'Share Tech Mono'";
        const modeStr = State.triggerEnabled
            ? `CH1 | TRIG:${State.triggerMode.toUpperCase()} ${
                State.triggerEdge === 'rising' ? '↑' :
                State.triggerEdge === 'falling' ? '↓' : '↕'}`
            : 'CH1 | FREE RUN';
        ctx.fillText(modeStr, 8, 16);
    }
};
