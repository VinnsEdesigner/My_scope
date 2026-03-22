// ── DSP/CLASSIFIER.JS v1.2.0 — SINE checked before TRIANGLE ──

function dspClassify(dataArray, sampleRate) {
    const len = dataArray.length;

    let min = 255, max = 0, sumSq = 0, sum = 0;
    for (let i = 0; i < len; i++) {
        if (dataArray[i] < min) min = dataArray[i];
        if (dataArray[i] > max) max = dataArray[i];
        const n = (dataArray[i] - 128) / 128;
        sum   += n;
        sumSq += n * n;
    }
    const amplitude = max - min;
    const rms       = Math.sqrt(sumSq / len);
    const peak      = Math.max(Math.abs(max - 128), Math.abs(min - 128)) / 128;
    const crest     = rms > 0.001 ? peak / rms : 0;

    // Early exits
    if (amplitude < 6)  return { type: 'DC',    confidence: 99, features: {} };
    if (rms < 0.008)    return { type: 'NOISE',  confidence: 85, features: {} };

    // Feature 1: zero crossing rate
    let zeroCrossings = 0;
    for (let i = 1; i < len; i++) {
        if ((dataArray[i - 1] - 128) * (dataArray[i] - 128) < 0) zeroCrossings++;
    }
    const zcr = zeroCrossings / len;

    // Feature 2: clip ratio
    const clipThresh = amplitude * 0.08;
    let nearClip = 0;
    for (let i = 0; i < len; i++) {
        if (dataArray[i] <= min + clipThresh || dataArray[i] >= max - clipThresh) nearClip++;
    }
    const clipRatio = nearClip / len;

    // Feature 3: slope asymmetry
    let posSlopes = 0, negSlopes = 0;
    for (let i = 1; i < len; i++) {
        const d = dataArray[i] - dataArray[i - 1];
        if (d > 0) posSlopes++;
        else if (d < 0) negSlopes++;
    }
    const slopeAsym = Math.abs(posSlopes - negSlopes) / (len - 1);

    // Feature 4: edge density
    let edges = 0;
    for (let i = 1; i < len; i++) {
        if (Math.abs(dataArray[i] - dataArray[i - 1]) > amplitude * 0.4) edges++;
    }
    const edgeDensity = edges / len;

    // Feature 5: autocorrelation (half period)
    const lag = Math.max(1, Math.floor(len / 4));
    let autoCov = 0, autoVar = 0;
    const meanN = sum / len;
    for (let i = 0; i < len - lag; i++) {
        const a = (dataArray[i]       - 128) / 128 - meanN;
        const b = (dataArray[i + lag] - 128) / 128 - meanN;
        autoCov += a * b;
        autoVar += a * a;
    }
    const autoCorr = autoVar > 0 ? autoCov / autoVar : 0;

    // Feature 6: spectral flatness proxy
    let slopeVar = 0;
    const slopeMean = (posSlopes - negSlopes) / (len - 1);
    for (let i = 1; i < len; i++) {
        const d = dataArray[i] - dataArray[i - 1];
        slopeVar += (d - slopeMean) ** 2;
    }
    slopeVar /= (len - 1);
    const spectralFlatness = slopeVar > 0 ? Math.min(1, 1000 / slopeVar) : 0;

    const features = { crest, zcr, clipRatio, slopeAsym, edgeDensity, autoCorr, spectralFlatness };

    // ── DECISION TREE — order matters ──

    // NOISE — low autocorrelation + high spectral flatness
    if (autoCorr < 0.1 && spectralFlatness < 0.3) {
        return { type: 'NOISE', confidence: Math.round(80 + (0.3 - spectralFlatness) * 60), features };
    }

    // SQUARE — strong clipping + edge transitions
    if (clipRatio > 0.22 && edgeDensity > 0.01) {
        const conf = Math.round(70 + clipRatio * 80 + edgeDensity * 200);
        return { type: 'SQUARE', confidence: Math.min(99, conf), features };
    }

    // SAWTOOTH — pronounced slope asymmetry
    if (slopeAsym > 0.33 && edgeDensity > 0.005) {
        const conf = Math.round(60 + slopeAsym * 100);
        return { type: 'SAWTOOTH', confidence: Math.min(99, conf), features };
    }

    // ── SINE checked BEFORE TRIANGLE ──
    // Sine crest is theoretically 1.414 (√2). Accept 1.10–1.55.
    // Triangle crest is 1.633. Must be strictly above 1.55 to be triangle.
    if (crest >= 1.10 && crest <= 1.55 && clipRatio < 0.12 && edgeDensity < 0.015) {
        const idealDiff = Math.abs(crest - 1.414);
        const conf      = Math.round(99 - idealDiff * 180);
        return { type: 'SINE', confidence: Math.max(55, Math.min(99, conf)), features };
    }

    // TRIANGLE — crest clearly above sine range, smooth slopes
    if (crest > 1.55 && clipRatio < 0.12 && slopeAsym < 0.2) {
        const conf = Math.round(65 + (crest - 1.55) * 80);
        return { type: 'TRIANGLE', confidence: Math.min(99, conf), features };
    }

    // Fallback
    if (crest > 1.60) return { type: 'TRIANGLE', confidence: 50, features };
    if (clipRatio > 0.15) return { type: 'SQUARE', confidence: 50, features };
    return { type: 'SINE', confidence: 45, features };
}
