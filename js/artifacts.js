// ── ARTIFACTS.JS v1.1.1 — Stage 1 + Stage 2 artifact pipeline ──
// Each artifact: Float32Array → Float32Array (in-place)

const Artifacts = {

    // ── Default params (0 = off) ──
    params: {
        // Stage 1 — source artifacts
        dcOffset:    0.0,   // -1.0 to +1.0
        harmDistort: 0.0,   // 0 to 1.0
        srcClip:     0.0,   // 0 to 1.0

        // Stage 2 — phone hardware simulation
        acCouple:    0.0,   // 0 to 1.0 (cap tilt severity)
        micBias:     0.0,   // 0 to 0.5
        asymClip:    0.0,   // 0 to 1.0
        agcPumping:  0.0,   // 0 to 1.0
        hpfCorner:   0.0,   // 0 to 1.0 (maps 0Hz to 300Hz)
        rolloff:     0.0,   // 0 to 1.0 (LPF severity)
        noiseFloor:  0.0,   // 0 to 1.0
        quantize:    0.0,   // 0 to 1.0 (bit depth reduction)
    },

    // ── Apply full pipeline ──
    apply(data) {
        // convert Uint8 → Float32
        const f = new Float32Array(data.length);
        for (let i = 0; i < data.length; i++) f[i] = (data[i] / 127.5) - 1.0;

        this._stage1(f);
        this._stage2(f);

        // convert back Float32 → Uint8
        for (let i = 0; i < data.length; i++) {
            const clamped = Math.max(-1.0, Math.min(1.0, f[i]));
            data[i] = Math.round((clamped + 1.0) * 127.5);
        }
    },

    // ── STAGE 1: Source artifacts ──
    _stage1(f) {
        const p = this.params;

        // DC offset
        if (p.dcOffset !== 0) {
            for (let i = 0; i < f.length; i++) f[i] += p.dcOffset;
        }

        // Harmonic distortion (soft clip + 2nd harmonic)
        if (p.harmDistort > 0) {
            const d = p.harmDistort;
            for (let i = 0; i < f.length; i++) {
                f[i] = f[i] * (1 - d * 0.3) + (f[i] * f[i]) * d * 0.3;
            }
        }

        // Asymmetric hard clip
        if (p.srcClip > 0) {
            const threshold = 1.0 - p.srcClip * 0.7;
            for (let i = 0; i < f.length; i++) {
                if (f[i] > threshold) f[i] = threshold;
            }
        }
    },

    // ── STAGE 2: Phone hardware simulation ──
    _stage2(f) {
        const p = this.params;

        // AC coupling — capacitor tilt (high-pass, removes DC, tilts baseline)
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

        // Asymmetric clip — mic's one-sided AGC saturation
        if (p.asymClip > 0) {
            const pos = 0.8 - p.asymClip * 0.3;
            const neg = -1.0;
            for (let i = 0; i < f.length; i++) {
                if (f[i] > pos) f[i] = pos;
                if (f[i] < neg) f[i] = neg;
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

        // HPF corner — simulated hardware high-pass
        if (p.hpfCorner > 0) {
            const cutoffHz = p.hpfCorner * 300;
            const rc       = 1 / (2 * Math.PI * cutoffHz);
            const dt       = 1 / State.simSampleRate;
            const alpha    = rc / (rc + dt);
            let prev = f[0];
            for (let i = 1; i < f.length; i++) {
                const curr = f[i];
                f[i]  = alpha * (prev + curr - f[i - 1]);
                prev  = curr;
            }
        }

        // Cable rolloff — LPF (first-order)
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

        // Quantization (bit depth reduction)
        if (p.quantize > 0) {
            const bits  = Math.round(16 - p.quantize * 12); // 16 down to 4 bits
            const steps = Math.pow(2, bits);
            for (let i = 0; i < f.length; i++) {
                f[i] = Math.round(f[i] * steps) / steps;
            }
        }
    }
};
