// ── DSP/ANALYSER.JS v1.2.0 — capped for mobile performance ──

function dspAnalyse(ch1Array, ch2Array, sampleRate, fftSize) {
    if (!ch1Array || !ch2Array || ch1Array.length !== ch2Array.length) {
        return { error: 'Invalid input arrays' };
    }
    const sr  = sampleRate || 44100;
    const ch1 = _toFloat(ch1Array);
    const ch2 = _toFloat(ch2Array);

    const hf       = _computeHf(ch1, ch2, sr);
    const amp      = _analyseAmplitude(ch1, ch2);
    const freq     = _analyseFrequency(hf, sr);
    const sys      = _analyseSystem(ch1, ch2);
    const detected = _buildSummary(amp, freq, sys);

    return { hf, amp, freq, sys, detected };
}

function _toFloat(arr) {
    const f = new Float32Array(arr.length);
    for (let i = 0; i < arr.length; i++) f[i] = (arr[i] / 127.5) - 1.0;
    return f;
}

// H(f) — capped window per band, no O(n²) cross-correlation
function _computeHf(ch1, ch2, sr) {
    const bands  = 24;  // fewer bands = faster
    const hfMag  = new Float32Array(bands);
    const hfPhas = new Float32Array(bands);

    for (let b = 0; b < bands; b++) {
        const fMid = 20 * Math.pow(1000, (b + 0.5) / bands);
        // Cap window to 256 samples — prevents lag at low freqs
        const step = Math.max(1, Math.floor(ch1.length / 256));
        let ch1Pwr = 0, ch2Pwr = 0;
        let n = 0;
        for (let i = 0; i < ch1.length; i += step) {
            ch1Pwr += ch1[i] * ch1[i];
            ch2Pwr += ch2[i] * ch2[i];
            n++;
        }
        const ch1Rms = Math.sqrt(ch1Pwr / n);
        const ch2Rms = Math.sqrt(ch2Pwr / n);
        hfMag[b]  = ch1Rms > 0.001 ? ch2Rms / ch1Rms : 1.0;
        hfPhas[b] = _estimatePhase(ch1, ch2, fMid, sr);
    }
    return { magnitude: hfMag, phase: hfPhas, bands };
}

// Phase — HARD cap at 32 lag samples to prevent O(n²) freeze
function _estimatePhase(ch1, ch2, freqHz, sr) {
    const maxLag    = 32;  // was up to 2205 — that's why it lagged!
    const searchLen = Math.min(ch1.length / 2, 512);
    const start     = Math.floor((ch1.length - searchLen) / 2);

    let bestLag = 0, bestCorr = -Infinity;
    for (let lag = -maxLag; lag <= maxLag; lag++) {
        let corr = 0;
        for (let i = start; i < start + searchLen; i++) {
            const j = i + lag;
            if (j >= 0 && j < ch2.length) corr += ch1[i] * ch2[j];
        }
        if (corr > bestCorr) { bestCorr = corr; bestLag = lag; }
    }
    return (bestLag / sr) * freqHz * 360;
}

function _analyseAmplitude(ch1, ch2) {
    const s1 = _stats(ch1);
    const s2 = _stats(ch2);

    const gainRatio = s1.rms > 0.001 ? s2.rms / s1.rms : 1;
    const gainDb    = 20 * Math.log10(Math.max(0.0001, gainRatio));
    const dcOffset  = s2.mean;
    const asymmetry = _asymmetryRatio(ch2);

    const clipThresh = s2.amplitude * 0.05;
    let clipCount = 0;
    for (let i = 0; i < ch2.length; i++) {
        if (ch2[i] >= s2.max - clipThresh || ch2[i] <= s2.min + clipThresh) clipCount++;
    }
    const clipRatio = clipCount / ch2.length;
    const clipType  = clipRatio > 0.25 ? 'hard' : clipRatio > 0.05 ? 'soft' : 'none';

    return {
        gainRatio:  parseFloat(gainRatio.toFixed(4)),
        gainDb:     parseFloat(gainDb.toFixed(2)),
        dcOffset:   parseFloat(dcOffset.toFixed(4)),
        asymmetry:  parseFloat(asymmetry.toFixed(4)),
        clipRatio:  parseFloat(clipRatio.toFixed(4)),
        clipType,
        clipPct:    parseFloat((clipRatio * 100).toFixed(1)),
        ch1Rms:     parseFloat(s1.rms.toFixed(5)),
        ch2Rms:     parseFloat(s2.rms.toFixed(5)),
    };
}

function _analyseFrequency(hf, sr) {
    const mag    = hf.magnitude;
    const bands  = hf.bands;

    let flatGain = 0, flatCount = 0;
    for (let b = Math.floor(bands * 0.3); b < Math.floor(bands * 0.7); b++) {
        flatGain += mag[b]; flatCount++;
    }
    flatGain = flatCount > 0 ? flatGain / flatCount : 1.0;

    let hpfCornerHz = null, lpfCornerHz = null;
    for (let b = 0; b < bands; b++) {
        const fHz    = 20 * Math.pow(1000, (b + 0.5) / bands);
        const gainDb = 20 * Math.log10(Math.max(0.001, mag[b] / flatGain));
        if (hpfCornerHz === null && gainDb < -3 && fHz < sr * 0.15) hpfCornerHz = Math.round(fHz);
        if (b > bands * 0.5 && gainDb < -3 && lpfCornerHz === null)  lpfCornerHz = Math.round(fHz);
    }

    let signalPwr = 0, noisePwr = 0;
    for (let b = 0; b < bands; b++) {
        if (mag[b] > flatGain * 0.5) signalPwr += mag[b] * mag[b];
        else noisePwr += mag[b] * mag[b];
    }
    const snr = noisePwr > 0
        ? parseFloat((10 * Math.log10(signalPwr / noisePwr)).toFixed(1))
        : 60;

    return {
        hpfCornerHz,
        lpfCornerHz,
        flatGainDb: parseFloat((20 * Math.log10(Math.max(0.001, flatGain))).toFixed(2)),
        snr,
    };
}

function _analyseSystem(ch1, ch2) {
    const windowSize = Math.max(4, Math.floor(ch1.length / 8));
    const gains = [];
    for (let w = 0; w < 8; w++) {
        const start = w * windowSize;
        let p1 = 0, p2 = 0;
        for (let i = start; i < start + windowSize && i < ch1.length; i++) {
            p1 += ch1[i] * ch1[i];
            p2 += ch2[i] * ch2[i];
        }
        gains.push(p1 > 0.001 ? Math.sqrt(p2 / p1) : 1.0);
    }
    const mean     = gains.reduce((a, b) => a + b, 0) / 8;
    const variance = gains.reduce((a, b) => a + (b - mean) ** 2, 0) / 8;
    const agcDetected    = variance > 0.02;
    const agcRate        = parseFloat((variance * 100).toFixed(1));
    const gainVariancePct = parseFloat((variance * 100).toFixed(2));

    // Bit depth
    const levels = new Set();
    for (let i = 0; i < ch2.length; i++) levels.add(ch2[i]);
    const estimatedBits = Math.round(Math.log2(Math.max(1, levels.size)));

    return { agcDetected, agcRate, gainVariancePct, estimatedBits };
}

// ── DETECTED SUMMARY ──
// Each item now has: label, value (text), confidence (0-99), barValue (0-100 for bar width)
function _buildSummary(amp, freq, sys) {
    const detected = [];

    if (freq.hpfCornerHz !== null) {
        const conf = Math.min(95, 65 + Math.abs(freq.flatGainDb) * 3);
        detected.push({ label: 'HPF', value: `~${freq.hpfCornerHz}Hz`, confidence: Math.round(conf), barValue: Math.round(conf) });
    }
    if (freq.lpfCornerHz !== null) {
        const conf = Math.min(90, 60 + Math.abs(freq.flatGainDb) * 2);
        detected.push({ label: 'ROLLOFF', value: `~${freq.lpfCornerHz}Hz`, confidence: Math.round(conf), barValue: Math.round(conf) });
    }
    if (sys.agcDetected) {
        const conf = Math.min(95, 55 + sys.gainVariancePct * 1.5);
        // barValue = normalized agcRate (0-100), so bar tracks the actual variation level
        const barVal = Math.min(100, sys.agcRate * 3);
        detected.push({ label: 'AGC', value: `${sys.agcRate.toFixed(1)}%var`, confidence: Math.round(conf), barValue: Math.round(barVal) });
    }
    if (amp.clipType !== 'none') {
        const conf = Math.min(95, 65 + amp.clipRatio * 80);
        // barValue = clipPct so bar shows how much clipping
        detected.push({ label: amp.clipType === 'hard' ? 'HARD CLIP' : 'SOFT CLIP', value: `${amp.clipPct}%`, confidence: Math.round(conf), barValue: Math.round(amp.clipPct) });
    }
    if (Math.abs(amp.dcOffset) > 0.04) {
        const barVal = Math.min(100, Math.abs(amp.dcOffset) * 100);
        detected.push({ label: 'DC OFFSET', value: `${amp.dcOffset > 0 ? '+' : ''}${amp.dcOffset.toFixed(3)}V`, confidence: 92, barValue: Math.round(barVal) });
    }
    if (sys.estimatedBits < 12) {
        detected.push({ label: 'QUANTIZE', value: `~${sys.estimatedBits}bit`, confidence: 80, barValue: Math.round((16 - sys.estimatedBits) / 12 * 100) });
    }
    return detected;
}

// ── HELPERS ──
function _stats(f) {
    let min = Infinity, max = -Infinity, sum = 0, sumSq = 0;
    for (let i = 0; i < f.length; i++) {
        if (f[i] < min) min = f[i];
        if (f[i] > max) max = f[i];
        sum   += f[i];
        sumSq += f[i] * f[i];
    }
    const mean = sum / f.length;
    const rms  = Math.sqrt(sumSq / f.length);
    return { min, max, mean, rms, vpp: max - min, amplitude: max - min };
}

function _asymmetryRatio(f) {
    let pos = 0, neg = 0;
    for (let i = 0; i < f.length; i++) {
        if (f[i] > 0) pos += f[i]; else neg += Math.abs(f[i]);
    }
    return pos + neg > 0 ? (pos - neg) / (pos + neg) : 0;
}
