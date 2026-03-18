// ── DSP/BODE.JS v1.1.1 ──
// Bode plot engine — runs inside Web Worker
// Exports: dspBodePoint(), dspBodeSweep()

// ══════════════════════════════════════
// SINGLE FREQUENCY MEASUREMENT
// Measures H(f) at ONE frequency
// Used for live Bode tracking
// ══════════════════════════════════════
function dspBodePoint(ch1Array, ch2Array, freqHz, sampleRate) {
    if (!ch1Array || !ch2Array) return null;
    const sr = sampleRate || 44100;

    // Convert Uint8 → Float32
    const ch1 = _u8toF32(ch1Array);
    const ch2 = _u8toF32(ch2Array);

    // RMS of each channel at this frequency
    // Use bandpass window of ~2 periods
    const period    = sr / freqHz;
    const winLen    = Math.min(ch1.length, Math.round(period * 4));
    const start     = Math.floor((ch1.length - winLen) / 2);

    let ch1Pwr = 0, ch2Pwr = 0, crossSum = 0;
    for (let i = start; i < start + winLen; i++) {
        ch1Pwr  += ch1[i] * ch1[i];
        ch2Pwr  += ch2[i] * ch2[i];
        crossSum += ch1[i] * ch2[i];
    }

    const ch1Rms = Math.sqrt(ch1Pwr / winLen);
    const ch2Rms = Math.sqrt(ch2Pwr / winLen);

    const magnitude = ch1Rms > 0.001 ? ch2Rms / ch1Rms : 1.0;
    const magnitudeDb = 20 * Math.log10(Math.max(0.0001, magnitude));

    // Phase via cross-correlation lag
    let bestLag  = 0, bestCorr = -Infinity;
    const maxLag = Math.min(Math.floor(period), Math.floor(winLen / 2));
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

// ══════════════════════════════════════
// AUTO BODE SWEEP
// Steps through startHz → stopHz
// Returns full H(f) curve array
// Main thread feeds simulator CH1 for each step
// ══════════════════════════════════════
function dspBodeSweep(ch1Array, ch2Array, startHz, stopHz, steps, sampleRate) {
    if (!ch1Array || !ch2Array) return { error: 'No data' };
    const sr     = sampleRate || 44100;
    startHz      = startHz || 20;
    stopHz       = stopHz  || 20000;
    steps        = steps   || 50;

    const curve  = [];
    const logStart = Math.log10(startHz);
    const logStop  = Math.log10(stopHz);

    for (let s = 0; s < steps; s++) {
        const freqHz  = Math.pow(10, logStart + (logStop - logStart) * s / (steps - 1));
        const point   = dspBodePoint(ch1Array, ch2Array, freqHz, sr);
        if (point) curve.push(point);
    }

    if (curve.length === 0) return { error: 'No points computed' };

    // ── Detect key features from the curve ──
    const features = _analyseCurve(curve);

    return { curve, features, steps: curve.length };
}

// ── Analyse completed Bode curve ──
function _analyseCurve(curve) {
    if (!curve || curve.length < 3) return {};

    // find flat region (middle 40% of curve by frequency)
    const midStart = Math.floor(curve.length * 0.3);
    const midEnd   = Math.floor(curve.length * 0.7);
    let flatDb = 0, flatCount = 0;
    for (let i = midStart; i < midEnd; i++) {
        flatDb += curve[i].magnitudeDb;
        flatCount++;
    }
    const refDb = flatCount > 0 ? flatDb / flatCount : 0;

    // HPF corner — lowest freq where gain is within 3dB of flat
    let hpfCornerHz = null;
    for (let i = 0; i < curve.length; i++) {
        if (curve[i].magnitudeDb >= refDb - 3) {
            hpfCornerHz = Math.round(curve[i].freqHz);
            break;
        }
    }

    // LPF/rolloff corner — highest freq where gain starts dropping > 3dB
    let lpfCornerHz = null;
    for (let i = curve.length - 1; i >= 0; i--) {
        if (curve[i].magnitudeDb >= refDb - 3) {
            lpfCornerHz = Math.round(curve[i].freqHz);
            break;
        }
    }

    // max phase shift across curve
    let maxPhase = 0;
    curve.forEach(p => { if (Math.abs(p.phaseShiftDeg) > Math.abs(maxPhase)) maxPhase = p.phaseShiftDeg; });

    // overall gain
    const overallGainDb = parseFloat(refDb.toFixed(2));

    // rolloff slope (dB/octave) at high end
    let rolloffSlope = 0;
    if (curve.length >= 4) {
        const last   = curve[curve.length - 1];
        const prev   = curve[curve.length - 4];
        const octaves = Math.log2(last.freqHz / prev.freqHz);
        rolloffSlope  = octaves > 0
            ? parseFloat(((last.magnitudeDb - prev.magnitudeDb) / octaves).toFixed(1))
            : 0;
    }

    return {
        hpfCornerHz,
        lpfCornerHz,
        overallGainDb,
        maxPhaseShiftDeg: parseFloat(maxPhase.toFixed(2)),
        rolloffSlopeDbOctave: rolloffSlope,
        bandpassDetected: hpfCornerHz !== null && lpfCornerHz !== null && hpfCornerHz > 20,
        flatRegionDb: parseFloat(refDb.toFixed(2)),
    };
}

function _u8toF32(arr) {
    const f = new Float32Array(arr.length);
    for (let i = 0; i < arr.length; i++) f[i] = (arr[i] / 127.5) - 1.0;
    return f;
}
