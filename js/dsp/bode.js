// ── DSP/BODE.JS v1.2.0 — capped search window, no lag ──

function dspBodePoint(ch1Array, ch2Array, freqHz, sampleRate) {
    if (!ch1Array || !ch2Array) return null;
    const sr = sampleRate || 44100;

    const ch1 = _u8toF32(ch1Array);
    const ch2 = _u8toF32(ch2Array);

    // Cap window to 512 samples max — prevents O(n²) lag at low freqs
    const period = sr / freqHz;
    const winLen = Math.min(ch1.length, Math.round(period * 2), 512);
    const start  = Math.floor((ch1.length - winLen) / 2);

    let ch1Pwr = 0, ch2Pwr = 0;
    for (let i = start; i < start + winLen; i++) {
        ch1Pwr += ch1[i] * ch1[i];
        ch2Pwr += ch2[i] * ch2[i];
    }

    const ch1Rms = Math.sqrt(ch1Pwr / winLen);
    const ch2Rms = Math.sqrt(ch2Pwr / winLen);

    const magnitude   = ch1Rms > 0.001 ? ch2Rms / ch1Rms : 1.0;
    const magnitudeDb = 20 * Math.log10(Math.max(0.0001, magnitude));

    // Phase — cap lag search to 32 samples max (was up to 2205!)
    let bestLag = 0, bestCorr = -Infinity;
    const maxLag = Math.min(32, Math.floor(winLen / 4));
    for (let lag = -maxLag; lag <= maxLag; lag++) {
        let corr = 0;
        for (let i = start + maxLag; i < start + winLen - maxLag; i++) {
            const j = i + lag;
            if (j >= 0 && j < ch2.length) corr += ch1[i] * ch2[j];
        }
        if (corr > bestCorr) { bestCorr = corr; bestLag = lag; }
    }
    const phaseShiftDeg = parseFloat(((bestLag / sr) * freqHz * 360).toFixed(2));

    return {
        freqHz:       Math.round(freqHz),
        magnitude:    parseFloat(magnitude.toFixed(5)),
        magnitudeDb:  parseFloat(magnitudeDb.toFixed(3)),
        phaseShiftDeg,
        ch1Rms:       parseFloat(ch1Rms.toFixed(5)),
        ch2Rms:       parseFloat(ch2Rms.toFixed(5)),
    };
}

function dspBodeSweep(ch1Array, ch2Array, startHz, stopHz, steps, sampleRate) {
    if (!ch1Array || !ch2Array) return { error: 'No data' };
    const sr  = sampleRate || 44100;
    startHz   = startHz || 20;
    stopHz    = stopHz  || 20000;
    steps     = Math.min(steps || 25, 25); // cap at 25 steps — enough for a good curve

    const curve    = [];
    const logStart = Math.log10(startHz);
    const logStop  = Math.log10(stopHz);

    for (let s = 0; s < steps; s++) {
        const freqHz = Math.pow(10, logStart + (logStop - logStart) * s / (steps - 1));
        const point  = dspBodePoint(ch1Array, ch2Array, freqHz, sr);
        if (point) curve.push(point);
    }

    if (curve.length === 0) return { error: 'No points computed' };
    return { curve, features: _analyseCurve(curve), steps: curve.length };
}

function _analyseCurve(curve) {
    if (!curve || curve.length < 3) return {};
    const midStart = Math.floor(curve.length * 0.3);
    const midEnd   = Math.floor(curve.length * 0.7);
    let flatDb = 0, flatCount = 0;
    for (let i = midStart; i < midEnd; i++) { flatDb += curve[i].magnitudeDb; flatCount++; }
    const refDb = flatCount > 0 ? flatDb / flatCount : 0;

    let hpfCornerHz = null;
    for (let i = 0; i < curve.length; i++) {
        if (curve[i].magnitudeDb >= refDb - 3) { hpfCornerHz = Math.round(curve[i].freqHz); break; }
    }
    let lpfCornerHz = null;
    for (let i = curve.length - 1; i >= 0; i--) {
        if (curve[i].magnitudeDb >= refDb - 3) { lpfCornerHz = Math.round(curve[i].freqHz); break; }
    }

    let maxPhase = 0;
    curve.forEach(p => { if (Math.abs(p.phaseShiftDeg) > Math.abs(maxPhase)) maxPhase = p.phaseShiftDeg; });

    let rolloffSlope = 0;
    if (curve.length >= 4) {
        const last  = curve[curve.length - 1];
        const prev  = curve[curve.length - 4];
        const octs  = Math.log2(last.freqHz / prev.freqHz);
        rolloffSlope = octs > 0 ? parseFloat(((last.magnitudeDb - prev.magnitudeDb) / octs).toFixed(1)) : 0;
    }

    return {
        hpfCornerHz,
        lpfCornerHz,
        overallGainDb:        parseFloat(refDb.toFixed(2)),
        maxPhaseShiftDeg:     parseFloat(maxPhase.toFixed(2)),
        rolloffSlopeDbOctave: rolloffSlope,
        bandpassDetected:     hpfCornerHz !== null && lpfCornerHz !== null && hpfCornerHz > 20,
        flatRegionDb:         parseFloat(refDb.toFixed(2)),
    };
}

function _u8toF32(arr) {
    const f = new Float32Array(arr.length);
    for (let i = 0; i < arr.length; i++) f[i] = (arr[i] / 127.5) - 1.0;
    return f;
}
