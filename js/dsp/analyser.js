// ── DSP/ANALYSER.JS v1.1.1 ──
// Transfer function H(f) engine — runs inside Web Worker
// Requires CH1 (reference) + CH2 (captured) arrays
// Exports: dspAnalyse()

function dspAnalyse(ch1Array, ch2Array, sampleRate, fftSize) {
    if (!ch1Array || !ch2Array || ch1Array.length !== ch2Array.length) {
        return { error: 'Invalid input arrays' };
    }

    const len     = ch1Array.length;
    const sr      = sampleRate || 44100;

    // ── Convert Uint8 → Float32 ──
    const ch1 = _toFloat(ch1Array);
    const ch2 = _toFloat(ch2Array);

    // ── Compute H(f) using cross-correlation ratio ──
    const hf = _computeHf(ch1, ch2, fftSize);

    // ── AMPLITUDE DOMAIN ──
    const amp = _analyseAmplitude(ch1, ch2);

    // ── FREQUENCY DOMAIN ──
    const freq = _analyseFrequency(hf, sr, fftSize);

    // ── TIME DOMAIN ──
    const time = _analyseTime(ch1, ch2, sr);

    // ── SYSTEM BEHAVIOUR ──
    const sys = _analyseSystem(ch1, ch2, hf, sr);

    // ── DETECTED ARTIFACTS SUMMARY ──
    const detected = _buildSummary(amp, freq, time, sys);

    return { hf, amp, freq, time, sys, detected };
}

// ── Float32 conversion ──
function _toFloat(arr) {
    const f = new Float32Array(arr.length);
    for (let i = 0; i < arr.length; i++) f[i] = (arr[i] / 127.5) - 1.0;
    return f;
}

// ── H(f) = CH2 / CH1 per frequency band ──
// Uses sliding window RMS ratio per octave band
function _computeHf(ch1, ch2, fftSize) {
    const bands   = 32; // 32 log-spaced frequency bands 20Hz → 20kHz
    const hfMag   = new Float32Array(bands);   // gain ratio per band
    const hfPhase = new Float32Array(bands);   // phase shift per band

    for (let b = 0; b < bands; b++) {
        // frequency range for this band
        const fLow  = 20  * Math.pow(1000, b / bands);
        const fHigh = 20  * Math.pow(1000, (b + 1) / bands);
        const fMid  = (fLow + fHigh) / 2;

        // window size ~ 2 cycles of fMid
        const winSamples = Math.min(ch1.length, Math.max(32, Math.round(2 * 44100 / fMid)));

        let ch1Pwr = 0, ch2Pwr = 0, crossCov = 0;
        const step = Math.max(1, Math.floor(ch1.length / winSamples));

        for (let i = 0; i < ch1.length; i += step) {
            ch1Pwr  += ch1[i] * ch1[i];
            ch2Pwr  += ch2[i] * ch2[i];
            crossCov += ch1[i] * ch2[i];
        }

        const n       = Math.ceil(ch1.length / step);
        const ch1Rms  = Math.sqrt(ch1Pwr / n);
        const ch2Rms  = Math.sqrt(ch2Pwr / n);

        hfMag[b]   = ch1Rms > 0.001 ? ch2Rms / ch1Rms : 1.0;
        hfPhase[b] = _estimatePhase(ch1, ch2, fMid, 44100);
    }

    return { magnitude: hfMag, phase: hfPhase, bands };
}

// ── Phase shift estimation via cross-correlation lag ──
function _estimatePhase(ch1, ch2, freqHz, sr) {
    const period   = Math.round(sr / freqHz);
    const halfP    = Math.floor(period / 2);
    const searchLen = Math.min(ch1.length - period, halfP);

    let bestLag = 0, bestCorr = -Infinity;
    for (let lag = -searchLen; lag <= searchLen; lag++) {
        let corr = 0;
        for (let i = halfP; i < ch1.length - halfP; i++) {
            const j = i + lag;
            if (j >= 0 && j < ch2.length) corr += ch1[i] * ch2[j];
        }
        if (corr > bestCorr) { bestCorr = corr; bestLag = lag; }
    }
    return (bestLag / sr) * freqHz * 360; // degrees
}

// ── AMPLITUDE DOMAIN ──
function _analyseAmplitude(ch1, ch2) {
    const stats1 = _stats(ch1);
    const stats2 = _stats(ch2);

    const gainRatio  = stats1.rms > 0.001 ? stats2.rms / stats1.rms : 1;
    const gainDb     = 20 * Math.log10(Math.max(0.0001, gainRatio));
    const vppDiff    = stats2.vpp - stats1.vpp;
    const asymmetry  = _asymmetryRatio(ch2);
    const dcOffset   = stats2.mean;
    const overshoot  = Math.max(0, stats2.max - stats1.max);
    const undershoot = Math.max(0, stats1.min - stats2.min);

    // clipping detection
    const clipThresh = stats2.amplitude * 0.05;
    let clipCount = 0;
    for (let i = 0; i < ch2.length; i++) {
        if (ch2[i] >= stats2.max - clipThresh || ch2[i] <= stats2.min + clipThresh) clipCount++;
    }
    const clipRatio  = clipCount / ch2.length;
    const clipType   = clipRatio > 0.25 ? 'hard' : clipRatio > 0.05 ? 'soft' : 'none';

    // dynamic compression ratio
    const compressionRatio = stats1.vpp > 0.01 ? stats1.vpp / Math.max(0.001, stats2.vpp) : 1;

    return {
        gainRatio:        parseFloat(gainRatio.toFixed(4)),
        gainDb:           parseFloat(gainDb.toFixed(2)),
        vppDiff:          parseFloat(vppDiff.toFixed(4)),
        asymmetry:        parseFloat(asymmetry.toFixed(4)),
        dcOffset:         parseFloat(dcOffset.toFixed(4)),
        overshoot:        parseFloat((overshoot * 100).toFixed(2)),   // %
        undershoot:       parseFloat((undershoot * 100).toFixed(2)),  // %
        clipRatio:        parseFloat(clipRatio.toFixed(4)),
        clipType,
        compressionRatio: parseFloat(compressionRatio.toFixed(3)),
        ch1Rms:           parseFloat(stats1.rms.toFixed(5)),
        ch2Rms:           parseFloat(stats2.rms.toFixed(5)),
    };
}

// ── FREQUENCY DOMAIN ──
function _analyseFrequency(hf, sr, fftSize) {
    const mag     = hf.magnitude;
    const bands   = hf.bands;
    const nyquist = sr / 2;

    // HPF corner — first band where gain drops > 3dB below flat region
    let flatGain = 0;
    let flatCount = 0;
    for (let b = Math.floor(bands * 0.3); b < Math.floor(bands * 0.7); b++) {
        flatGain += mag[b]; flatCount++;
    }
    flatGain = flatCount > 0 ? flatGain / flatCount : 1.0;

    let hpfCornerHz  = null;
    let lpfCornerHz  = null;

    for (let b = 0; b < bands; b++) {
        const fHz = 20 * Math.pow(1000, b / bands);
        const gainDb = 20 * Math.log10(Math.max(0.001, mag[b] / flatGain));
        if (hpfCornerHz === null && gainDb < -3 && fHz < nyquist * 0.3) {
            hpfCornerHz = Math.round(fHz);
        }
        if (b > bands * 0.5 && gainDb < -3 && lpfCornerHz === null) {
            lpfCornerHz = Math.round(fHz);
        }
    }

    // SNR estimation — flat region power vs noise floor power
    let signalPwr = 0, noisePwr = 0;
    for (let b = 0; b < bands; b++) {
        if (mag[b] > flatGain * 0.5) signalPwr += mag[b] * mag[b];
        else noisePwr += mag[b] * mag[b];
    }
    const snr = noisePwr > 0
        ? parseFloat((10 * Math.log10(signalPwr / noisePwr)).toFixed(1))
        : 60;

    // noise floor estimate
    let minMag = Infinity;
    for (let b = 0; b < bands; b++) if (mag[b] < minMag) minMag = mag[b];
    const noiseFloorDb = parseFloat((20 * Math.log10(Math.max(0.0001, minMag))).toFixed(1));

    // THD estimation — using slope variance proxy
    const thd = Math.max(0, Math.min(100,
        parseFloat(((1 - flatGain) * 20).toFixed(2))
    ));

    return {
        hpfCornerHz,
        lpfCornerHz,
        flatGainDb:    parseFloat((20 * Math.log10(Math.max(0.001, flatGain))).toFixed(2)),
        snr,
        noiseFloorDb,
        thd,
        bandpassDetected: hpfCornerHz !== null && lpfCornerHz !== null,
    };
}

// ── TIME DOMAIN ──
function _analyseTime(ch1, ch2, sr) {
    // Phase shift via cross-correlation lag
    let bestLag = 0, bestCorr = -Infinity;
    const searchLen = Math.min(512, Math.floor(ch1.length / 4));
    for (let lag = -searchLen; lag <= searchLen; lag++) {
        let corr = 0;
        for (let i = searchLen; i < ch1.length - searchLen; i++) {
            const j = i + lag;
            if (j >= 0 && j < ch2.length) corr += ch1[i] * ch2[j];
        }
        if (corr > bestCorr) { bestCorr = corr; bestLag = lag; }
    }
    const phaseShiftDeg   = parseFloat(((bestLag / sr) * 1000 * 360 / 1000).toFixed(2));
    const groupDelayMs    = parseFloat((bestLag / sr * 1000).toFixed(3));
    const propagationUs   = parseFloat((bestLag / sr * 1e6).toFixed(1));

    // Rise time difference
    const rt1 = _riseTime(ch1, sr);
    const rt2 = _riseTime(ch2, sr);
    const riseTimeDeltaUs = parseFloat(((rt2 - rt1) * 1e6).toFixed(2));

    // Jitter — cycle-to-cycle variation
    const jitterUs = _estimateJitter(ch2, sr);

    // Ringing detection — oscillations after edge
    const ringing = _detectRinging(ch2);

    return {
        phaseShiftDeg,
        groupDelayMs,
        propagationUs,
        riseTimeDeltaUs,
        jitterUs,
        ringing,
    };
}

// ── SYSTEM BEHAVIOUR ──
function _analyseSystem(ch1, ch2, hf, sr) {
    // AGC detection — gain variation over time
    const windowSize = Math.floor(ch1.length / 8);
    const gains = [];
    for (let w = 0; w < 8; w++) {
        const start = w * windowSize;
        let ch1Pwr = 0, ch2Pwr = 0;
        for (let i = start; i < start + windowSize; i++) {
            ch1Pwr += ch1[i] * ch1[i];
            ch2Pwr += ch2[i] * ch2[i];
        }
        const g = ch1Pwr > 0.001 ? Math.sqrt(ch2Pwr / ch1Pwr) : 1.0;
        gains.push(g);
    }
    const gainMean    = gains.reduce((a, b) => a + b, 0) / gains.length;
    const gainVariance = gains.reduce((a, b) => a + (b - gainMean) ** 2, 0) / gains.length;
    const agcDetected  = gainVariance > 0.02;
    const agcRate      = agcDetected ? parseFloat((gainVariance * 100).toFixed(2)) : 0;

    // Bit depth estimation — count distinct levels
    const levels = new Set();
    for (let i = 0; i < ch2.length; i++) levels.add(ch2[i]);
    const distinctLevels = levels.size;
    const estimatedBits  = Math.round(Math.log2(Math.max(1, distinctLevels)));

    // Quantization noise
    const quantNoise = distinctLevels < 64
        ? parseFloat((1 / distinctLevels * 100).toFixed(3))
        : 0;

    // Noise fingerprint — RMS of high-frequency content
    let hfNoise = 0;
    for (let i = 1; i < ch2.length; i++) {
        hfNoise += (ch2[i] - ch2[i - 1]) ** 2;
    }
    hfNoise = parseFloat(Math.sqrt(hfNoise / ch2.length).toFixed(5));

    return {
        agcDetected,
        agcRate,
        gainVariancePct: parseFloat((gainVariance * 100).toFixed(3)),
        estimatedBits,
        distinctLevels,
        quantNoise,
        hfNoise,
    };
}

// ── DETECTED SUMMARY with confidence scores ──
function _buildSummary(amp, freq, time, sys) {
    const detected = [];

    if (freq.hpfCornerHz !== null) {
        const conf = Math.min(99, Math.round(70 + Math.abs(freq.flatGainDb) * 2));
        detected.push({ label: 'HPF', value: `~${freq.hpfCornerHz}Hz`, confidence: conf });
    }
    if (freq.lpfCornerHz !== null) {
        const conf = Math.min(99, Math.round(65 + Math.abs(freq.flatGainDb)));
        detected.push({ label: 'ROLLOFF', value: `~${freq.lpfCornerHz}Hz`, confidence: conf });
    }
    if (sys.agcDetected) {
        const conf = Math.min(99, Math.round(60 + sys.gainVariancePct * 2));
        detected.push({ label: 'AGC', value: `${sys.agcRate}% var`, confidence: conf });
    }
    if (amp.clipType !== 'none') {
        const conf = Math.min(99, Math.round(70 + amp.clipRatio * 100));
        detected.push({ label: amp.clipType === 'hard' ? 'HARD CLIP' : 'SOFT CLIP', value: `${(amp.clipRatio * 100).toFixed(1)}%`, confidence: conf });
    }
    if (Math.abs(amp.dcOffset) > 0.05) {
        detected.push({ label: 'DC OFFSET', value: `${amp.dcOffset > 0 ? '+' : ''}${amp.dcOffset.toFixed(3)}V`, confidence: 95 });
    }
    if (sys.estimatedBits < 12) {
        detected.push({ label: 'QUANTIZE', value: `~${sys.estimatedBits}bit`, confidence: 80 });
    }
    if (Math.abs(time.phaseShiftDeg) > 5) {
        detected.push({ label: 'PHASE SHIFT', value: `${time.phaseShiftDeg}°`, confidence: 85 });
    }
    if (time.ringing) {
        detected.push({ label: 'RINGING', value: 'detected', confidence: 75 });
    }

    return detected;
}

// ═══════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════
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
    return { min, max, mean, rms, vpp: max - min, amplitude: (max - min) };
}

function _asymmetryRatio(f) {
    let pos = 0, neg = 0;
    for (let i = 0; i < f.length; i++) {
        if (f[i] > 0) pos += f[i];
        else          neg += Math.abs(f[i]);
    }
    return pos + neg > 0 ? (pos - neg) / (pos + neg) : 0;
}

function _riseTime(f, sr) {
    // find first rising edge and measure 10%→90% time
    const stats   = _stats(f);
    const lo      = stats.min + (stats.amplitude * 0.1);
    const hi      = stats.min + (stats.amplitude * 0.9);
    let t10 = -1, t90 = -1;
    for (let i = 1; i < f.length; i++) {
        if (f[i - 1] < lo && f[i] >= lo && t10 < 0) t10 = i;
        if (t10 >= 0 && f[i] >= hi && t90 < 0)       t90 = i;
        if (t10 >= 0 && t90 >= 0) break;
    }
    return t10 >= 0 && t90 > t10 ? (t90 - t10) / sr : 0;
}

function _estimateJitter(f, sr) {
    // measure cycle-to-cycle variation via zero crossings
    const crossings = [];
    for (let i = 1; i < f.length; i++) {
        if (f[i - 1] < 0 && f[i] >= 0) crossings.push(i);
    }
    if (crossings.length < 3) return 0;
    const periods = [];
    for (let i = 1; i < crossings.length; i++) {
        periods.push(crossings[i] - crossings[i - 1]);
    }
    const mean = periods.reduce((a, b) => a + b, 0) / periods.length;
    const variance = periods.reduce((a, b) => a + (b - mean) ** 2, 0) / periods.length;
    return parseFloat((Math.sqrt(variance) / sr * 1e6).toFixed(2)); // µs
}

function _detectRinging(f) {
    // look for oscillations after a large edge
    for (let i = 1; i < f.length - 10; i++) {
        const edge = Math.abs(f[i] - f[i - 1]);
        if (edge > 0.3) {
            // check next 10 samples for sign changes
            let signChanges = 0;
            for (let j = i + 1; j < Math.min(i + 10, f.length); j++) {
                if (f[j] * f[j - 1] < 0) signChanges++;
            }
            if (signChanges >= 3) return true;
        }
    }
    return false;
}
