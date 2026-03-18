// ── DSP/MEASUREMENTS.JS v1.1.1 ──
// Signal measurements — runs inside Web Worker
// Exports: dspMeasure()

function dspMeasure(dataArray, freqArray, sampleRate, fftSize, calibFreq, calibVpp, simMode, simFreq) {
    const len = dataArray.length;
    let min = 255, max = 0, sumSq = 0;

    for (let i = 0; i < len; i++) {
        if (dataArray[i] < min) min = dataArray[i];
        if (dataArray[i] > max) max = dataArray[i];
        const n = (dataArray[i] - 128) / 128;
        sumSq += n * n;
    }

    const rawVpp = (max - min) / 128;
    const vpp    = rawVpp * (calibVpp || 1.0);
    const rms    = Math.sqrt(sumSq / len);
    const db     = rms > 0 ? 20 * Math.log10(rms) : -Infinity;

    // ── Frequency detection ──
    let freq = 0;
    if (simMode) {
        // in sim mode use known frequency directly
        freq = simFreq || 0;
    } else if (freqArray && sampleRate && fftSize) {
        // find FFT peak bin
        let peakIdx = 0, peakVal = 0;
        for (let i = 2; i < freqArray.length; i++) {
            if (freqArray[i] > peakVal) {
                peakVal = freqArray[i];
                peakIdx = i;
            }
        }
        // parabolic interpolation for sub-bin accuracy
        let refinedBin = peakIdx;
        if (peakIdx > 0 && peakIdx < freqArray.length - 1) {
            const a = freqArray[peakIdx - 1];
            const b = freqArray[peakIdx];
            const c = freqArray[peakIdx + 1];
            const denom = 2 * (2 * b - a - c);
            if (denom !== 0) refinedBin = peakIdx + (a - c) / denom;
        }
        freq = Math.round(refinedBin * sampleRate / fftSize * (calibFreq || 1.0));
    }

    // ── Waveform shape metrics (used by classifier) ──
    let posArea = 0, negArea = 0;
    for (let i = 0; i < len; i++) {
        const n = (dataArray[i] - 128) / 128;
        if (n > 0) posArea += n;
        else       negArea += Math.abs(n);
    }
    const asymmetry = posArea + negArea > 0
        ? (posArea - negArea) / (posArea + negArea)
        : 0;

    return {
        vpp,
        rawVpp,
        rms,
        db,
        freq,
        crest: rms > 0.001 ? (Math.max(Math.abs(max - 128), Math.abs(min - 128)) / 128) / rms : 0,
        asymmetry,
        amplitude: max - min,
    };
}
