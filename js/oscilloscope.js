// ── OSCILLOSCOPE.JS v1.1.2 FIXED — Multi-channel stable rendering ──
const Oscilloscope = {
    draw(ctx, w, h) {
        if (w < 10 || h < 10) return;
        ctx.clearRect(0, 0, w, h);
        Grid.draw(ctx, w, h);

        const data = State.triggerMode === 'single' && State.triggerFrame
            ? State.triggerFrame
            : State.dataArray;
        if (!data) return;

        const visibleSamples = Math.floor(data.length / State.zoom);
        const { offset, fired } = Trigger.findOffset(visibleSamples);

        Trigger.drawThresholds(ctx, w, h);

        if (!fired && State.triggerMode === 'normal') {
            ctx.fillStyle = 'rgba(255,179,0,0.6)';
            ctx.font      = "13px 'Share Tech Mono'";
            ctx.fillText('WAITING FOR TRIGGER...', w / 2 - 100, h / 2);
            return;
        }

        // ══════════════════════════════════════
        // MULTI-CHANNEL RENDERING (SIM MODE)
        // ══════════════════════════════════════
        if (State.simMode) {
            const sliceW = w / visibleSamples;
            
            // ── CH3: Corrected (cyan) — draw first (background layer) ──
            if (State.sim.ch3Enabled && State.ch3Data) {
                this._drawChannel(ctx, State.ch3Data, offset, visibleSamples, sliceW, w, h, '#00e5ff', 1.5);
            }

            // ── CH2: Mic raw (red) — middle layer ──
            if (State.sim.ch2Enabled && State.ch2Data) {
                this._drawChannel(ctx, State.ch2Data, offset, visibleSamples, sliceW, w, h, '#ff1744', 2);
            }

            // ── CH1: Reference (purple) — foreground layer ──
            if (State.sim.ch1Enabled) {
                this._drawChannel(ctx, data, offset, visibleSamples, sliceW, w, h, '#e040fb', 2);
            }
        } else {
            // ══════════════════════════════════════
            // SINGLE CHANNEL (LIVE MODE)
            // ══════════════════════════════════════
            const sliceW = w / visibleSamples;
            this._drawChannel(ctx, data, offset, visibleSamples, sliceW, w, h, State.waveColor, 2);
        }

        // ── Overlay text ──
        ctx.fillStyle = (State.scopeTextColor || '#00e5ff') + '66';
        ctx.font      = "10px 'Share Tech Mono'";
        
        if (State.simMode) {
            let label = '';
            if (State.sim.ch1Enabled) label += 'CH1';
            if (State.sim.ch2Enabled) label += (label ? ' + CH2' : 'CH2');
            if (State.sim.ch3Enabled) label += (label ? ' + CH3' : 'CH3');
            label += ' | SIM';
            ctx.fillText(label, 8, 16);
        } else {
            const modeStr = State.triggerEnabled
                ? `CH1 | TRIG:${State.triggerMode.toUpperCase()} ${
                    State.triggerEdge === 'rising'  ? '↑' :
                    State.triggerEdge === 'falling' ? '↓' : '↕'}`
                : 'CH1 | FREE RUN';
            ctx.fillText(modeStr, 8, 16);
        }
    },

    // ── Stable single-channel renderer ──
    _drawChannel(ctx, data, offset, visibleSamples, sliceW, w, h, color, lineWidth) {
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth   = lineWidth;
        ctx.shadowBlur  = 4;
        ctx.shadowColor = color + '88';
        ctx.beginPath();

        let x = 0;
        let validPoints = 0;
        
        for (let i = 0; i < visibleSamples; i++) {
            const idx = offset + i;
            if (idx >= data.length) break;
            
            const raw = data[idx];
            const v   = ((raw / 128.0) - 1.0) * State.gain;
            const y   = h / 2 - (v * h / Grid.ROWS);
            
            // ✅ Clamp Y to prevent instability
            const clampedY = Math.max(1, Math.min(h - 1, y));
            
            if (i === 0) {
                ctx.moveTo(x, clampedY);
            } else {
                // ✅ Skip huge jumps (prevents visual glitches)
                const prevY = ctx.currentY || clampedY;
                if (Math.abs(clampedY - prevY) < h * 0.8) {
                    ctx.lineTo(x, clampedY);
                    validPoints++;
                } else {
                    ctx.moveTo(x, clampedY);
                }
            }
            
            ctx.currentY = clampedY;
            x += sliceW;
        }
        
        // Only draw if we have valid points
        if (validPoints > 2) {
            ctx.stroke();
        }
        
        ctx.shadowBlur = 0;
        ctx.restore();
    }
};
