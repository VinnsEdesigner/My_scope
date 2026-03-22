// ── DSP/CORRECTION.JS v1.0.2 ──
// Inverse artifact correction engine — runs inside Web Worker
// Takes ch2Array (captured signal) + analyserResult → returns corrected ch3Array
// sampleRate passed explicitly — no State references allowed in worker scope

function dspCorrect(ch2Array, analyserResult, sampleRate) {
    if (!ch2Array || !analyserResult) {
        return new Uint8Array(ch2Array ? ch2Array.length : 0);
    }

    const len = ch2Array.length;
    const sr  = sampleRate || 44100;

    // ── Uint8 → Float32 [-1.0, +1.0] ──
    const f = new Float32Array(len);
    for (let i = 0; i < len; i++) {
        f[i] = (ch2Array[i] / 127.5) - 1.0;
    }

    const amp  = analyserResult.amp  || {};
    const freq = analyserResult.freq || {};
    const sys  = analyserResult.sys  || {};

    // Apply inverse operations in reverse accumulation order
    _inverseQuantize (f, sys);
    _inverseNoise    (f, freq);
    _inverseAGC      (f, sys);
    _inverseAsymClip (f, amp);
    _inverseRolloff  (f, freq, sr);
    _inverseHPF      (f, freq, sr);
    _inverseDCOffset (f, amp);
    _inverseGain     (f, amp);

    // ── Float32 → Uint8 with clamping ──
    const out = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        const clamped = Math.max(-1.0, Math.min(1.0, f[i]));
        out[i] = Math.round((clamped + 1.0) * 127.5);
    }
    return out;
}

function _inverseQuantize(f, sys) {
    const bits = sys.estimatedBits || 16;
    if (bits >= 15) return;
    const steps    = Math.pow(2, bits);
    const stepSize = 2.0 / steps;
    for (let i = 1; i < f.length - 1; i++) {
        const prevStep = Math.round(f[i - 1] / stepSize);
        const nextStep = Math.round(f[i + 1] / stepSize);
        const currStep = Math.round(f[i]     / stepSize);
        if (prevStep !== nextStep && currStep === prevStep) {
            f[i] = (f[i - 1] + f[i + 1]) * 0.5;
        }
    }
}

function _inverseNoise(f, freq) {
    const snr = freq.snr || 60;
    if (snr >= 40) return;
    const alpha = Math.max(0, Math.min(0.3, (40 - snr) / 40 * 0.3));
    if (alpha < 0.001) return;
    const tmp = new Float32Array(f.length);
    tmp[0] = f[0];
    for (let i = 1; i < f.length; i++) {
        tmp[i] = (1 - alpha) * f[i] + alpha * tmp[i - 1];
    }
    f[f.length - 1] = tmp[f.length - 1];
    for (let i = f.length - 2; i >= 0; i--) {
        f[i] = (1 - alpha) * tmp[i] + alpha * f[i + 1];
    }
}

function _inverseAGC(f, sys) {
    if (!sys.agcDetected) return;
    const variance = sys.gainVariancePct || 0;
    if (variance < 2) return;
    const winSize = Math.floor(f.length / 8);
    if (winSize < 4) return;
    const gains = new Float32Array(8);
    for (let w = 0; w < 8; w++) {
        const start = w * winSize;
        let pwr = 0;
        for (let i = start; i < start + winSize && i < f.length; i++) pwr += f[i] * f[i];
        const rms = Math.sqrt(pwr / winSize);
        gains[w]  = rms > 0.001 ? rms : 0.001;
    }
    let meanGain = 0;
    for (let w = 0; w < 8; w++) meanGain += gains[w];
    meanGain /= 8;
    for (let w = 0; w < 8; w++) {
        const start       = w * winSize;
        const end         = Math.min(start + winSize, f.length);
        const correction  = meanGain / gains[w];
        const clampedCorr = Math.max(0.5, Math.min(2.0, correction));
        const boundaryLen = Math.floor(winSize * 0.1);
        for (let i = start; i < end; i++) {
            let blend = clampedCorr;
            if (w > 0 && (i - start) < boundaryLen) {
                const t        = (i - start) / boundaryLen;
                const prevCorr = Math.max(0.5, Math.min(2.0, meanGain / gains[w - 1]));
                blend = prevCorr + (clampedCorr - prevCorr) * t;
            }
            f[i] *= blend;
        }
    }
}

function _inverseAsymClip(f, amp) {
    const asymmetry = Math.abs(amp.asymmetry || 0);
    const clipType  = amp.clipType || 'none';
    if (asymmetry < 0.08 || clipType === 'none') return;
    let maxPos = 0, maxNeg = 0;
    for (let i = 0; i < f.length; i++) {
        if (f[i] > maxPos) maxPos = f[i];
        if (f[i] < maxNeg) maxNeg = f[i];
    }
    maxNeg = Math.abs(maxNeg);
    if (maxPos < 0.01 || maxNeg < 0.01) return;
    const scaleFactor = maxNeg / maxPos;
    if (scaleFactor >= 1.0 || scaleFactor < 0.3) return;
    for (let i = 0; i < f.length; i++) {
        if (f[i] > 0) f[i] *= scaleFactor;
    }
}

function _inverseRolloff(f, freq, sr) {
    const lpfHz = freq.lpfCornerHz;
    if (!lpfHz || lpfHz <= 0) return;
    const cutoff = Math.min(lpfHz, sr * 0.45);
    if (cutoff >= sr * 0.4) return;
    const boostDb     = Math.min(12, Math.max(0, 20 * Math.log10(sr * 0.45 / cutoff)));
    const boostLinear = Math.pow(10, boostDb / 20);
    const blendFactor = Math.min(0.8, (boostLinear - 1) * 0.3);
    if (blendFactor < 0.001) return;
    for (let i = 1; i < f.length; i++) {
        f[i] = f[i] + blendFactor * (f[i] - f[i - 1]);
    }
}

function _inverseHPF(f, freq, sr) {
    const hpfHz = freq.hpfCornerHz;
    if (!hpfHz || hpfHz < 5) return;
    const rc      = 1.0 / (2.0 * Math.PI * hpfHz);
    const dt      = 1.0 / sr;
    const lpAlpha = dt / (rc + dt);
    const shelfGain   = Math.min(3.0, Math.max(0.1, hpfHz / 20));
    const blendFactor = Math.min(0.6, shelfGain * 0.15);
    if (blendFactor < 0.001) return;
    let lpState = f[0];
    for (let i = 1; i < f.length; i++) {
        lpState = lpAlpha * f[i] + (1 - lpAlpha) * lpState;
        f[i]    = f[i] + blendFactor * lpState;
    }
}

function _inverseDCOffset(f, amp) {
    const dc = amp.dcOffset || 0;
    if (Math.abs(dc) < 0.005) return;
    for (let i = 0; i < f.length; i++) f[i] -= dc;
}

function _inverseGain(f, amp) {
    const gainRatio = amp.gainRatio || 1.0;
    if (Math.abs(gainRatio - 1.0) < 0.02 || gainRatio < 0.001) return;
    const correction = Math.max(0.25, Math.min(4.0, 1.0 / gainRatio));
    for (let i = 0; i < f.length; i++) f[i] *= correction;
}
