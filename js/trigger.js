// ── TRIGGER.JS — trigger engine ──
const Trigger = {

    toggle() {
        State.triggerEnabled = !State.triggerEnabled;
        State.triggerArmed   = true;
        State.triggerFired   = false;
        const btn = document.getElementById('triggerBtn');
        btn.innerText  = State.triggerEnabled ? '⚡ TRIG ON' : '⚡ TRIG';
        btn.className  = State.triggerEnabled ? 'btn-active' : 'btn-secondary';
        this._updateStatus(State.triggerEnabled ? 'ARMED' : 'OFF');
    },

    setMode(mode) {
        State.triggerMode  = mode;
        State.triggerArmed = true;
        State.triggerFired = false;
        State.triggerFrame = null;
        // update button styles
        ['auto','normal','single'].forEach(m => {
            const el = document.getElementById('tmode-' + m);
            if (el) el.classList.toggle('active', m === mode);
        });
        this._updateStatus('ARMED');
    },

    setEdge(edge) {
        State.triggerEdge = edge;
        ['rising','falling','both'].forEach(e => {
            const el = document.getElementById('tedge-' + e);
            if (el) el.classList.toggle('active', e === edge);
        });
    },

    updateUpper(val) {
        State.triggerUpper = val / 100;
        document.getElementById('trigUpperVal').innerText =
            (State.triggerUpper >= 0 ? '+' : '') + State.triggerUpper.toFixed(2) + 'V';
        this._updateMarkers();
    },

    updateLower(val) {
        State.triggerLower = val / 100;
        document.getElementById('trigLowerVal').innerText =
            (State.triggerLower >= 0 ? '+' : '') + State.triggerLower.toFixed(2) + 'V';
        this._updateMarkers();
    },

    setManual() {
        const input = document.getElementById('trigManualInput');
        const v = parseFloat(input.value);
        if (isNaN(v)) return;
        const clamped = Math.max(-1, Math.min(1, v));
        State.triggerUpper =  Math.abs(clamped);
        State.triggerLower = -Math.abs(clamped);
        document.getElementById('trigUpperSlider').value = State.triggerUpper * 100;
        document.getElementById('trigLowerSlider').value = State.triggerLower * 100;
        this.updateUpper(State.triggerUpper * 100);
        this.updateLower(State.triggerLower * 100);
    },

    forceArm() {
        State.triggerArmed = true;
        State.triggerFired = false;
        State.triggerFrame = null;
        this._updateStatus('ARMED');
    },

    // ── CORE: find trigger offset in dataArray ──
    // Returns { offset, fired }
    findOffset(visibleSamples) {
        if (!State.triggerEnabled) return { offset: 0, fired: true };

        const data       = State.dataArray;
        const upperRaw   = Math.round((State.triggerUpper + 1) * 128); // 0-255
        const lowerRaw   = Math.round((State.triggerLower + 1) * 128);
        const searchEnd  = data.length - visibleSamples - 1;

        // SINGLE mode: return frozen frame if already fired
        if (State.triggerMode === 'single') {
            if (State.triggerFired && State.triggerFrame) {
                return { offset: 0, fired: true, frozen: true };
            }
            if (!State.triggerArmed) return { offset: 0, fired: false };
        }

        // NORMAL mode: if not armed, skip
        if (State.triggerMode === 'normal' && !State.triggerArmed) {
            return { offset: 0, fired: false };
        }

        // Search for edge crossing
        for (let i = 1; i < searchEnd; i++) {
            const prev = data[i - 1];
            const curr = data[i];
            let hit = false;

            if (State.triggerEdge === 'rising' || State.triggerEdge === 'both') {
                if (prev < upperRaw && curr >= upperRaw) hit = true;
            }
            if (State.triggerEdge === 'falling' || State.triggerEdge === 'both') {
                if (prev > lowerRaw && curr <= lowerRaw) hit = true;
            }

            if (hit) {
                // SINGLE: freeze frame
                if (State.triggerMode === 'single') {
                    State.triggerFrame  = new Uint8Array(data);
                    State.triggerFired  = true;
                    State.triggerArmed  = false;
                }
                // NORMAL: re-arm after each fire
                if (State.triggerMode === 'normal') {
                    State.triggerArmed = false;
                    setTimeout(() => { State.triggerArmed = true; }, 50);
                }

                this._updateStatus('FIRED');
                document.getElementById('trigLastFire').innerText = new Date().toLocaleTimeString();
                return { offset: i, fired: true };
            }
        }

        // AUTO mode: display anyway even if no trigger
        if (State.triggerMode === 'auto') return { offset: 0, fired: true };

        // No trigger found
        this._updateStatus('WAITING');
        return { offset: 0, fired: false };
    },

    // Draw threshold lines on canvas
    drawThresholds(ctx, w, h) {
        const upperY = h/2 - (State.triggerUpper * h/2);
        const lowerY = h/2 - (State.triggerLower * h/2);
        const alpha  = State.triggerEnabled ? 0.75 : 0.2;

        ctx.save();
        ctx.strokeStyle = `rgba(255,179,0,${alpha})`;
        ctx.lineWidth   = 1;
        ctx.setLineDash([5, 5]);

        // upper threshold line
        ctx.beginPath(); ctx.moveTo(0, upperY); ctx.lineTo(w, upperY); ctx.stroke();
        // lower threshold line
        ctx.beginPath(); ctx.moveTo(0, lowerY); ctx.lineTo(w, lowerY); ctx.stroke();

        ctx.setLineDash([]);
        ctx.restore();

        // labels
        ctx.save();
        ctx.font      = "bold 9px 'Share Tech Mono'";
        const alphaFill = State.triggerEnabled ? 0.9 : 0.3;

        ctx.fillStyle = `rgba(255,179,0,${alphaFill})`;
        ctx.fillText(`T+ ${State.triggerUpper >= 0 ? '+' : ''}${State.triggerUpper.toFixed(2)}V`, w - 72, upperY - 3);
        ctx.fillText(`T- ${State.triggerLower >= 0 ? '+' : ''}${State.triggerLower.toFixed(2)}V`, w - 72, lowerY + 11);
        ctx.restore();

        // update side markers
        this._updateMarkers();
    },

    _updateMarkers() {
        const area = document.getElementById('scopeArea');
        if (!area) return;
        const h = area.clientHeight;
        const upperPct = (0.5 - State.triggerUpper * 0.5) * 100;
        const lowerPct = (0.5 - State.triggerLower * 0.5) * 100;
        const top  = document.getElementById('trigMarkerTop');
        const bot  = document.getElementById('trigMarkerBot');
        if (top) top.style.top    = `${upperPct}%`;
        if (bot) bot.style.top    = `${lowerPct}%`;
    },

    _updateStatus(s) {
        const el = document.getElementById('trigStatusVal');
        if (!el) return;
        el.innerText  = s;
        el.style.color = s === 'FIRED' ? '#00ff41'
                       : s === 'WAITING' ? '#ff1744'
                       : s === 'ARMED'   ? '#ffb300'
                       : '#006600';
    }
};
