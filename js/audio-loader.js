// ── AUDIO-LOADER.JS v1.1.1 — file picker + mic recorder ──
const AudioLoader = {
    _recordCtx:    null,
    _mediaStream:  null,
    _mediaRec:     null,
    _chunks:       [],
    _isRecording:  false,
    _playhead:     0,
    _pcmBuffer:    null,   // Float32Array — decoded PCM

    // ── Load audio file → decode → Float32 PCM ──
    async loadFile(file) {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const decodeCtx   = new (window.AudioContext || window.webkitAudioContext)();
            const audioBuffer = await decodeCtx.decodeAudioData(arrayBuffer);

            // resample to simSampleRate if needed
            const srcSR  = audioBuffer.sampleRate;
            const tgtSR  = State.simSampleRate;
            const srcPCM = audioBuffer.getChannelData(0);

            if (srcSR === tgtSR) {
                this._pcmBuffer = srcPCM;
            } else {
                // linear resample
                const ratio    = srcSR / tgtSR;
                const outLen   = Math.round(srcPCM.length / ratio);
                const resampled = new Float32Array(outLen);
                for (let i = 0; i < outLen; i++) {
                    const pos  = i * ratio;
                    const idx  = Math.floor(pos);
                    const frac = pos - idx;
                    const a    = srcPCM[idx]     || 0;
                    const b    = srcPCM[idx + 1] || 0;
                    resampled[i] = a + frac * (b - a);
                }
                this._pcmBuffer = resampled;
            }

            this._playhead    = 0;
            State.sim.playing = true;

            await decodeCtx.close();
        } catch (err) {
            console.error('AudioLoader.loadFile:', err);
            alert('Could not decode file. Try MP3, WAV or OGG.');
        }
    },

    // ── Toggle mic recording ──
    async toggleRecord() {
        if (this._isRecording) {
            this._stopRecord();
        } else {
            await this._startRecord();
        }
    },

    async _startRecord() {
        try {
            this._mediaStream = await navigator.mediaDevices.getUserMedia({
                audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
            });
            this._chunks      = [];
            this._mediaRec    = new MediaRecorder(this._mediaStream);
            this._isRecording = true;

            this._mediaRec.ondataavailable = e => {
                if (e.data.size > 0) this._chunks.push(e.data);
            };

            this._mediaRec.onstop = async () => {
                const blob = new Blob(this._chunks, { type: 'audio/webm' });
                await this.loadFile(blob);
                this._mediaStream.getTracks().forEach(t => t.stop());
                this._isRecording = false;
                const btn = document.getElementById('simRecBtn');
                if (btn) { btn.innerText = '⏺ RECORD MIC'; btn.classList.remove('rec-active'); }
            };

            this._mediaRec.start(100);

            const btn = document.getElementById('simRecBtn');
            if (btn) { btn.innerText = '⏹ STOP RECORDING'; btn.classList.add('rec-active'); }

        } catch (err) {
            alert('Microphone permission required for recording.');
        }
    },

    _stopRecord() {
        if (this._mediaRec && this._isRecording) {
            this._mediaRec.stop();
        }
    },

    // ── Called by Simulator.generate() to fill dataArray from file PCM ──
    fillFromFile(dataArray) {
        if (!this._pcmBuffer || !dataArray) return;

        const len = dataArray.length;
        for (let i = 0; i < len; i++) {
            const idx = (this._playhead + i) % this._pcmBuffer.length;
            const s   = Math.max(-1.0, Math.min(1.0, this._pcmBuffer[idx] * State.sim.amplitude));
            dataArray[i] = Math.round((s + 1.0) * 127.5);
        }
        this._playhead = (this._playhead + len) % this._pcmBuffer.length;
    },

    get hasFile()      { return !!this._pcmBuffer; },
    get isRecording()  { return this._isRecording; },
};
