// ── WORKER.JS v1.1.2 — DSP Web Worker (GitHub Pages Fixed) ──
// Message handler only — all math lives in js/dsp/
// Main thread: canvas draw + DOM only
// This worker: ALL heavy DSP math
//
// Commands:
//   { cmd: 'generate',   id, simState, fftSize, simSampleRate }
//   { cmd: 'measure',    id, dataArray, freqArray, sampleRate, fftSize, calibFreq, calibVpp, simMode, simFreq }
//   { cmd: 'artifacts',  id, dataArray, params }
//   { cmd: 'classify',   id, dataArray, sampleRate }
//   { cmd: 'analyse',    id, ch1Array, ch2Array, sampleRate, fftSize }
//   { cmd: 'bode_point', id, ch1Array, ch2Array, freqHz, sampleRate }
//   { cmd: 'bode_sweep', id, ch1Array, ch2Array, startHz, stopHz, steps, sampleRate }

'use strict';

// ✅ FIXED: Absolute paths from root for GitHub Pages
importScripts(
    './js/dsp/simulator.js',
    './js/dsp/artifacts.js',
    './js/dsp/measurements.js',
    './js/dsp/classifier.js',
    './js/dsp/analyser.js',
    './js/dsp/bode.js'
);

self.onmessage = function(e) {
    const { cmd, id } = e.data;

    try {
        switch (cmd) {

            case 'generate': {
                const { simState, fftSize, simSampleRate } = e.data;
                const result = simGenerate(simState, fftSize, simSampleRate);
                self.postMessage(
                    { cmd, id, dataArray: result.dataArray, freqArray: result.freqArray },
                    [result.dataArray.buffer, result.freqArray.buffer]
                );
                break;
            }

            case 'measure': {
                const { dataArray, freqArray, sampleRate, fftSize,
                        calibFreq, calibVpp, simMode, simFreq } = e.data;
                const result = dspMeasure(
                    dataArray, freqArray, sampleRate,
                    fftSize, calibFreq, calibVpp, simMode, simFreq
                );
                self.postMessage({ cmd, id, ...result });
                break;
            }

            case 'artifacts': {
                const { dataArray, params } = e.data;
                const result = applyArtifacts(dataArray, params);
                self.postMessage(
                    { cmd, id, dataArray: result },
                    [result.buffer]
                );
                break;
            }

            case 'classify': {
                const { dataArray, sampleRate } = e.data;
                const result = dspClassify(dataArray, sampleRate);
                self.postMessage({ cmd, id, ...result });
                break;
            }

            case 'analyse': {
                const { ch1Array, ch2Array, sampleRate, fftSize } = e.data;
                const result = dspAnalyse(ch1Array, ch2Array, sampleRate, fftSize);
                self.postMessage({ cmd, id, ...result });
                break;
            }

            case 'bode_point': {
                const { ch1Array, ch2Array, freqHz, sampleRate } = e.data;
                const result = dspBodePoint(ch1Array, ch2Array, freqHz, sampleRate);
                self.postMessage({ cmd, id, point: result });
                break;
            }

            case 'bode_sweep': {
                const { ch1Array, ch2Array, startHz, stopHz, steps, sampleRate } = e.data;
                const result = dspBodeSweep(ch1Array, ch2Array, startHz, stopHz, steps, sampleRate);
                self.postMessage({ cmd, id, ...result });
                break;
            }

            default:
                self.postMessage({ cmd: 'error', id, msg: `Unknown command: ${cmd}` });
        }

    } catch (err) {
        self.postMessage({ cmd: 'error', id, msg: err.message, stack: err.stack });
    }
};
