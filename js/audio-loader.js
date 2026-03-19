// ── AUDIO-LOADER.JS v1.1.2 FIXED — Recording timer + file display ──
const AudioLoader = {
    _recordCtx:      null,
    _mediaStream:    null,
    _mediaRec:       null,
    _chunks:         [],
    _isRecording:    false,
    _recordStart:    0,
    _playhead:       0,
    _pcmBuffer:      null,
    _timerInterval:  null,

    // ── Load audio file → decode → Float32 PCM ──
    async loadFile(file) {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const decodeCtx   = new (window.AudioContext || window.webkitAudioContext)();
            const audioBuffer = await decodeCtx.decodeAudioData(arrayBuffer);

            // Resample to simSampleRate if needed
            const srcSR  = audioBuffer.sampleRate;
            const tgtSR  = State.simSampleRate;
            const srcPCM = audioBuffer.getChannelData(0);

            if (srcSR === tgtSR) {
                this._pcmBuffer = srcPCM;
            } else {
                // Linear resample
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
            
            // ✅ Show success message
            const duration = (this._pcmBuffer.length / tgtSR).toFixed(1);
            this._updateStatus(`✓ Loaded ${file.name} (${duration}s)`, '#00ff41');
            
        } catch (err) {
            console.error('AudioLoader.loadFile:', err);
            this._updateStatus('✗ Decode failed', '#ff1744');
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
            this._recordStart = Date.now();

            // ✅ Start timer display
            this._updateRecordingTimer();
            this._timerInterval = setInterval(() => this._updateRecordingTimer(), 100);

            this._mediaRec.ondataavailable = e => {
                if (e.data.size > 0) this._chunks.push(e.data);
            };

            this._mediaRec.onstop = async () => {
                clearInterval(this._timerInterval);
                const blob = new Blob(this._chunks, { type: 'audio/webm' });
                const duration = ((Date.now() - this._recordStart) / 1000).toFixed(1);
                
                // Auto-name the recording
                const filename = `recording_${duration}s.webm`;
                this._updateFilename(filename);
                
                await this.loadFile(blob);
                this._mediaStream.getTracks().forEach(t => t.stop());
                this._isRecording = false;
                
                // Update button states
                this._updateRecordButtons(false);
            };

            this._mediaRec.start(100);

            // Update button states
            this._updateRecordButtons(true);

        } catch (err) {
            console.error('Recording failed:', err);
            alert('Microphone permission required for recording.');
            this._isRecording = false;
        }
    },

    _stopRecord() {
        if (this._mediaRec && this._isRecording) {
            this._mediaRec.stop();
        }
    },

    // ✅ Update recording timer display
    _updateRecordingTimer() {
        const elapsed = ((Date.now() - this._recordStart) / 1000).toFixed(1);
        this._updateStatus(`⏺ Recording... ${elapsed}s`, '#ff1744');
    },

    // ✅ Update status displays
    _updateStatus(text, color) {
        document.querySelectorAll('#simRecStatus, .sim-status').forEach(el => {
            if (el) {
                el.innerText = text;
                el.style.color = color || '#00e5ff';
            }
        });
    },

    // ✅ Update filename displays
    _updateFilename(name) {
        document.querySelectorAll('#simFileName, #simFileNameMenu').forEach(el => {
            if (el) {
                el.innerText = name;
                el.classList.remove('empty');
            }
        });
    },

    // ✅ Update record button states
    _updateRecordButtons(isRecording) {
        document.querySelectorAll('#simRecBtn, #simRecBtnMenu').forEach(btn => {
            if (btn) {
                if (isRecording) {
                    btn.innerText = '⏹ STOP';
                    btn.classList.add('rec-active', 'btn-danger-full');
                } else {
                    btn.innerText = '⏺ RECORD MIC';
                    btn.classList.remove('rec-active', 'btn-danger-full');
                }
            }
        });
    },

    // ── Called by Simulator to fill dataArray from file PCM ──
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
