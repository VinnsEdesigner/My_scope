// ── DSP/CORRECTION.JS v1.0.1 ──
// Inverse artifact correction engine — runs inside Web Worker
// Takes ch2Array (captured signal) + analyserResult → returns corrected ch3Array
// Applies inverse operations in reverse order of how artifacts accumulate
// sampleRate passed explicitly — no hardcoded values
// Exports: dspCorrect()

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

    // ── Apply inverse operations in reverse accumulation order ──
    // Artifacts layer up in this order when recording:
    //   quantize → noise → AGC → clip → rolloff → HPF → DC → gain
    // We reverse them in the same order (each undoes the outermost layer)
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

// ══════════════════════════════════════════════════════════
// INVERSE OPERATIONS
// Each function mutates f[] in-place
// Each has an early-return guard so it only runs when needed
// ══════════════════════════════════════════════════════════

// ── 1. Inverse quantization ──
// Smooths staircase distortion from low bit-depth recording
// Detects step boundaries and linearly interpolates across them
function _inverseQuantize(f, sys) {
    const bits = sys.estimatedBits || 16;
    if (bits >= 15) return; // 15–16 bit — negligible quantization distortion

    const steps    = Math.pow(2, bits);   // number of quantization levels
    const stepSize = 2.0 / steps;         // size of each step in [-1, +1]

    // Loop from 1 to len-2 so we can safely access f[i-1] and f[i+1]
    for (let i = 1; i < f.length - 1; i++) {
        const prevStep = Math.round(f[i - 1] / stepSize);
        const currStep = Math.round(f[i]     / stepSize);
        const nextStep = Math.round(f[i + 1] / stepSize);

        // Interpolate at step transitions to smooth the staircase
        if (prevStep !== nextStep && currStep === prevStep) {
            f[i] = (f[i - 1] + f[i + 1]) * 0.5;
        }
    }
}

// ── 2. Inverse noise floor ──
// Applies zero-phase low-pass filter to suppress noise
// Strength proportional to how poor the detected SNR is
function _inverseNoise(f, freq) {
    const snr = freq.snr || 60;
    if (snr >= 40) return; // SNR >= 40dB — good enough, skip

    // Map SNR: 0dB → alpha=0.30, 40dB → alpha=0.0 (no smoothing)
    const alpha = Math.max(0, Math.min(0.3, (40 - snr) / 40 * 0.3));
    if (alpha < 0.001) return;

    const tmp = new Float32Array(f.length);

    // Forward pass — standard single-pole LPF
    tmp[0] = f[0];
    for (let i = 1; i < f.length; i++) {
        tmp[i] = (1 - alpha) * f[i] + alpha * tmp[i - 1];
    }

    // Backward pass — zero-phase correction (eliminates phase shift)
    f[f.length - 1] = tmp[f.length - 1];
    for (let i = f.length - 2; i >= 0; i--) {
        f[i] = (1 - alpha) * tmp[i] + alpha * f[i + 1];
    }
}

// ── 3. Inverse AGC ──
// Undoes automatic gain control by re-expanding compressed windows
function _inverseAGC(f, sys) {
    if (!sys.agcDetected) return;
    const variance = sys.gainVariancePct || 0;
    if (variance < 2) return; // gain variation < 2% — not worth correcting

    const winSize = Math.floor(f.length / 8);
    if (winSize < 4) return; // buffer too short for windowed analysis

    // Measure RMS of each window
    const gains = new Float32Array(8);
    for (let w = 0; w < 8; w++) {
        const start = w * winSize;
        let pwr = 0;
        for (let i = start; i < start + winSize && i < f.length; i++) {
            pwr += f[i] * f[i];
        }
        const rms  = Math.sqrt(pwr / winSize);
        gains[w]   = rms > 0.001 ? rms : 0.001; // floor at 0.001 to prevent /0
    }

    // Compute mean RMS across all windows — this is the target level
    let meanGain = 0;
    for (let w = 0; w < 8; w++) meanGain += gains[w];
    meanGain /= 8;

    // Apply inverse gain per window with smooth crossfade at boundaries
    for (let w = 0; w < 8; w++) {
        const start       = w * winSize;
        const end         = Math.min(start + winSize, f.length);
        const correction  = meanGain / gains[w]; // inverse of detected gain
        const clampedCorr = Math.max(0.5, Math.min(2.0, correction)); // max 2x boost
        const boundaryLen = Math.floor(winSize * 0.1); // 10% crossfade zone

        for (let i = start; i < end; i++) {
            let blend = clampedCorr;

            // Crossfade from previous window's correction at boundaries
            if (w > 0 && (i - start) < boundaryLen) {
                const t        = (i - start) / boundaryLen; // 0→1 across boundary
                const prevCorr = Math.max(0.5, Math.min(2.0, meanGain / gains[w - 1]));
                blend = prevCorr + (clampedCorr - prevCorr) * t;
            }

            f[i] *= blend;
        }
    }
}

// ── 4. Inverse asymmetric clipping ──
// Mic hardware often clips the positive half harder than negative
// Scales positive half to match the negative half's peak
function _inverseAsymClip(f, amp) {
    const asymmetry = Math.abs(amp.asymmetry || 0);
    const clipType  = amp.clipType || 'none';
    if (asymmetry < 0.08 || clipType === 'none') return;

    let maxPos = 0;
    let maxNeg = 0;
    for (let i = 0; i < f.length; i++) {
        if (f[i] > maxPos) maxPos = f[i];
        if (f[i] < maxNeg) maxNeg = f[i];
    }
    maxNeg = Math.abs(maxNeg);

    // Both halves must have meaningful signal before we correct
    if (maxPos < 0.01 || maxNeg < 0.01) return;

    const scaleFactor = maxNeg / maxPos;
    // Only correct if positive is clearly smaller than negative
    // and the difference isn't so extreme it would be meaningless
    if (scaleFactor >= 1.0 || scaleFactor < 0.3) return;

    for (let i = 0; i < f.length; i++) {
        if (f[i] > 0) f[i] *= scaleFactor;
    }
}

// ── 5. Inverse rolloff (LPF correction) ──
// High-frequency content was attenuated by mic/cable rolloff
// Applies a first-order high-shelf boost around the detected corner
function _inverseRolloff(f, freq, sr) {
    const lpfHz = freq.lpfCornerHz;
    if (!lpfHz || lpfHz <= 0) return;

    const cutoff = Math.min(lpfHz, sr * 0.45); // stay below Nyquist
    if (cutoff >= sr * 0.4) return;            // rolloff too high — negligible

    // Boost magnitude: louder for lower rolloff corners
    const boostDb     = Math.min(12, Math.max(0, 20 * Math.log10(sr * 0.45 / cutoff)));
    const boostLinear = Math.pow(10, boostDb / 20);

    // Blend factor: how strongly to apply the differentiation
    // Capped at 0.8 to prevent over-sharpening
    const blendFactor = Math.min(0.8, (boostLinear - 1) * 0.3);
    if (blendFactor < 0.001) return;

    // First-order differentiator (emphasises high frequencies)
    // y[i] = x[i] + blend * (x[i] - x[i-1])
    for (let i = 1; i < f.length; i++) {
        f[i] = f[i] + blendFactor * (f[i] - f[i - 1]);
    }
}

// ── 6. Inverse HPF ──
// Low-frequency content was attenuated by hardware high-pass filter
// Applies a first-order low-shelf boost using the detected corner frequency
function _inverseHPF(f, freq, sr) {
    const hpfHz = freq.hpfCornerHz;
    if (!hpfHz || hpfHz <= 0) return;
    if (hpfHz < 5) return; // corner below 5Hz — negligible, skip

    // RC time constant from corner frequency
    const rc      = 1.0 / (2.0 * Math.PI * hpfHz);
    const dt      = 1.0 / sr;

    // Low-pass coefficient for shelf boost
    // lpAlpha near 0 → strong low-pass → strong shelf
    // lpAlpha near 1 → weak low-pass → weak shelf
    const lpAlpha = dt / (rc + dt);

    // Shelf boost strength: higher HPF corner → stronger correction needed
    const shelfGain   = Math.min(3.0, Math.max(0.1, hpfHz / 20));
    const blendFactor = Math.min(0.6, shelfGain * 0.15);
    if (blendFactor < 0.001) return;

    // Low-shelf: add a weighted low-pass of the input back to itself
    // y[i] = x[i] + blend * lowpass(x)[i]
    // This boosts low frequencies without phase distortion at the shelf
    let lpState = f[0];
    for (let i = 1; i < f.length; i++) {
        lpState = lpAlpha * f[i] + (1 - lpAlpha) * lpState;
        f[i]    = f[i] + blendFactor * lpState;
    }
}

// ── 7. Inverse DC offset ──
// Subtracts the measured DC component to centre the waveform
function _inverseDCOffset(f, amp) {
    const dc = amp.dcOffset || 0;
    if (Math.abs(dc) < 0.005) return; // below 0.5% — negligible
    for (let i = 0; i < f.length; i++) {
        f[i] -= dc;
    }
}

// ── 8. Inverse gain ──
// Scales signal amplitude to match CH1 reference level
function _inverseGain(f, amp) {
    const gainRatio = amp.gainRatio || 1.0;
    if (Math.abs(gainRatio - 1.0) < 0.02) return; // within 2% — skip
    if (gainRatio < 0.001) return;                  // guard against /0

    // Inverse: scale by 1/gainRatio, clamped to prevent wild amplification
    const correction = Math.max(0.25, Math.min(4.0, 1.0 / gainRatio));
    for (let i = 0; i < f.length; i++) {
        f[i] *= correction;
    }
}
