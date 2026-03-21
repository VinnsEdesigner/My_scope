// ── WORKER.JS v1.1.4 ──
// Relative importScripts paths — works on GitHub Pages subdirectory repos
'use strict';

importScripts(
    'dsp/simulator.js',
    'dsp/artifacts.js',
    'dsp/measurements.js',
    'dsp/classifier.js',
    'dsp/analyser.js',
    'dsp/bode.js',
    'dsp/correction.js'
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
                self.postMessage({ cmd, id, dataArray: result }, [result.buffer]);
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

            case 'correct': {
                const { ch2Array, analyserResult, sampleRate } = e.data;
                const result = dspCorrect(ch2Array, analyserResult, sampleRate);
                self.postMessage(
                    { cmd, id, ch3Array: result },
                    [result.buffer]
                );
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
