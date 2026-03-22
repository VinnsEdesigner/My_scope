// ── MEASUREMENTS.JS v1.1.2 ──
const Measurements = {

    update() {
        if (!State.dataArray) return;

        if (State.simMode) {
            const freqEl = document.getElementById('mFreq');
            if (freqEl) {
                const freq = State.sim.frequency;
                freqEl.innerText = freq >= 1000
                    ? (freq / 1000).toFixed(2) + 'kHz'
                    : freq + 'Hz';
                freqEl.className = 'meas-value';
            }
        }

        const data = State.dataArray;
        let min = 255, max = 0, sumSq = 0;

        for (let i = 0; i < data.length; i++) {
            if (data[i] < min) min = data[i];
            if (data[i] > max) max = data[i];
            const n = (data[i] - 128) / 128;
            sumSq += n * n;
        }

        const rawVpp = (max - min) / 128;
        const vpp    = (rawVpp * State.calibVpp).toFixed(3);
        const rms    = Math.sqrt(sumSq / data.length).toFixed(4);
        const db     = parseFloat(rms) > 0
            ? (20 * Math.log10(parseFloat(rms))).toFixed(1)
            : '-∞';

        if (!State.simMode && State.analyser && State.freqArray) {
            let peakIdx = 0, peakVal = 0;
            for (let i = 2; i < State.freqArray.length; i++) {
                if (State.freqArray[i] > peakVal) {
                    peakVal = State.freqArray[i];
                    peakIdx = i;
                }
            }
            const rawFreq = State.audioCtx
                ? Math.round(peakIdx * State.audioCtx.sampleRate / State.analyser.fftSize)
                : 0;
            const freq   = Math.round(rawFreq * State.calibFreq);
            const freqEl = document.getElementById('mFreq');
            if (freqEl) {
                freqEl.innerText = freq > 20 ? freq + 'Hz' : '---';
                freqEl.className = 'meas-value';
            }
        }

        const vppEl = document.getElementById('mVpp');
        const rmsEl = document.getElementById('mRms');
        const dbEl  = document.getElementById('mDb');

        if (vppEl) {
            vppEl.innerText = vpp;
            vppEl.className = 'meas-value' + (rawVpp > 1.5 ? ' alert' : rawVpp > 0.8 ? ' warn' : '');
        }
        if (rmsEl) rmsEl.innerText = rms;
        if (dbEl) {
            dbEl.innerText  = db + 'dB';
            dbEl.className  = 'meas-value' + (parseFloat(db) > -6 ? ' alert' : parseFloat(db) > -18 ? ' warn' : '');
        }

        return { vpp: parseFloat(vpp), rms: parseFloat(rms), db: parseFloat(db) };
    },

    applyWorkerResult(r) {
        if (!r) return;

        const vppEl  = document.getElementById('mVpp');
        const rmsEl  = document.getElementById('mRms');
        const dbEl   = document.getElementById('mDb');
        const freqEl = document.getElementById('mFreq');

        if (vppEl) {
            vppEl.innerText = r.vpp != null ? r.vpp.toFixed(3) : '---';
            vppEl.className = 'meas-value' + (r.rawVpp > 1.5 ? ' alert' : r.rawVpp > 0.8 ? ' warn' : '');
        }
        if (rmsEl) rmsEl.innerText = r.rms != null ? r.rms.toFixed(4) : '---';
        if (dbEl) {
            dbEl.innerText  = r.db != null && isFinite(r.db) ? r.db.toFixed(1) + 'dB' : '-∞dB';
            dbEl.className  = 'meas-value' + (r.db > -6 ? ' alert' : r.db > -18 ? ' warn' : '');
        }
        // ── FIX: always update freq — was blocked by !State.simMode guard ──
        if (freqEl) {
            if (State.simMode) {
                // In sim mode — use known frequency from State (exact, no FFT needed)
                const f = State.sim.frequency || 0;
                freqEl.innerText = f >= 1000 ? (f / 1000).toFixed(2) + 'kHz' : f > 0 ? f + 'Hz' : '---';
                freqEl.className = 'meas-value';
            } else {
                freqEl.innerText = r.freq > 20 ? r.freq + 'Hz' : '---';
                freqEl.className = 'meas-value';
            }
        }
    }
};
