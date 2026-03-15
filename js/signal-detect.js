// ── SIGNAL-DETECT.JS v1.0.3 ──
const SignalDetect = {
    run(dataArray) {
        const len = dataArray.length;
        let min = 255, max = 0, sumSq = 0;
        let prevAbove = dataArray[0] > 128;
        let posSlopes = 0, negSlopes = 0;

        for (let i = 0; i < len; i++) {
            const v = dataArray[i];
            if (v < min) min = v;
            if (v > max) max = v;
            const norm = (v - 128) / 128;
            sumSq += norm * norm;
            const above = v > 128;
            if (above !== prevAbove) prevAbove = above;
            if (i > 0) {
                const d = dataArray[i] - dataArray[i - 1];
                if (d > 0) posSlopes++;
                else if (d < 0) negSlopes++;
            }
        }

        const amplitude = max - min;
        const rms       = Math.sqrt(sumSq / len);

        if (amplitude < 6)   return 'DC';
        if (rms < 0.008)     return 'NOISE';

        const peak  = Math.max(Math.abs(max - 128), Math.abs(min - 128)) / 128;
        const crest = peak / (rms + 0.0001);

        let nearClip = 0;
        const clipThresh = amplitude * 0.08;
        for (let i = 0; i < len; i++) {
            if (dataArray[i] <= min + clipThresh || dataArray[i] >= max - clipThresh) nearClip++;
        }
        const clipRatio = nearClip / len;
        const slopeAsym = Math.abs(posSlopes - negSlopes) / (len - 1);

        if (clipRatio > 0.22)                    return 'SQUARE';
        if (slopeAsym > 0.33)                    return 'SAWTOOTH';
        if (crest > 1.60)                        return 'TRIANGLE';
        if (crest >= 1.20 && crest <= 1.60)      return 'SINE';
        return 'NOISE';
    },

    updateBadge(type) {
        if (type === State.lastSignalType) return;
        State.lastSignalType = type;
        const badge = document.getElementById('sigTypeBadge');
        badge.innerText = type;
        badge.className = 'sig-badge';
        const map = {
            SINE: 'sine', SQUARE: 'square', TRIANGLE: 'triangle',
            SAWTOOTH: 'sawtooth', NOISE: 'noise', DC: 'dc'
        };
        if (map[type]) badge.classList.add(map[type]);
    }
};
