// ── DSP/ARTIFACTS.JS v1.1.1 ──
// Stage 1 + Stage 2 artifact pipeline — runs inside Web Worker
// Exports: applyArtifacts()

function applyArtifacts(dataArray, params) {
    // Uint8 → Float32
    const f = new Float32Array(dataArray.length);
    for (let i = 0; i < dataArray.length; i++) f[i] = (dataArray[i] / 127.5) - 1.0;

    _stage1(f, params);
    _stage2(f, params);

    // Float32 → Uint8
    const out = new Uint8Array(dataArray.length);
    for (let i = 0; i < f.length; i++) {
        out[i] = Math.round((Math.max(-1.0, Math.min(1.0, f[i])) + 1.0) * 127.5);
    }
    return out;
}

function _stage1(f, p) {
    // DC offset
    if (p.dcOffset) {
        for (let i = 0; i < f.length; i++) f[i] += p.dcOffset;
    }

    // Harmonic distortion — soft clip + 2nd harmonic injection
    if (p.harmDistort > 0) {
        const d = p.harmDistort;
        for (let i = 0; i < f.length; i++) {
            f[i] = f[i] * (1 - d * 0.3) + (f[i] * f[i]) * d * 0.3;
        }
    }

    // Asymmetric source clip — positive side only
    if (p.srcClip > 0) {
        const thr = 1.0 - p.srcClip * 0.7;
        for (let i = 0; i < f.length; i++) {
            if (f[i] > thr) f[i] = thr;
        }
    }
}

function _stage2(f, p) {
    // AC coupling — capacitor tilt, removes DC, tilts baseline
    if (p.acCouple > 0) {
        const alpha = 1 - p.acCouple * 0.01;
        let prev = f[0];
        for (let i = 1; i < f.length; i++) {
            const curr = f[i];
            f[i]  = alpha * (prev + curr - f[i - 1]);
            prev  = curr;
        }
    }

    // Mic bias — positive DC shift on mic path
    if (p.micBias > 0) {
        for (let i = 0; i < f.length; i++) f[i] += p.micBias * 0.3;
    }

    // Asymmetric clip — mic one-sided AGC saturation
    if (p.asymClip > 0) {
        const pos = 0.8 - p.asymClip * 0.3;
        for (let i = 0; i < f.length; i++) {
            if (f[i] >  pos) f[i] =  pos;
            if (f[i] < -1.0) f[i] = -1.0;
        }
    }

    // AGC pumping — simulated gain riding
    if (p.agcPumping > 0) {
        let envelope = 0;
        const attack  = 0.001 * p.agcPumping;
        const release = 0.0001 * p.agcPumping;
        for (let i = 0; i < f.length; i++) {
            const abs = Math.abs(f[i]);
            envelope  = abs > envelope ? envelope + attack : envelope - release;
            envelope  = Math.max(0.01, Math.min(1.0, envelope));
            f[i] /= (1 + envelope * p.agcPumping * 2);
        }
    }

    // HPF corner — hardware high-pass filter simulation
    if (p.hpfCorner > 0) {
        const cutoffHz = p.hpfCorner * 300;
        const rc       = 1 / (2 * Math.PI * cutoffHz);
        const alpha    = rc / (rc + 1 / 44100);
        let prev = f[0];
        for (let i = 1; i < f.length; i++) {
            const curr = f[i];
            f[i]  = alpha * (prev + curr - f[i - 1]);
            prev  = curr;
        }
    }

    // Cable rolloff — first-order LPF
    if (p.rolloff > 0) {
        const alpha = 1 - p.rolloff * 0.85;
        for (let i = 1; i < f.length; i++) {
            f[i] = alpha * f[i] + (1 - alpha) * f[i - 1];
        }
    }

    // Noise floor
    if (p.noiseFloor > 0) {
        for (let i = 0; i < f.length; i++) {
            f[i] += (Math.random() * 2 - 1) * p.noiseFloor * 0.15;
        }
    }

    // Quantization — bit depth reduction
    if (p.quantize > 0) {
        const bits  = Math.round(16 - p.quantize * 12); // 16 → 4 bits
        const steps = Math.pow(2, bits);
        for (let i = 0; i < f.length; i++) {
            f[i] = Math.round(f[i] * steps) / steps;
        }
    }
}
