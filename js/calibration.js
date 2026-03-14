// ── CALIBRATION.JS ──
const Calibration = {

    runFreq() {
        if (!State.analyser || !State.freqArray) {
            alert('Start probe first before calibrating.');
            return;
        }
        const refFreq = parseFloat(document.getElementById('calibFreqInput').value);
        if (isNaN(refFreq) || refFreq <= 0) {
            alert('Enter a valid reference frequency in Hz');
            return;
        }

        // get current measured freq peak
        let peakIdx = 0, peakVal = 0;
        for (let i = 2; i < State.freqArray.length; i++) {
            if (State.freqArray[i] > peakVal) {
                peakVal = State.freqArray[i];
                peakIdx = i;
            }
        }
        const measuredFreq = Math.round(peakIdx * State.audioCtx.sampleRate / State.analyser.fftSize);
        if (measuredFreq < 10) {
            alert('No signal detected. Connect reference signal first.');
            return;
        }

        State.calibFreq = refFreq / measuredFreq;
        document.getElementById('calibFreqResult').innerText = State.calibFreq.toFixed(4) + 'x';
        alert(`Freq calibration done!\nMeasured: ${measuredFreq}Hz → Reference: ${refFreq}Hz\nCorrection: ${State.calibFreq.toFixed(4)}x`);
    },

    runVpp() {
        if (!State.dataArray) {
            alert('Start probe first before calibrating.');
            return;
        }
        const refVpp = parseFloat(document.getElementById('calibVppInput').value);
        if (isNaN(refVpp) || refVpp <= 0) {
            alert('Enter a valid reference Vpp value');
            return;
        }

        let min = 255, max = 0;
        for (let i = 0; i < State.dataArray.length; i++) {
            if (State.dataArray[i] < min) min = State.dataArray[i];
            if (State.dataArray[i] > max) max = State.dataArray[i];
        }
        const measuredVpp = (max - min) / 128;
        if (measuredVpp < 0.01) {
            alert('Signal too weak. Increase input level and retry.');
            return;
        }

        State.calibVpp = refVpp / measuredVpp;
        document.getElementById('calibVppResult').innerText = State.calibVpp.toFixed(4) + 'x';
        alert(`Vpp calibration done!\nMeasured: ${measuredVpp.toFixed(3)}V → Reference: ${refVpp}V\nCorrection: ${State.calibVpp.toFixed(4)}x`);
    },

    reset() {
        State.calibFreq = 1.0;
        State.calibVpp  = 1.0;
        document.getElementById('calibFreqResult').innerText = '1.000x';
        document.getElementById('calibVppResult').innerText  = '1.000x';
        document.getElementById('calibFreqInput').value = '1000';
        document.getElementById('calibVppInput').value  = '1.00';
        alert('Calibration reset to default (1.000x)');
    }
};
