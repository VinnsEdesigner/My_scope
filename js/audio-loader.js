// ── AUDIO-LOADER.JS v1.1.4 ── CH1 + CH2 file loading with Persist
const AudioLoader = {
    // CH2 buffer — comparison signal
    _pcmBuffer:     null,
    _playhead:      0,

    // CH1 buffer — reference signal
    _pcmBufferCH1:  null,
    _playheadCH1:   0,

    // Recording state
    _mediaStream:   null,
    _mediaRec:      null,
    _chunks:        [],
    _isRecording:   false,
    _recordStart:   0,
    _timerInterval: null,

    // ══════════════════════════════════════
    // CH2 file load — comparison signal
    // ══════════════════════════════════════
    async loadFile(file) {
        try {
            const pcm = await this._decodeFile(file);
            this._pcmBuffer = pcm;
            this._playhead  = 0;

            const duration = (pcm.length / State.simSampleRate).toFixed(1);
            this._updateStatus(`✓ ${file.name} (${duration}s)`, '#00ff41');

            // Persist to IndexedDB for session restore
            await Persist.saveCH2Buffer(pcm, file.name);

            return true;
        } catch (err) {
            console.error('AudioLoader.loadFile CH2:', err);
            this._updateStatus('✗ Decode failed', '#ff1744');
            alert('Could not decode file. Try MP3, WAV or OGG.');
            return false;
        }
    },

    // ══════════════════════════════════════
    // CH1 file load — reference signal
    // ══════════════════════════════════════
    async loadFileCH1(file) {
        try {
            const pcm = await this._decodeFile(file);
            this._pcmBufferCH1 = pcm;
            this._playheadCH1  = 0;

            const duration = (pcm.length / State.simSampleRate).toFixed(1);
            console.log(`✓ CH1 file loaded: ${file.name} (${duration}s)`);

            // Persist to IndexedDB for session restore
            await Persist.saveCH1Buffer(pcm, file.name);

            return true;
        } catch (err) {
            console.error('AudioLoader.loadFileCH1:', err);
            alert('Could not decode CH1 file. Try MP3, WAV or OGG.');
            return false;
        }
    },

    // ══════════════════════════════════════
    // Shared decode — file/blob → Float32 PCM
    // Resamples to State.simSampleRate if needed
    // ══════════════════════════════════════
    async _decodeFile(file) {
        const arrayBuffer = await file.arrayBuffer();
        const decodeCtx   = new (window.AudioContext || window.webkitAudioContext)();
        const audioBuffer = await decodeCtx.decodeAudioData(arrayBuffer);

        const srcSR  = audioBuffer.sampleRate;
        const tgtSR  = State.simSampleRate;
        const srcPCM = audioBuffer.getChannelData(0);

        await decodeCtx.close();

        if (srcSR === tgtSR) return srcPCM;

        // Linear resample
        const ratio     = srcSR / tgtSR;
        const outLen    = Math.round(srcPCM.length / ratio);
        const resampled = new Float32Array(outLen);
        for (let i = 0; i < outLen; i++) {
            const pos  = i * ratio;
            const idx  = Math.floor(pos);
            const frac = pos - idx;
            const a    = srcPCM[idx]     || 0;
            const b    = srcPCM[idx + 1] || 0;
            resampled[i] = a + frac * (b - a);
        }
        return resampled;
    },

    // ══════════════════════════════════════
    // Fill dataArray from CH2 file (looping)
    // ══════════════════════════════════════
    fillFromFile(dataArray) {
        if (!this._pcmBuffer || !dataArray) return;
        const len = dataArray.length;
        const amp = State.sim.amplitude || 1.0;
        for (let i = 0; i < len; i++) {
            const idx = (this._playhead + i) % this._pcmBuffer.length;
            const s   = Math.max(-1.0, Math.min(1.0, this._pcmBuffer[idx] * amp));
            dataArray[i] = Math.round((s + 1.0) * 127.5);
        }
        this._playhead = (this._playhead + len) % this._pcmBuffer.length;
    },

    // ══════════════════════════════════════
    // Fill dataArray from CH1 file (looping)
    // ══════════════════════════════════════
    fillFromFileCH1(dataArray) {
        if (!this._pcmBufferCH1 || !dataArray) return;
        const len = dataArray.length;
        for (let i = 0; i < len; i++) {
            const idx = (this._playheadCH1 + i) % this._pcmBufferCH1.length;
            const s   = Math.max(-1.0, Math.min(1.0, this._pcmBufferCH1[idx]));
            dataArray[i] = Math.round((s + 1.0) * 127.5);
        }
        this._playheadCH1 = (this._playheadCH1 + len) % this._pcmBufferCH1.length;
    },

    // ══════════════════════════════════════
    // RECORDING (CH2)
    // ══════════════════════════════════════
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
            this._recordStart = Date.now();

            this._updateStatus('⏺ Recording... 0.0s', '#ff1744');
            this._timerInterval = setInterval(() => {
                const elapsed = ((Date.now() - this._recordStart) / 1000).toFixed(1);
                this._updateStatus(`⏺ Recording... ${elapsed}s`, '#ff1744');
            }, 100);

            this._mediaRec.ondataavailable = e => {
                if (e.data.size > 0) this._chunks.push(e.data);
            };

            this._mediaRec.onstop = async () => {
                clearInterval(this._timerInterval);
                const blob     = new Blob(this._chunks, { type: 'audio/webm' });
                const duration = ((Date.now() - this._recordStart) / 1000).toFixed(1);
                const filename = `recording_${duration}s.webm`;

                this._updateFilename(filename);
                await this.loadFile(blob); // also persists to IndexedDB

                this._mediaStream.getTracks().forEach(t => t.stop());
                this._isRecording = false;
                this._updateRecordButtons(false);
            };

            this._mediaRec.start(100);
            this._updateRecordButtons(true);

        } catch (err) {
            console.error('Recording failed:', err);
            alert('Microphone permission required for recording.');
            this._isRecording = false;
        }
    },

    _stopRecord() {
        if (this._mediaRec && this._isRecording) this._mediaRec.stop();
    },

    _updateStatus(text, color) {
        document.querySelectorAll('#simRecStatus, .sim-status, #simFileInfo').forEach(el => {
            if (el) { el.innerText = text; el.style.color = color || '#00e5ff'; }
        });
    },

    _updateFilename(name) {
        document.querySelectorAll('#simFileName, #ch2FileName').forEach(el => {
            if (el) { el.innerText = name; el.classList.remove('empty'); }
        });
    },

    _updateRecordButtons(isRecording) {
        document.querySelectorAll('#simRecBtn').forEach(btn => {
            if (btn) {
                btn.innerText = isRecording ? '⏹ STOP' : '⏺ RECORD MIC';
                btn.classList.toggle('recording', isRecording);
            }
        });
    },

    // ══════════════════════════════════════
    // GETTERS
    // ══════════════════════════════════════
    get hasFile()     { return !!this._pcmBuffer; },
    get hasCH1File()  { return !!this._pcmBufferCH1; },
    get isRecording() { return this._isRecording; },
};
