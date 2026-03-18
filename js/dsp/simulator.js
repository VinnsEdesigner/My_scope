// ── DSP/SIMULATOR.JS v1.1.1 ──
// Waveform math engine — runs inside Web Worker
// Exports: simGenerate()

let _phase_acc = 0;

function simGenerate(simState, fftSize, sr) {
    const dataArray = new Uint8Array(fftSize);
    const freqArray = new Uint8Array(Math.floor(fftSize / 2));
    const freq  = simState.frequency || 1000;
    const amp   = simState.amplitude || 0.8;
    const duty  = simState.dutyCycle || 0.5;
    const phOff = (simState.phase   || 0) * Math.PI / 180;
    sr = sr || 44100;

    for (let i = 0; i < fftSize; i++) {
        _phase_acc = (_phase_acc + freq / sr) % 1.0;
        const frac = ((_phase_acc + phOff / (2 * Math.PI)) % 1 + 1) % 1;

        let s = 0;
        switch (simState.waveType) {
            case 'sine':     s = Math.sin(2 * Math.PI * frac); break;
            case 'square':   s = frac < duty ? 1.0 : -1.0; break;
            case 'triangle': s = frac < 0.5 ? (4 * frac - 1) : (3 - 4 * frac); break;
            case 'sawtooth': s = 2 * frac - 1; break;
            case 'ramp':     s = 1 - 2 * frac; break;
            case 'pwm':      s = frac < duty ? 1.0 : -1.0; break;
            case 'noise':    s = Math.random() * 2 - 1; break;
            case 'dc':       s = 1.0; break;
            default:         s = Math.sin(2 * Math.PI * frac);
        }

        s = Math.max(-1.0, Math.min(1.0, s * amp));
        dataArray[i] = Math.round((s + 1.0) * 127.5);
    }

    // ── synthetic FFT ──
    const nyquist = sr / 2;
    const binW    = nyquist / freqArray.length;
    const fBin    = Math.round(freq / binW);

    if (fBin < freqArray.length) {
        freqArray[fBin] = Math.round(amp * 255);
        if (fBin > 0)                          freqArray[fBin - 1] = Math.round(amp * 180);
        if (fBin + 1 < freqArray.length)       freqArray[fBin + 1] = Math.round(amp * 180);
    }

    // harmonics for non-sine waveforms
    if (simState.waveType !== 'sine' && simState.waveType !== 'dc' && simState.waveType !== 'noise') {
        for (let h = 3; h <= 9; h += 2) {
            const hBin = Math.round(freq * h / binW);
            if (hBin < freqArray.length) {
                freqArray[hBin] = Math.round(amp / h * 255);
            }
        }
    }

    // noise floor
    for (let j = 0; j < freqArray.length; j++) {
        if (freqArray[j] === 0) freqArray[j] = Math.round(Math.random() * 8);
    }

    return { dataArray, freqArray };
}
