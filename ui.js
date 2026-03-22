// ── UI.JS v1.3.0 ──
const UI = {

    // ══════════════════════════════════════
    // MAIN MENU
    // ══════════════════════════════════════
    toggleMenu() {
        document.getElementById('sideMenu').classList.toggle('open');
        document.getElementById('menuOverlay').classList.toggle('open');
    },

    switchMenuTab(tab) {
        document.querySelectorAll('.mtab').forEach(t => {
            t.classList.toggle('active', t.dataset.mtab === tab);
        });
        document.querySelectorAll('.mpanel').forEach(p => {
            p.classList.toggle('active', p.id === 'mpanel-' + tab);
        });
    },

    // ══════════════════════════════════════
    // SIM SET MENU
    // ══════════════════════════════════════
    toggleSimSetMenu() {
        const overlay = document.getElementById('simSetOverlay');
        const menu    = document.getElementById('simSetMenu');
        const opening = !menu.classList.contains('open');
        overlay.classList.toggle('open');
        menu.classList.toggle('open');
        if (opening) this._updateAnalyserLock();
    },

    switchSimSetTab(tab) {
        document.querySelectorAll('.sstab').forEach(t => {
            t.classList.toggle('active', t.dataset.sstab === tab);
        });
        document.querySelectorAll('.sspanel').forEach(p => {
            p.classList.toggle('active', p.id === 'sspanel-' + tab);
        });
    },

    // ══════════════════════════════════════
    // MAIN TAB SWITCHING
    // ══════════════════════════════════════
    switchTab(tab) {
        State.currentTab = tab;
        document.querySelectorAll('.tab').forEach(t => {
            t.classList.toggle('active', t.dataset.tab === tab);
        });

        const simOnly = tab === 'sim';
        const chPills = document.getElementById('chPills');
        const micBar  = document.getElementById('micBar');
        const simWrap = document.getElementById('simChevronWrap');
        if (chPills) chPills.classList.toggle('visible', simOnly);
        if (micBar)  micBar.classList.toggle('visible',  simOnly);
        if (simWrap) simWrap.classList.toggle('visible',  simOnly);

        // OSC view pills — show on non-SIM tabs only when SIM mode is active
        const oscPills = document.getElementById('oscPills');
        if (oscPills) oscPills.style.display = (!simOnly && State.simMode) ? 'flex' : 'none';

        const simBtns  = document.getElementById('simBtns');
        const mainBtns = document.getElementById('mainBtns');
        if (simBtns)  simBtns.style.display  = simOnly ? ''     : 'none';
        if (mainBtns) mainBtns.style.display = simOnly ? 'none' : '';

        if (simOnly  && !State.simMode) this._enterSimMode();
        if (!simOnly &&  State.simMode) this._exitSimMode();

        App.resize();
        Persist.save();
    },

    // ══════════════════════════════════════
    // OSC VIEW CHANNEL PICKER (OSC/FFT/INFO tabs in SIM mode)
    // ══════════════════════════════════════
    setOscView(ch) {
        State.oscViewChannel = ch;
        ['1','2','3'].forEach(n => {
            const el = document.getElementById('oscPill' + n);
            if (el) el.classList.toggle('active', 'ch' + n === ch);
        });
        Persist.scheduleSave();
    },

    // ══════════════════════════════════════
    // SIM MODE ENTER / EXIT
    // ══════════════════════════════════════
    _enterSimMode() {
        State.simMode = true;
        if (!State.dataArray) {
            State.dataArray = new Uint8Array(State.fftSize);
            State.freqArray = new Uint8Array(State.fftSize / 2);
        }
        if (!State.ch2Data) State.ch2Data = new Uint8Array(State.fftSize);

        const dot = document.getElementById('statusDot');
        if (dot) { dot.classList.remove('active'); dot.classList.add('sim'); }
        document.getElementById('statusTxt').innerText = 'SIM';

        // Show OSC pills on non-SIM tabs
        const oscPills = document.getElementById('oscPills');
        if (oscPills && State.currentTab !== 'sim') oscPills.style.display = 'flex';

        App.initMicStream();
        App.startLoop();
    },

    _exitSimMode() {
        State.simMode     = false;
        State.sim.playing = false;
        App.stopLoop();

        // Hide OSC pills
        const oscPills = document.getElementById('oscPills');
        if (oscPills) oscPills.style.display = 'none';

        const dot = document.getElementById('statusDot');
        if (dot) { dot.classList.remove('sim'); }
        if (State.isRunning) {
            document.getElementById('statusTxt').innerText = 'LIVE';
            document.getElementById('statusDot').classList.add('active');
            App.startLoop();
        } else {
            document.getElementById('statusTxt').innerText = 'STANDBY';
            App.drawIdle();
        }
    },

    // ══════════════════════════════════════
    // CH1 SOURCE — mic (default) or file
    // ══════════════════════════════════════
    toggleCH1Source() {
        this.setCH1Source(State.ch1Source === 'mic' ? 'file' : 'mic');
    },

    setCH1Source(src) {
        State.ch1Source = src;

        const btnMic  = document.getElementById('ch1SrcMic');
        const btnFile = document.getElementById('ch1SrcFile');
        if (btnMic)  btnMic.classList.toggle('active',  src === 'mic');
        if (btnFile) btnFile.classList.toggle('active', src === 'file');

        const fileRow = document.getElementById('ch1FileRow');
        if (fileRow) fileRow.style.display = src === 'file' ? 'flex' : 'none';

        const dot = document.getElementById('micDot');
        const lbl = document.getElementById('micBarLabel');
        const btn = document.getElementById('micToggleBtn');
        if (src === 'mic') {
            if (dot) dot.style.background = '#00ff41';
            if (lbl) lbl.innerText = 'CH1 MIC ● live capture';
            if (btn) { btn.innerText = '∨ MIC'; btn.className = 'mic-toggle-btn on'; }
        } else {
            if (dot) dot.style.background = '#ff6d00';
            if (lbl) lbl.innerText = 'CH1 FILE — playback mode';
            if (btn) { btn.innerText = '∨ FILE'; btn.className = 'mic-toggle-btn off'; }
        }

        this._updateCH1Status();
        this._updateAnalyserLock();
        Persist.save();
    },

    _updateCH1Status() {
        const el = document.getElementById('ch1SourceStatus');
        if (!el) return;
        if (State.ch1Source === 'mic') {
            el.style.color = '#00ff41';
            el.innerText   = '● MIC LIVE';
        } else if (AudioLoader.hasCH1File) {
            el.style.color = '#00ff41';
            el.innerText   = '● FILE LOADED';
        } else {
            el.style.color = '#ffb300';
            el.innerText   = '● NO FILE';
        }
    },

    loadCH1File() {
        const picker = document.getElementById('ch1FilePicker');
        if (picker) picker.click();
    },

    async onCH1FileSelected(input) {
        if (!input.files || !input.files[0]) return;
        const file = input.files[0];
        const nameEl = document.getElementById('ch1FileName');
        if (nameEl) { nameEl.innerText = file.name; nameEl.style.color = '#00e5ff'; }
        await AudioLoader.loadFileCH1(file);
        this._updateCH1Status();
        this._updateAnalyserLock();
        Persist.save();
    },

    // ══════════════════════════════════════
    // CH2 SOURCE — synth (default) or file
    // ══════════════════════════════════════
    setCH2Source(src) {
        State.ch2Source = src;

        const btnSynth = document.getElementById('ch2SrcSynth');
        const btnFile  = document.getElementById('ch2SrcFile');
        if (btnSynth) btnSynth.classList.toggle('active', src === 'synth');
        if (btnFile)  btnFile.classList.toggle('active',  src === 'file');

        const fileRow = document.getElementById('ch2FileRow');
        if (fileRow) fileRow.style.display = src === 'file' ? 'flex' : 'none';

        const srcSynth = document.getElementById('srcSynth');
        const srcFile  = document.getElementById('srcFile');
        if (srcSynth) srcSynth.className = 'sim-src-btn' + (src === 'synth' ? ' active-synth' : '');
        if (srcFile)  srcFile.className  = 'sim-src-btn' + (src === 'file'  ? ' active-file'  : '');

        const synthPanel = document.getElementById('simSynthPanel');
        const filePanel  = document.getElementById('simFilePanel');
        if (synthPanel) synthPanel.style.display = src === 'synth' ? 'flex' : 'none';
        if (filePanel)  filePanel.style.display  = src === 'file'  ? 'flex' : 'none';

        this._updateCH2Status();
        Persist.save();
    },

    _updateCH2Status() {
        const el = document.getElementById('ch2SourceStatus');
        if (!el) return;
        if (State.ch2Source === 'synth') {
            el.style.color = '#e040fb';
            el.innerText   = '● SYNTH';
        } else if (AudioLoader.hasFile) {
            el.style.color = '#00ff41';
            el.innerText   = '● FILE LOADED';
        } else {
            el.style.color = '#ffb300';
            el.innerText   = '● NO FILE';
        }
    },

    loadCH2File() {
        const picker = document.getElementById('ch2FilePicker');
        if (picker) picker.click();
    },

    async onCH2FileSelected(input) {
        if (!input.files || !input.files[0]) return;
        const file = input.files[0];
        ['simFileName', 'ch2FileName'].forEach(id => {
            const el = document.getElementById(id);
            if (el) { el.innerText = file.name; el.classList.remove('empty'); el.style.color = '#00e5ff'; }
        });
        await AudioLoader.loadFile(file);
        this._updateCH2Status();
        const infoEl = document.getElementById('simFileInfo');
        if (infoEl) { infoEl.innerText = 'loaded'; infoEl.style.color = '#00ff41'; infoEl.className = 'sim-rec-timer'; }
        Persist.save();
    },

    // Legacy aliases
    loadSimFileCH2()         { this.loadCH2File(); },
    loadSimFile()            { this.loadCH2File(); },
    onSimFileSelected(input) { this.onCH2FileSelected(input); },

    // ══════════════════════════════════════
    // ANALYSER + BODE LOCK / UNLOCK
    // ══════════════════════════════════════
    _isAnalyserUnlocked() {
        return (State.ch1Source === 'mic'  && State.isRunning) ||
               (State.ch1Source === 'file' && AudioLoader.hasCH1File);
    },

    _updateAnalyserLock() {
        const unlocked = this._isAnalyserUnlocked();

        const lockNotice      = document.getElementById('analyserLockNotice');
        const analyserContent = document.getElementById('analyserContent');
        if (lockNotice)      lockNotice.style.display      = unlocked ? 'none'  : 'block';
        if (analyserContent) analyserContent.style.display = unlocked ? 'block' : 'none';

        const bodeLock    = document.getElementById('bodeLockNotice');
        const bodeContent = document.getElementById('bodeContent');
        if (bodeLock)    bodeLock.style.display    = unlocked ? 'none'  : 'block';
        if (bodeContent) bodeContent.style.display = unlocked ? 'block' : 'none';

        const ch3Row = document.getElementById('ch3Row');
        if (ch3Row) {
            ch3Row.style.opacity       = unlocked ? '1'    : '0.4';
            ch3Row.style.pointerEvents = unlocked ? 'auto' : 'none';
        }

        if (!unlocked) App._analyseInterval = Infinity;
        else if (!isFinite(App._analyseInterval)) App._analyseInterval = 3000;
    },

    // ══════════════════════════════════════
    // ANALYSER PANEL DOM UPDATES
    // ══════════════════════════════════════
    updateAnalyserDisplay(result) {
        if (!result) return;

        if (result.hf && result.hf.magnitude) {
            this._drawAnalyserCurve(result.hf.magnitude, result.hf.bands);
        }

        const detected = result.detected || [];
        const map = {
            'HPF':       { val: 'det-hpf-val',    bar: 'det-hpf-bar',    pct: 'det-hpf-pct'    },
            'ROLLOFF':   { val: 'det-rolloff-val', bar: 'det-rolloff-bar',pct: 'det-rolloff-pct' },
            'AGC':       { val: 'det-agc-val',     bar: 'det-agc-bar',    pct: 'det-agc-pct'    },
            'HARD CLIP': { val: 'det-clip-val',    bar: 'det-clip-bar',   pct: 'det-clip-pct'   },
            'SOFT CLIP': { val: 'det-clip-val',    bar: 'det-clip-bar',   pct: 'det-clip-pct'   },
            'DC OFFSET': { val: 'det-dc-val',      bar: 'det-dc-bar',     pct: 'det-dc-pct'     },
        };

        detected.forEach(item => {
            const ids = map[item.label];
            if (!ids) return;
            const valEl = document.getElementById(ids.val);
            const barEl = document.getElementById(ids.bar);
            const pctEl = document.getElementById(ids.pct);
            if (valEl) valEl.innerText   = item.value;
            if (barEl) barEl.style.width = item.confidence + '%';
            if (pctEl) pctEl.innerText   = item.confidence + '%';
        });

        if (result.freq) {
            const snrEl = document.getElementById('det-snr-val');
            if (snrEl) snrEl.innerText = result.freq.snr + 'dB';
        }
    },

    _drawAnalyserCurve(magnitude, bands) {
        const curve = document.getElementById('analyserCurve');
        if (!curve || !magnitude || !bands) return;
        const w = 340, h = 56;
        const maxMag = Math.max(...magnitude, 0.001);
        let d = '';
        for (let b = 0; b < bands; b++) {
            const x = (b / (bands - 1)) * w;
            const y = h - (magnitude[b] / maxMag) * (h - 4) - 2;
            d += (b === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + Math.max(1, Math.min(h - 1, y)).toFixed(1);
        }
        curve.setAttribute('d', d);
    },

    // ══════════════════════════════════════
    // ANALYSER INTERVAL
    // ══════════════════════════════════════
    setAnalyserInterval(ms, btn) {
        App._analyseInterval = ms === 0 ? Infinity : ms;
        document.querySelectorAll('[data-interval]').forEach(b => {
            b.classList.toggle('active', b === btn);
        });
    },

    // ══════════════════════════════════════
    // CH3 CORRECTION REQUEST
    // ══════════════════════════════════════
    requestCH3Correction() {
        if (!this._isAnalyserUnlocked()) {
            alert('CH1 needs an active external source first.');
            return;
        }
        State.sim.ch3Enabled = true;
        State.ch3Data        = null;

        const pill = document.getElementById('pill3');
        if (pill) pill.classList.remove('off');

        const toggle = document.getElementById('ch3Toggle');
        if (toggle) {
            toggle.innerText         = 'ON';
            toggle.style.borderColor = '#00e5ff';
            toggle.style.color       = '#00e5ff';
            toggle.classList.add('on');
        }
        Persist.save();
    },

    // ══════════════════════════════════════
    // BODE SWEEP
    // ══════════════════════════════════════
    setBodeSweepStart(v) {
        State.bode.startHz = parseInt(v);
        const el = document.getElementById('bodeSweepStart');
        if (el) el.innerText = v + 'Hz';
        Persist.scheduleSave();
    },

    setBodeSweepStop(v) {
        State.bode.stopHz = parseInt(v);
        const el = document.getElementById('bodeSweepStop');
        if (el) el.innerText = parseInt(v) >= 1000 ? (v / 1000).toFixed(0) + 'kHz' : v + 'Hz';
        Persist.scheduleSave();
    },

    setBodeSteps(n, btn) {
        State.bode.steps = n;
        document.querySelectorAll('[data-steps]').forEach(b => {
            b.classList.toggle('active', b === btn);
        });
        Persist.scheduleSave();
    },

    async runBodeSweep() {
        if (!this._isAnalyserUnlocked()) {
            alert('Bode plotter needs CH1 active external source.');
            return;
        }
        const btn = document.getElementById('bodeRunBtn');
        if (btn) btn.innerText = '⏳ SWEEPING...';

        try {
            const result = await App.runBodeSweep(
                State.bode.startHz,
                State.bode.stopHz,
                State.bode.steps
            );

            if (!result || result.error) {
                if (btn) btn.innerText = '⚡ RUN SWEEP — SHOW ON SCOPE';
                alert('Sweep failed — ensure signal is playing.');
                return;
            }

            this._drawBodePanelCurves(result);
            const resGroup = document.getElementById('bodeResultsGroup');
            if (resGroup) resGroup.style.display = 'block';
            this._populateBodeResults(result.features || {});
            this._drawBodeZone(result);
            if (btn) btn.innerText = '⚡ RUN SWEEP — SHOW ON SCOPE';

        } catch (err) {
            console.error('Bode sweep error:', err);
            if (btn) btn.innerText = '⚡ RUN SWEEP — SHOW ON SCOPE';
        }
    },

    _drawBodePanelCurves(result) {
        if (!result.curve || result.curve.length < 2) return;
        const w = 340, h = 72;
        const curve   = result.curve;
        const dbs     = curve.map(p => p.magnitudeDb);
        const maxDb   = Math.max(...dbs,  3);
        const minDb   = Math.min(...dbs, -40);
        const dbRange = maxDb - minDb || 1;

        let magD = '', phaseD = '';
        curve.forEach((p, i) => {
            const x  = (i / (curve.length - 1)) * w;
            const yM = h - ((p.magnitudeDb - minDb) / dbRange) * (h - 4) - 2;
            const yP = (h / 2) - (p.phaseShiftDeg / 180) * (h / 2 - 4);
            magD   += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + Math.max(1, Math.min(h - 1, yM)).toFixed(1);
            phaseD += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + Math.max(1, Math.min(h - 1, yP)).toFixed(1);
        });

        const magEl   = document.getElementById('bodeMagCurve');
        const phaseEl = document.getElementById('bodePhaseCurve');
        if (magEl)   magEl.setAttribute('d',   magD);
        if (phaseEl) phaseEl.setAttribute('d', phaseD);

        if (result.features) {
            const f        = result.features;
            const logStart = Math.log10(State.bode.startHz || 20);
            const logStop  = Math.log10(State.bode.stopHz  || 20000);
            const logRange = logStop - logStart || 1;
            if (f.hpfCornerHz) {
                const x  = ((Math.log10(f.hpfCornerHz) - logStart) / logRange) * w;
                const el = document.getElementById('bodeHpfMarker');
                if (el) { el.setAttribute('x1', x); el.setAttribute('x2', x); el.style.display = ''; }
            }
            if (f.lpfCornerHz) {
                const x  = ((Math.log10(f.lpfCornerHz) - logStart) / logRange) * w;
                const el = document.getElementById('bodeLpfMarker');
                if (el) { el.setAttribute('x1', x); el.setAttribute('x2', x); el.style.display = ''; }
            }
        }
    },

    _populateBodeResults(f) {
        const set = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
        set('bodeResHpf',   f.hpfCornerHz           ? f.hpfCornerHz + 'Hz'                               : '---');
        set('bodeResLpf',   f.lpfCornerHz            ? f.lpfCornerHz + 'Hz'                               : '---');
        set('bodeResPhase', f.maxPhaseShiftDeg != null ? f.maxPhaseShiftDeg.toFixed(1) + '°'              : '---');
        set('bodeResSlope', f.rolloffSlopeDbOctave != null ? f.rolloffSlopeDbOctave.toFixed(1) + 'dB/oct' : '---');
        set('bodeResGain',  f.overallGainDb != null  ? f.overallGainDb.toFixed(2) + 'dB'                  : '---');
    },

    _drawBodeZone(result) {
        if (!result.curve || result.curve.length < 2) return;
        const w = 340, h = 52;
        const curve   = result.curve;
        const dbs     = curve.map(p => p.magnitudeDb);
        const maxDb   = Math.max(...dbs,  3);
        const minDb   = Math.min(...dbs, -40);
        const dbRange = maxDb - minDb || 1;

        let magD = '', phaseD = '';
        curve.forEach((p, i) => {
            const x  = (i / (curve.length - 1)) * w;
            const yM = h - ((p.magnitudeDb - minDb) / dbRange) * (h - 4) - 2;
            const yP = (h / 2) - (p.phaseShiftDeg / 180) * (h / 2 - 4);
            magD   += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + Math.max(1, Math.min(h - 1, yM)).toFixed(1);
            phaseD += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + Math.max(1, Math.min(h - 1, yP)).toFixed(1);
        });

        const magEl   = document.getElementById('bodeZoneMag');
        const phaseEl = document.getElementById('bodeZonePhase');
        if (magEl)   magEl.setAttribute('d',   magD);
        if (phaseEl) phaseEl.setAttribute('d', phaseD);

        const f   = result.features || {};
        const res = document.getElementById('bodeZoneResult');
        if (res) {
            const parts = [];
            if (f.hpfCornerHz) parts.push('HPF:' + f.hpfCornerHz + 'Hz');
            if (f.lpfCornerHz) parts.push('LPF:' + f.lpfCornerHz + 'Hz');
            res.innerText = parts.join(' | ') || '---';
        }

        const zone    = document.getElementById('bodeZone');
        const bodeBtn = document.getElementById('bodeRunBtn');
        if (zone) {
            const wasVisible = zone.classList.contains('show');
            zone.classList.toggle('show');
            if (bodeBtn) {
                bodeBtn.innerText = wasVisible
                    ? '⚡ RUN SWEEP — SHOW ON SCOPE'
                    : '⏹ HIDE BODE — RUN AGAIN TO TOGGLE';
            }
        }

        App.resize();
        this.toggleSimSetMenu();
    },

    // ══════════════════════════════════════
    // ARTIFACT CONTROLS
    // ══════════════════════════════════════
    setArtifact(key, value) {
        Artifacts.params[key] = parseFloat(value);
        const el = document.getElementById('art-' + key);
        if (!el) return;
        switch (key) {
            case 'dcOffset':  el.innerText = (value >= 0 ? '+' : '') + parseFloat(value).toFixed(2) + 'V'; break;
            case 'micBias':   el.innerText = parseFloat(value).toFixed(2) + 'V'; break;
            case 'hpfCorner': el.innerText = Math.round(parseFloat(value) * 300) + 'Hz'; break;
            case 'quantize': {
                const bits = Math.round(16 - parseFloat(value) * 12);
                el.innerText = bits + 'bit';
                break;
            }
            default: el.innerText = Math.round(parseFloat(value) * 100) + '%';
        }
        Persist.scheduleSave();
    },

    resetArtifacts() {
        Object.keys(Artifacts.params).forEach(k => { Artifacts.params[k] = 0; });
        document.querySelectorAll('#sspanel-artifacts input[type=range]').forEach(s => { s.value = 0; });
        const defaults = {
            'art-dcOffset': '0.00V', 'art-harmDistort': '0%',  'art-srcClip':    '0%',
            'art-acCouple': '0%',    'art-micBias':     '0.00V','art-asymClip':   '0%',
            'art-agcPumping':'0%',   'art-hpfCorner':   '0Hz',  'art-rolloff':    '0%',
            'art-noiseFloor':'0%',   'art-quantize':    '16bit',
        };
        Object.entries(defaults).forEach(([id, val]) => {
            const el = document.getElementById(id); if (el) el.innerText = val;
        });
        Persist.save();
    },

    // ══════════════════════════════════════
    // CHANNEL CONTROLS
    // ══════════════════════════════════════
    toggleChannel(ch) {
        if (ch === 1) {
            State.sim.ch1Enabled = !State.sim.ch1Enabled;
            const pill   = document.getElementById('pill1');
            const toggle = document.getElementById('ch1Toggle');
            if (pill)   pill.classList.toggle('off', !State.sim.ch1Enabled);
            if (toggle) { toggle.innerText = State.sim.ch1Enabled ? 'ON' : 'OFF'; toggle.classList.toggle('on', State.sim.ch1Enabled); }
        } else if (ch === 2) {
            State.sim.ch2Enabled = !State.sim.ch2Enabled;
            const pill   = document.getElementById('pill2');
            const toggle = document.getElementById('ch2Toggle');
            if (pill)   pill.classList.toggle('off', !State.sim.ch2Enabled);
            if (toggle) { toggle.innerText = State.sim.ch2Enabled ? 'ON' : 'OFF'; toggle.classList.toggle('on', State.sim.ch2Enabled); }
        } else if (ch === 3) {
            if (!this._isAnalyserUnlocked()) return;
            State.sim.ch3Enabled = !State.sim.ch3Enabled;
            const pill   = document.getElementById('pill3');
            const toggle = document.getElementById('ch3Toggle');
            if (pill)   pill.classList.toggle('off', !State.sim.ch3Enabled);
            if (toggle) { toggle.innerText = State.sim.ch3Enabled ? 'ON' : 'OFF'; toggle.classList.toggle('on', State.sim.ch3Enabled); }
        }
        Persist.save();
    },

    setCHGain(ch, value) {
        const v = parseFloat(value);
        if (ch === 1) {
            State.ch1Gain = v;
            const el = document.getElementById('ch1GainVal');
            if (el) el.innerText = v.toFixed(1) + 'x';
        } else {
            State.ch2Gain = v;
            const el = document.getElementById('ch2GainVal');
            if (el) el.innerText = v.toFixed(1) + 'x';
        }
        Persist.scheduleSave();
    },

    setCH2Offset(value) {
        State.ch2Offset = parseInt(value);
        const el = document.getElementById('ch2OffsetVal');
        if (el) el.innerText = (value > 0 ? '+' : '') + value + 'px';
        Persist.scheduleSave();
    },

    // ══════════════════════════════════════
    // SIM CONTROLS
    // ══════════════════════════════════════
    setSimWave(type) {
        State.sim.waveType  = type;
        State.sim.phase_acc = 0;
        document.querySelectorAll('.wave-btn, .ss-wavebtn').forEach(b => {
            b.classList.toggle('active', b.dataset.wave === type);
        });
        const dutyRow = document.getElementById('dutyRow');
        if (dutyRow) dutyRow.style.display = (type === 'pwm' || type === 'square') ? 'flex' : 'none';
        Persist.scheduleSave();
    },

    setSimFreq(val) {
        State.sim.frequency = parseFloat(val);
        const label = val >= 1000 ? (val / 1000).toFixed(2) + 'kHz' : Math.round(val) + 'Hz';
        ['simFreqVal','simFreqValMenu'].forEach(id => { const el = document.getElementById(id); if (el) el.innerText = label; });
        Persist.scheduleSave();
    },

    setSimAmp(val) {
        State.sim.amplitude = parseFloat(val);
        const label = parseFloat(val).toFixed(2);
        ['simAmpVal','simAmpValMenu'].forEach(id => { const el = document.getElementById(id); if (el) el.innerText = label; });
        Persist.scheduleSave();
    },

    setSimPhase(val) {
        State.sim.phase = parseFloat(val);
        const label = Math.round(val) + '°';
        ['simPhaseVal','simPhaseValMenu'].forEach(id => { const el = document.getElementById(id); if (el) el.innerText = label; });
        Persist.scheduleSave();
    },

    setSimDuty(val) {
        State.sim.dutyCycle = parseFloat(val) / 100;
        const label = Math.round(val) + '%';
        ['simDutyVal','simDutyValMenu'].forEach(id => { const el = document.getElementById(id); if (el) el.innerText = label; });
        Persist.scheduleSave();
    },

    setSimFileGain(val) {
        State.sim.amplitude = parseFloat(val);
        const el = document.getElementById('simFileGainVal');
        if (el) el.innerText = parseFloat(val).toFixed(2) + 'x';
        Persist.scheduleSave();
    },

    setSimSampleRate(sr, btn) {
        State.simSampleRate = sr;
        document.querySelectorAll('[data-sr]').forEach(b => {
            b.classList.toggle('active', b === btn);
        });
        if (State.simMode && State.dataArray) {
            State.dataArray = new Uint8Array(State.fftSize);
            State.freqArray = new Uint8Array(State.fftSize / 2);
            State.ch2Data   = null;
            State.ch3Data   = null;
        }
        Persist.scheduleSave();
    },

    setSimSource(src) { this.setCH2Source(src); },

    toggleSimPlay() {
        State.sim.playing = !State.sim.playing;
        const btn = document.getElementById('simPlayBtn');
        if (btn) {
            btn.innerText = State.sim.playing ? '⏸ PAUSE' : '▶ PLAY';
            btn.className = State.sim.playing ? 'btn-primary' : 'btn-secondary';
        }
        Persist.scheduleSave();
    },

    // STOP button removed — kept as noop alias in case anything calls it
    stopSim() {
        State.sim.playing   = false;
        State.sim.phase_acc = 0;
        const btn = document.getElementById('simPlayBtn');
        if (btn) { btn.innerText = '▶ PLAY'; btn.className = 'btn-secondary'; }
        Persist.scheduleSave();
    },

    toggleCH2Source() {},

    // ══════════════════════════════════════
    // CHEVRON
    // ══════════════════════════════════════
    toggleSimChevron() {
        const content = document.getElementById('simChevronContent');
        const strip   = document.getElementById('simCollapsedStrip');
        const chevron = document.getElementById('simChevronIcon');
        const expanded = content && content.style.display !== 'none';
        if (content) content.style.display = expanded ? 'none' : 'flex';
        if (strip)   strip.style.display   = expanded ? 'flex' : 'none';
        if (chevron) chevron.innerText      = expanded ? '∨'   : '∧';
        App.resize();
    },

    // ══════════════════════════════════════
    // EXISTING CONTROLS
    // ══════════════════════════════════════
    togglePause() {
        State.paused = !State.paused;
        const btn = document.getElementById('pauseBtn');
        btn.innerText = State.paused ? '▶ RESUME' : '⏸ PAUSE';
        btn.className = State.paused ? 'btn-secondary' : 'btn-primary';
        document.getElementById('statusTxt').innerText = State.paused ? 'PAUSED' : 'LIVE';
        if (State.paused) document.getElementById('statusDot').classList.remove('active');
        else              document.getElementById('statusDot').classList.add('active');
    },

    updateZoom(v) {
        State.zoom = parseFloat(v);
        document.getElementById('zoomVal').innerText = State.zoom.toFixed(1) + 'x';
        Persist.scheduleSave();
    },

    updateGain(v) {
        State.gain = parseFloat(v);
        document.getElementById('gainVal').innerText = State.gain.toFixed(1) + 'x';
        Persist.scheduleSave();
    },

    updateSmoothing(v) {
        State.smoothing = parseFloat(v);
        if (State.analyser) State.analyser.smoothingTimeConstant = State.smoothing;
        document.getElementById('smoothVal').innerText = State.smoothing.toFixed(2);
        Persist.scheduleSave();
    },

    adjustFFTSize(dir) {
        const sizes = [512, 1024, 2048, 4096, 8192];
        let idx = sizes.indexOf(State.fftSize);
        idx = Math.max(0, Math.min(sizes.length - 1, idx + dir));
        State.fftSize = sizes[idx];
        document.getElementById('fftSizeVal').innerText = State.fftSize;
        if (State.analyser) {
            State.analyser.fftSize = State.fftSize;
            State.dataArray = new Uint8Array(State.analyser.fftSize);
            State.freqArray = new Uint8Array(State.analyser.frequencyBinCount);
            const bFft = document.getElementById('bFftSize');
            if (bFft) bFft.innerText = State.fftSize;
            const bRes = document.getElementById('bFreqRes');
            if (bRes && State.audioCtx)
                bRes.innerText = (State.audioCtx.sampleRate / State.fftSize).toFixed(2) + 'Hz';
        }
        Persist.scheduleSave();
    },

    adjustTimeDiv(dir) {
        if (State.timeDivIndex === null)
            State.timeDivIndex = Math.floor(TIME_DIV_STEPS.length / 2);
        State.timeDivIndex = Math.max(0, Math.min(TIME_DIV_STEPS.length - 1, State.timeDivIndex + dir));
        const ms    = TIME_DIV_STEPS[State.timeDivIndex];
        const label = ms >= 1 ? ms.toFixed(0) + 'ms' : (ms * 1000).toFixed(0) + 'µs';
        document.getElementById('timeDivVal').innerText = label;
        const menu = document.getElementById('timeDivValMenu');
        if (menu) menu.innerText = label;
        const sr = State.simMode ? State.simSampleRate : (State.audioCtx ? State.audioCtx.sampleRate : null);
        if (sr && State.dataArray) {
            const spd  = (ms / 1000) * sr;
            State.zoom = Math.max(1, Math.min(8, State.dataArray.length / (spd * 10)));
            document.getElementById('zoomSlider').value  = State.zoom;
            document.getElementById('zoomVal').innerText = State.zoom.toFixed(1) + 'x';
        }
        Persist.scheduleSave();
    },

    adjustVoltDiv(dir) {
        if (State.voltDivIndex === null)
            State.voltDivIndex = Math.floor(VOLT_DIV_STEPS.length / 2);
        State.voltDivIndex = Math.max(0, Math.min(VOLT_DIV_STEPS.length - 1, State.voltDivIndex + dir));
        const v     = VOLT_DIV_STEPS[State.voltDivIndex];
        const label = v.toFixed(2) + 'V';
        document.getElementById('voltDivVal').innerText = label;
        const menu = document.getElementById('voltDivValMenu');
        if (menu) menu.innerText = label;
        const maxIdx = VOLT_DIV_STEPS.length - 1;
        State.gain = 10 - (State.voltDivIndex / maxIdx) * 9;
        document.getElementById('gainSlider').value  = State.gain;
        document.getElementById('gainVal').innerText = State.gain.toFixed(1) + 'x';
        Persist.scheduleSave();
    },

    captureSnapshot() {
        const canvas = document.getElementById('scopeCanvas');
        const link   = document.createElement('a');
        link.download = `labscope_${Date.now()}.png`;
        link.href     = canvas.toDataURL('image/png');
        link.click();
    },

    // ══════════════════════════════════════
    // THEME
    // ══════════════════════════════════════
    setTheme(theme) {
        State.theme = 'dark';
        document.documentElement.setAttribute('data-theme', 'dark');
        document.querySelectorAll('.theme-btn[data-theme]').forEach(b => {
            b.classList.toggle('active', b.dataset.theme === 'dark');
        });
    },

    setWaveColor(color) {
        State.waveColor = color;
        this._swatch('wave', color);
        Persist.scheduleSave();
    },

    setGridColor(color) {
        State.gridColor = color;
        this._swatch('grid', color);
        Persist.scheduleSave();
    },

    setMeasColor(color) {
        State.measColor = color;
        document.documentElement.style.setProperty('--amber', color);
        this._swatch('meas', color);
        Persist.scheduleSave();
    },

    setSettingsTextColor(color) {
        State.settingsTextColor = color;
        document.documentElement.style.setProperty('--text-mid',  color);
        document.documentElement.style.setProperty('--text-main', color);
        this._swatch('settings-text', color);
        Persist.scheduleSave();
    },

    setSettingsFont(font) {
        State.settingsFont = font;
        const sideMenu = document.getElementById('sideMenu');
        if (sideMenu) sideMenu.style.fontFamily = FONT_MAP[font] || FONT_MAP.retro;
        this._font('settings-font', font);
        Persist.scheduleSave();
    },

    setSettingsFontSize(v) {
        State.settingsFontSize = parseInt(v);
        document.documentElement.style.setProperty('--settings-fs', (15 * State.settingsFontSize / 100) + 'px');
        const el = document.getElementById('settingsSizeVal');
        if (el) el.innerText = v + '%';
        Persist.scheduleSave();
    },

    setScopeTextColor(color) {
        State.scopeTextColor = color;
        document.documentElement.style.setProperty('--neon',      color);
        document.documentElement.style.setProperty('--neon-glow', color + '55');
        this._swatch('scope-text', color);
        Persist.scheduleSave();
    },

    setScopeFont(font) {
        State.scopeFont = font;
        document.documentElement.style.setProperty('--font-display', FONT_MAP[font] || FONT_MAP.retro);
        document.documentElement.style.setProperty('--font-scope',   FONT_MAP[font] || FONT_MAP.retro);
        this._font('scope-font', font);
        Persist.scheduleSave();
    },

    setScopeFontSize(v) {
        State.scopeFontSize = parseInt(v);
        document.documentElement.style.setProperty('--scope-fs', (15 * State.scopeFontSize / 100) + 'px');
        const el = document.getElementById('scopeSizeVal');
        if (el) el.innerText = v + '%';
        Persist.scheduleSave();
    },

    setInfoTextColor(color) {
        State.infoTextColor = color;
        this._swatch('info-text', color);
        Persist.scheduleSave();
    },

    setInfoFont(font) {
        State.infoFont = font;
        document.documentElement.style.setProperty('--font-data', FONT_MAP[font] || FONT_MAP.mono);
        this._font('info-font', font);
        Persist.scheduleSave();
    },

    setInfoFontSize(v) {
        State.infoFontSize = parseInt(v);
        const el = document.getElementById('infoSizeVal');
        if (el) el.innerText = v + '%';
        Persist.scheduleSave();
    },

    _swatch(group, value) {
        document.querySelectorAll(`.swatch-btn[data-group="${group}"]`).forEach(b => {
            b.classList.toggle('active', b.dataset.color === value);
        });
    },

    _font(group, value) {
        document.querySelectorAll(`.font-pick-btn[data-group="${group}"]`).forEach(b => {
            b.classList.toggle('active', b.dataset.font === value);
        });
    },
};
