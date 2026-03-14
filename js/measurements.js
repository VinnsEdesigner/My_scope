// ── MEASUREMENTS.JS — Vpp, RMS, dBFS, frequency ──
const Measurements = {
    update() {
        if (!State.analyser || !State.dataArray) return;

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

        // dominant frequency from FFT peak
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
        const freq = Math.round(rawFreq * State.calibFreq);

        // update DOM
        const freqEl = document.getElementById('mFreq');
        const vppEl  = document.getElementById('mVpp');
        const rmsEl  = document.getElementById('mRms');
        const dbEl   = document.getElementById('mDb');

        freqEl.innerText = freq > 20 ? freq + 'Hz' : '---';
        vppEl.innerText  = vpp;
        rmsEl.innerText  = rms;
        dbEl.innerText   = db + 'dB';

        vppEl.className = 'meas-value' + (rawVpp > 1.5 ? ' alert' : rawVpp > 0.8 ? ' warn' : '');
        dbEl.className  = 'meas-value' + (parseFloat(db) > -6 ? ' alert' : parseFloat(db) > -18 ? ' warn' : '');

        return { freq, vpp: parseFloat(vpp), rms: parseFloat(rms), db: parseFloat(db) };
    }
};
