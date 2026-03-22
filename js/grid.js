// ── GRID.JS v1.2.0 — CLEAR LABELS ──
const Grid = {
    COLS: 10,
    ROWS: 8,

    draw(ctx, w, h) {
        if (w < 10 || h < 10) return;

        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, w, h);

        const gc = State.gridColor || '#001a1a';
        // minor grid
        ctx.strokeStyle = gc;
        ctx.lineWidth   = 1;
        for (let i = 1; i < this.COLS; i++) {
            ctx.beginPath(); ctx.moveTo(i * w / this.COLS, 0); ctx.lineTo(i * w / this.COLS, h); ctx.stroke();
        }
        for (let i = 1; i < this.ROWS; i++) {
            ctx.beginPath(); ctx.moveTo(0, i * h / this.ROWS); ctx.lineTo(w, i * h / this.ROWS); ctx.stroke();
        }

        // center axes — brighter
        ctx.strokeStyle = this._brighten(gc, 2.5);
        ctx.lineWidth   = 1.5;
        ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h); ctx.stroke();

        // tick marks on center axes
        ctx.strokeStyle = this._brighten(gc, 3.5);
        ctx.lineWidth   = 1;
        for (let i = 0; i <= this.COLS * 5; i++) {
            const x = i * w / (this.COLS * 5);
            ctx.beginPath(); ctx.moveTo(x, h / 2 - 4); ctx.lineTo(x, h / 2 + 4); ctx.stroke();
        }
        for (let i = 0; i <= this.ROWS * 5; i++) {
            const y = i * h / (this.ROWS * 5);
            ctx.beginPath(); ctx.moveTo(w / 2 - 4, y); ctx.lineTo(w / 2 + 4, y); ctx.stroke();
        }

        this.drawDivLabels(ctx, w, h);
    },

    drawDivLabels(ctx, w, h) {
        const sr = State.simMode
            ? State.simSampleRate
            : (State.audioCtx ? State.audioCtx.sampleRate : null);
        const da = State.dataArray;
        if (!sr || !da) return;

        const sc = State.scopeTextColor || '#00e5ff';
        const mc = State.measColor      || '#ffb300';

        // ── TIME/DIV label ──
        let tdLabel;
        if (State.timeDivIndex !== null) {
            const ms = TIME_DIV_STEPS[State.timeDivIndex];
            tdLabel = ms >= 1 ? ms.toFixed(0) + 'ms/div' : (ms * 1000).toFixed(0) + 'µs/div';
        } else {
            const samplesVisible = Math.floor(da.length / State.zoom);
            const msPerDiv = (samplesVisible / sr * 1000) / this.COLS;
            tdLabel = msPerDiv >= 1
                ? msPerDiv.toFixed(2) + 'ms/div'
                : (msPerDiv * 1000).toFixed(1) + 'µs/div';
        }

        // ── VOLT/DIV label ──
        let vdLabel;
        if (State.voltDivIndex !== null) {
            vdLabel = VOLT_DIV_STEPS[State.voltDivIndex].toFixed(2) + 'V/div';
        } else {
            const vPerDiv = (2.0 / State.gain) / (this.ROWS / 2);
            vdLabel = vPerDiv < 0.01
                ? (vPerDiv * 1000).toFixed(1) + 'mV/div'
                : vPerDiv.toFixed(3) + 'V/div';
        }

        ctx.save();

        // ── TIME/DIV — bottom left ──
        ctx.font = "bold 13px 'Share Tech Mono'";
        const tBox = ctx.measureText(tdLabel).width;
        ctx.fillStyle = 'rgba(0,0,0,0.75)';
        ctx.fillRect(3, h - 22, tBox + 14, 20);
        ctx.fillStyle = sc;
        ctx.fillText(tdLabel, 10, h - 7);

        // ── VOLT/DIV — bottom right ──
        const vBox = ctx.measureText(vdLabel).width;
        ctx.fillStyle = 'rgba(0,0,0,0.75)';
        ctx.fillRect(w - vBox - 17, h - 22, vBox + 14, 20);
        ctx.fillStyle = mc;
        ctx.fillText(vdLabel, w - vBox - 10, h - 7);

        // ── VOLT SCALE — left side markers ──
        ctx.font      = "bold 11px 'Share Tech Mono'";
        const vFull   = (2.0 / State.gain);
        // only draw at main division lines
        for (let i = 0; i <= this.ROWS; i++) {
            const v = vFull - (i / this.ROWS) * vFull * 2;
            const y = i * h / this.ROWS;
            if (Math.abs(v) < 0.0005) continue; // skip zero line (centre)
            const label = (v > 0 ? '+' : '') + v.toFixed(2) + 'V';
            const lw    = ctx.measureText(label).width;
            // dark pill background so it's readable over any waveform
            ctx.fillStyle = 'rgba(0,0,0,0.65)';
            ctx.fillRect(1, y - 10, lw + 8, 14);
            ctx.fillStyle = sc + 'cc';
            ctx.fillText(label, 5, y + 2);
        }

        ctx.restore();
    },

    _brighten(hex, factor) {
        try {
            const r = parseInt(hex.slice(1,3),16);
            const g = parseInt(hex.slice(3,5),16);
            const b = parseInt(hex.slice(5,7),16);
            return `rgb(${Math.min(255,Math.round(r*factor))},${Math.min(255,Math.round(g*factor))},${Math.min(255,Math.round(b*factor))})`;
        } catch(e) { return hex; }
    }
};
