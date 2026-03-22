// ── OSCILLOSCOPE.JS v1.2.0 — channel-view pill support ──
const Oscilloscope = {

    draw(ctx, w, h) {
        if (w < 10 || h < 10) return;
        ctx.clearRect(0, 0, w, h);
        Grid.draw(ctx, w, h);

        // pick data buffer based on active view
        const viewCh   = State.oscViewChannel || 'ch1';
        let   viewData = State.dataArray;
        let   viewColor = State.waveColor;

        if (State.simMode) {
            if (viewCh === 'ch2' && State.ch2Data)  { viewData = State.ch2Data;  viewColor = '#ff1744'; }
            if (viewCh === 'ch3' && State.ch3Data)  { viewData = State.ch3Data;  viewColor = '#00e5ff'; }
            if (viewCh === 'ch1')                   { viewData = State.dataArray; viewColor = '#e040fb'; }
        }

        const data = State.triggerMode === 'single' && State.triggerFrame
            ? State.triggerFrame
            : viewData;
        if (!data) return;

        const visibleSamples = Math.floor(data.length / State.zoom);
        const { offset, fired } = Trigger.findOffset(visibleSamples);

        Trigger.drawThresholds(ctx, w, h);

        if (!fired && State.triggerMode === 'normal') {
            ctx.fillStyle = 'rgba(255,179,0,0.7)';
            ctx.font      = "14px 'Share Tech Mono'";
            ctx.fillText('WAITING FOR TRIGGER...', w / 2 - 110, h / 2);
            return;
        }

        const sliceW = w / visibleSamples;

        if (State.simMode && State.currentTab === 'sim') {
            // SIM tab — draw all enabled channels
            if (State.sim.ch3Enabled && State.ch3Data) {
                this._drawChannel(ctx, State.ch3Data, offset, visibleSamples, sliceW, w, h, '#00e5ff', 1.5, State.ch2Gain, 0);
            }
            if (State.sim.ch2Enabled && State.ch2Data) {
                this._drawChannel(ctx, State.ch2Data, offset, visibleSamples, sliceW, w, h, '#ff1744', 2, State.ch2Gain, State.ch2Offset);
            }
            if (State.sim.ch1Enabled) {
                this._drawChannel(ctx, State.dataArray, offset, visibleSamples, sliceW, w, h, '#e040fb', 2, State.ch1Gain, 0);
            }
        } else {
            // OSC / FFT / INFO tabs — single channel, full canvas, clean
            const gain = State.simMode
                ? (viewCh === 'ch2' ? State.ch2Gain : State.ch1Gain)
                : State.gain;
            this._drawChannel(ctx, data, offset, visibleSamples, sliceW, w, h, viewColor, 2.5, gain, 0);
        }

        // overlay label — top left
        ctx.fillStyle = (State.scopeTextColor || '#00e5ff') + '88';
        ctx.font      = "11px 'Share Tech Mono'";
        let modeStr;
        if (State.simMode) {
            const chLabel = { ch1: 'CH1', ch2: 'CH2', ch3: 'CH3' }[viewCh] || 'CH1';
            modeStr = State.currentTab === 'sim' ? 'CH1+CH2+CH3 | SIM' : `${chLabel} | SIM`;
        } else {
            modeStr = State.triggerEnabled
                ? `CH1 | TRIG:${State.triggerMode.toUpperCase()} ${State.triggerEdge === 'rising' ? '↑' : State.triggerEdge === 'falling' ? '↓' : '↕'}`
                : 'CH1 | FREE RUN';
        }
        ctx.fillText(modeStr, 8, 18);
    },

    _drawChannel(ctx, data, offset, visibleSamples, sliceW, w, h, color, lineWidth, gain, yOffset) {
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth   = lineWidth;
        ctx.shadowBlur  = 5;
        ctx.shadowColor = color + '99';
        ctx.beginPath();

        const g = (gain != null && gain > 0) ? gain : 3;
        const yo = yOffset || 0;
        let x = 0, prevY = null, validPoints = 0;

        for (let i = 0; i < visibleSamples; i++) {
            const idx = offset + i;
            if (idx >= data.length) break;
            const v      = ((data[idx] / 128.0) - 1.0) * g;
            const y      = (h / 2) - (v * h / Grid.ROWS) + yo;
            const cy     = Math.max(1, Math.min(h - 1, y));

            if (i === 0 || prevY === null) {
                ctx.moveTo(x, cy);
            } else if (Math.abs(cy - prevY) < h * 0.85) {
                ctx.lineTo(x, cy);
                validPoints++;
            } else {
                ctx.moveTo(x, cy);
            }
            prevY = cy;
            x += sliceW;
        }

        if (validPoints > 2) ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.restore();
    }
};
