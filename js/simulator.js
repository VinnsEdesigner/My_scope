// ── SIMULATOR.JS v1.1.1 — waveform math engine ──
const Simulator = {

    generate(dataArray, freqArray) {
        if (!dataArray) return;
        const len  = dataArray.length;
        const sr   = State.simSampleRate;
        const freq = State.sim.frequency  || 1000;
        const amp  = State.sim.amplitude  || 0.8;
        const duty = State.sim.dutyCycle  || 0.5;
        const phaseOffset = (State.sim.phase || 0) * Math.PI / 180;

        for (let i = 0; i < len; i++) {
            // advance phase accumulator
            State.sim.phase_acc = (State.sim.phase_acc + (freq / sr)) % 1.0;
            const t = State.sim.phase_acc + phaseOffset / (2 * Math.PI);
            const frac = t - Math.floor(t); // 0..1

            let s = 0;
            switch (State.sim.waveType) {
                case 'sine':
                    s = Math.sin(2 * Math.PI * frac);
                    break;
                case 'square':
                    s = frac < duty ? 1.0 : -1.0;
                    break;
                case 'triangle':
                    s = frac < 0.5 ? (4 * frac - 1) : (3 - 4 * frac);
                    break;
                case 'sawtooth':
                    s = 2 * frac - 1;
                    break;
                case 'ramp':
                    s = 1 - 2 * frac;
                    break;
                case 'pwm':
                    s = frac < duty ? 1.0 : -1.0;
                    break;
                case 'noise':
                    s = (Math.random() * 2) - 1;
                    break;
                case 'dc':
                    s = 1.0;
                    break;
                default:
                    s = Math.sin(2 * Math.PI * frac);
            }

            s *= amp;
            s = Math.max(-1.0, Math.min(1.0, s));
            // Float32 [-1,+1] → Uint8 [0,255]
            dataArray[i] = Math.round((s + 1.0) * 127.5);
        }

        // simple synthetic FFT (amplitude bucket per harmonic)
        if (freqArray) {
            freqArray.fill(0);
            const nyquist  = sr / 2;
            const binWidth = nyquist / freqArray.length;
            const fundamentalBin = Math.round(freq / binWidth);

            // fundamental
            if (fundamentalBin < freqArray.length) {
                freqArray[fundamentalBin] = Math.round(amp * 255);
                if (fundamentalBin > 0) freqArray[fundamentalBin - 1] = Math.round(amp * 180);
                if (fundamentalBin + 1 < freqArray.length) freqArray[fundamentalBin + 1] = Math.round(amp * 180);
            }

            // harmonics for non-sine
            if (State.sim.waveType !== 'sine' && State.sim.waveType !== 'dc') {
                for (let h = 3; h <= 9; h += 2) {
                    const hBin = Math.round((freq * h) / binWidth);
                    if (hBin < freqArray.length) {
                        const hAmp = amp / h;
                        freqArray[hBin] = Math.round(hAmp * 255);
                    }
                }
            }

            // noise floor
            for (let j = 0; j < freqArray.length; j++) {
                if (freqArray[j] === 0) freqArray[j] = Math.round(Math.random() * 8);
            }
        }
    }
};
