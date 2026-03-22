// ── JS/ARTIFACTS.JS v1.3.0 ──
// Artifacts state container — params object used by app.js and ui.js
// The actual DSP processing is in js/dsp/artifacts.js (loaded on main thread)

const Artifacts = {
    params: {
        // Stage 1 — source artifacts
        dcOffset:    0,
        harmDistort: 0,
        srcClip:     0,

        // Stage 2 — phone hardware simulation
        acCouple:    0,
        micBias:     0,
        asymClip:    0,
        agcPumping:  0,
        hpfCorner:   0,
        rolloff:     0,
        noiseFloor:  0,
        quantize:    0,
    },

    reset() {
        Object.keys(this.params).forEach(k => { this.params[k] = 0; });
    },

    hasActive() {
        return Object.values(this.params).some(v => v !== 0);
    },
};
