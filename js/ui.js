// ── UI.JS v1.3.3 — swatch fix, SIM exit, analyser lock fix, async bode ──
const UI = {

    _bodeRunning: false,

    toggleMenu() {
        document.getElementById('sideMenu').classList.toggle('open');
        document.getElementById('menuOverlay').classList.toggle('open');
    },

    switchMenuTab(tab) {
        document.querySelectorAll('.mtab').forEach(t => t.classList.toggle('active', t.dataset.mtab === tab));
        document.querySelectorAll('.mpanel').forEach(p => p.classList.toggle('active', p.id === 'mpanel-' + tab));
    },

    toggleSimSetMenu() {
        const overlay = document.getElementById('simSetOverlay');
        const menu    = document.getElementById('simSetMenu');
        const opening = !menu.classList.contains('open');
        overlay.classList.toggle('open');
        menu.classList.toggle('open');
        if (opening) this._updateAnalyserLock();
    },

    switchSimSetTab(tab) {
        document.querySelectorAll('.sstab').forEach(t => t.classList.toggle('active', t.dataset.sstab === tab));
        document.querySelectorAll('.sspanel').forEach(p => p.classList.toggle('active', p.id === 'sspanel-' + tab));
    },

    switchTab(tab) {
        State.currentTab = tab;
        document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));

        const simOnly = tab === 'sim';

        // ── EXIT SIM MODE when switching away from SIM ──
        if (!simOnly && State.simMode) {
            this._exitSimMode();
        }

        const chPills = document.getElementById('chPills');
        const micBar  = document.getElementById('micBar');
        const simWrap = document.getElementById('simChevronWrap');
        if (chPills) chPills.classList.toggle('visible', simOnly);
        if (micBar)  micBar.classList.toggle('visible',  simOnly);
        if (simWrap) simWrap.classList.toggle('visible',  simOnly);

        const simBtns  = document.getElementById('simBtns');
        const mainBtns = document.getElementById('mainBtns');
        if (simBtns)  simBtns.style.display  = simOnly ? ''     : 'none';
        if (mainBtns) mainBtns.style.display = simOnly ? 'none' : '';

        if (simOnly && !State.simMode) this._enterSimMode();

        const oscPills = document.getElementById('oscPills');
        if (oscPills) oscPills.classList.toggle('visible', !simOnly && State.simMode);

        this._syncPlayPauseButtons();
        App.resize();
        Persist.save();
    },

    setOscView(ch) {
        State.oscViewChannel = ch;
        ['1','2','3'].forEach(n => {
            const el = document.getElementById('oscPill' + n);
            if (el) el.classList.toggle('active', 'ch' + n === ch);
        });
        Persist.scheduleSave();
    },

    _enterSimMode() {
        State.simMode = true;
        if (!State.dataArray) { State.dataArray = new Uint8Array(State.fftSize); State.freqArray = new Uint8Array(State.fftSize / 2); }
        if (!State.ch2Data) State.ch2Data = new Uint8Array(State.fftSize);

        const dot = document.getElementById('statusDot');
        if (dot) { dot.classList.remove('active'); dot.classList.add('sim'); }
        document.getElementById('statusTxt').innerText = 'SIM';

        App.initMicStream();
        App.startLoop();
        this._syncPlayPauseButtons();
        this._updateAnalyserLock();
    },

    _exitSimMode() {
        State.simMode     = false;
        State.sim.playing = false;
        App.stopLoop();

        // Reset SIM-specific UI
        const oscPills = document.getElementById('oscPills');
        if (oscPills) oscPills.classList.remove('visible');
        const chPills = document.getElementById('chPills');
        if (chPills) chPills.classList.remove('visible');
        const micBar = document.getElementById('micBar');
        if (micBar) micBar.classList.remove('visible');
        const simWrap = document.getElementById('simChevronWrap');
        if (simWrap) simWrap.classList.remove('visible');
        const simBtns = document.getElementById('simBtns');
        if (simBtns) simBtns.style.display = 'none';
        const mainBtns = document.getElementById('mainBtns');
        if (mainBtns) mainBtns.style.display = '';

        const dot = document.getElementById('statusDot');
        if (dot) dot.classList.remove('sim');

        if (State.isRunning) {
            document.getElementById('statusTxt').innerText = 'LIVE';
            if (dot) dot.classList.add('active');
            App.startLoop();
        } else {
            document.getElementById('statusTxt').innerText = 'STANDBY';
            const pauseBtn = document.getElementById('pauseBtn');
            if (pauseBtn) { pauseBtn.disabled = true; pauseBtn.innerText = '⏸ PAUSE'; pauseBtn.className = 'btn-primary'; }
            App.drawIdle();
        }
    },

    exitSimMode() { this._exitSimMode(); this.switchTab('osc'); },

    toggleCH1Source() { this.setCH1Source(State.ch1Source === 'mic' ? 'file' : 'mic'); },

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
        this._updateCH1Status(); this._updateAnalyserLock(); Persist.save();
    },

    _updateCH1Status() {
        const el = document.getElementById('ch1SourceStatus');
        if (!el) return;
        if (State.ch1Source === 'mic') { el.style.color = '#00ff41'; el.innerText = '● MIC LIVE'; }
        else if (AudioLoader.hasCH1File) { el.style.color = '#00ff41'; el.innerText = '● FILE LOADED'; }
        else { el.style.color = '#ffb300'; el.innerText = '● NO FILE'; }
    },

    loadCH1File() { const p = document.getElementById('ch1FilePicker'); if (p) p.click(); },

    async onCH1FileSelected(input) {
        if (!input.files || !input.files[0]) return;
        const file = input.files[0];
        const nameEl = document.getElementById('ch1FileName');
        if (nameEl) { nameEl.innerText = file.name; nameEl.style.color = '#00e5ff'; }
        await AudioLoader.loadFileCH1(file);
        this._updateCH1Status(); this._updateAnalyserLock(); Persist.save();
    },

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
        this._updateCH2Status(); Persist.save();
    },

    _updateCH2Status() {
        const el = document.getElementById('ch2SourceStatus');
        if (!el) return;
        if (State.ch2Source === 'synth') { el.style.color = '#e040fb'; el.innerText = '● SYNTH'; }
        else if (AudioLoader.hasFile)    { el.style.color = '#00ff41'; el.innerText = '● FILE LOADED'; }
        else                             { el.style.color = '#ffb300'; el.innerText = '● NO FILE'; }
    },

    loadCH2File() { const p = document.getElementById('ch2FilePicker'); if (p) p.click(); },

    async onCH2FileSelected(input) {
        if (!input.files || !input.files[0]) return;
        const file = input.files[0];
        ['simFileName','ch2FileName'].forEach(id => {
            const el = document.getElementById(id);
            if (el) { el.innerText = file.name; el.classList.remove('empty'); el.style.color = '#00e5ff'; }
        });
        await AudioLoader.loadFile(file);
        this._updateCH2Status();
        const infoEl = document.getElementById('simFileInfo');
        if (infoEl) { infoEl.innerText = 'loaded'; infoEl.style.color = '#00ff41'; infoEl.className = 'sim-rec-timer'; }
        Persist.save();
    },

    loadSimFileCH2()         { this.loadCH2File(); },
    loadSimFile()            { this.loadCH2File(); },
    onSimFileSelected(input) { this.onCH2FileSelected(input); },

    // ── FIX: unlock when SIM mode has mic analyser active ──
    _isAnalyserUnlocked() {
        return (State.ch1Source === 'mic' && (State.isRunning || (State.simMode && !!App._micAnalyser))) ||
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
        if (ch3Row) { ch3Row.style.opacity = unlocked ? '1' : '0.4'; ch3Row.style.pointerEvents = unlocked ? 'auto' : 'none'; }
        if (!unlocked) App._analyseInterval = Infinity;
        else if (!isFinite(App._analyseInterval)) App._analyseInterval = 3000;
    },

    updateAnalyserDisplay(result) {
        if (!result) return;
        if (result.hf && result.hf.magnitude) this._drawAnalyserCurve(result.hf.magnitude, result.hf.bands);
        const detected = result.detected || [];
        const map = {
            'HPF':       { val:'det-hpf-val',    bar:'det-hpf-bar',    pct:'det-hpf-pct' },
            'ROLLOFF':   { val:'det-rolloff-val', bar:'det-rolloff-bar', pct:'det-rolloff-pct' },
            'AGC':       { val:'det-agc-val',     bar:'det-agc-bar',    pct:'det-agc-pct' },
            'HARD CLIP': { val:'det-clip-val',    bar:'det-clip-bar',   pct:'det-clip-pct' },
            'SOFT CLIP': { val:'det-clip-val',    bar:'det-clip-bar',   pct:'det-clip-pct' },
            'DC OFFSET': { val:'det-dc-val',      bar:'det-dc-bar',     pct:'det-dc-pct' },
        };
        detected.forEach(item => {
            const ids = map[item.label]; if (!ids) return;
            const valEl = document.getElementById(ids.val);
            const barEl = document.getElementById(ids.bar);
            const pctEl = document.getElementById(ids.pct);
            if (valEl) valEl.innerText   = item.value;
            if (barEl) barEl.style.width = (item.barValue ?? item.confidence) + '%';
            if (pctEl) pctEl.innerText   = item.confidence + '%';
        });
        const detectedLabels = new Set(detected.map(d => d.label));
        ['HPF','ROLLOFF','AGC','HARD CLIP','SOFT CLIP','DC OFFSET'].forEach(lbl => {
            if (!detectedLabels.has(lbl)) {
                const ids = map[lbl]; if (!ids) return;
                const valEl = document.getElementById(ids.val);
                const barEl = document.getElementById(ids.bar);
                const pctEl = document.getElementById(ids.pct);
                if (valEl) valEl.innerText   = '---';
                if (barEl) barEl.style.width = '0%';
                if (pctEl) pctEl.innerText   = '--%';
            }
        });
        if (result.freq) { const snrEl = document.getElementById('det-snr-val'); if (snrEl) snrEl.innerText = result.freq.snr + 'dB'; }
    },

    // ── FIX: safe max without spread (avoids stack overflow on large arrays) ──
    _drawAnalyserCurve(magnitude, bands) {
        const curve = document.getElementById('analyserCurve');
        if (!curve || !magnitude || !bands) return;
        const w = 340, h = 56;
        let maxMag = 0.001;
        for (let b = 0; b < bands; b++) if (magnitude[b] > maxMag) maxMag = magnitude[b];
        let d = '';
        for (let b = 0; b < bands; b++) {
            const x = (b / (bands - 1)) * w;
            const y = h - (magnitude[b] / maxMag) * (h - 4) - 2;
            d += (b === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + Math.max(1, Math.min(h - 1, y)).toFixed(1);
        }
        curve.setAttribute('d', d);
    },

    setAnalyserInterval(ms, btn) {
        App._analyseInterval = ms === 0 ? Infinity : ms;
        document.querySelectorAll('[data-interval]').forEach(b => b.classList.toggle('active', b === btn));
    },

    requestCH3Correction() {
        if (!this._isAnalyserUnlocked()) { alert('CH1 needs an active external source first.'); return; }
        if (!State.analyserResult) { alert('Run the analyser first (⚡ RUN NOW) before requesting CH3 correction.'); return; }
        State.sim.ch3Enabled = true; State.ch3Data = null;
        const pill = document.getElementById('pill3'); if (pill) pill.classList.remove('off');
        const toggle = document.getElementById('ch3Toggle');
        if (toggle) { toggle.innerText = 'ON'; toggle.style.borderColor = '#00e5ff'; toggle.style.color = '#00e5ff'; toggle.classList.add('on'); }
        const ch3Row = document.getElementById('ch3Row');
        if (ch3Row) { ch3Row.style.opacity = '1'; }
        Persist.save();
    },

    setBodeSweepStart(v) { State.bode.startHz = parseInt(v); const el = document.getElementById('bodeSweepStart'); if (el) el.innerText = v + 'Hz'; Persist.scheduleSave(); },
    setBodeSweepStop(v)  { State.bode.stopHz  = parseInt(v); const el = document.getElementById('bodeSweepStop');  if (el) el.innerText = parseInt(v) >= 1000 ? (v/1000).toFixed(0)+'kHz' : v+'Hz'; Persist.scheduleSave(); },

    setBodeSteps(n, btn) {
        State.bode.steps = n;
        document.querySelectorAll('[data-steps]').forEach(b => b.classList.toggle('active', b === btn));
        Persist.scheduleSave();
    },

    // ══════════════════════════════════════
    // ASYNC BODE SWEEP — realtime SVG drawing
    // ══════════════════════════════════════
    async runBodeSweep() {
        if (!this._isAnalyserUnlocked()) { alert('Bode plotter needs CH1 active external source.'); return; }
        if (this._bodeRunning) return;
        this._bodeRunning = true;

        const btn = document.getElementById('bodeRunBtn');
        if (btn) btn.innerText = '⏳ SWEEPING...';

        const sr       = State.simMode ? State.simSampleRate : (State.audioCtx ? State.audioCtx.sampleRate : 44100);
        const startHz  = State.bode.startHz  || 20;
        const stopHz   = State.bode.stopHz   || 20000;
        const steps    = Math.min(State.bode.steps || 50, 50);
        const logStart = Math.log10(startHz);
        const logStop  = Math.log10(stopHz);

        // Clear SVG paths first
        const svgMag   = document.getElementById('bodeMagCurve');
        const svgPhase = document.getElementById('bodePhaseCurve');
        if (svgMag)   svgMag.setAttribute('d', '');
        if (svgPhase) svgPhase.setAttribute('d', '');

        const curve = [];
        let magD = '', phaseD = '';
        const w = 340, h = 140;

        try {
            for (let s = 0; s < steps; s++) {
                const freqHz  = Math.pow(10, logStart + (logStop - logStart) * s / (steps - 1));
                // Snapshot current buffers
                const ch1Snap = State.dataArray ? new Uint8Array(State.dataArray) : new Uint8Array(State.fftSize).fill(128);
                const ch2Snap = State.ch2Data   ? new Uint8Array(State.ch2Data)   : ch1Snap;
                const point   = dspBodePoint(ch1Snap, ch2Snap, freqHz, sr);

                if (point) {
                    curve.push(point);

                    // Recompute y scale from all points so far
                    let minDb = 0, maxDb = 0;
                    for (const p of curve) {
                        if (p.magnitudeDb < minDb) minDb = p.magnitudeDb;
                        if (p.magnitudeDb > maxDb) maxDb = p.magnitudeDb;
                    }
                    minDb = Math.min(minDb, -3);
                    maxDb = Math.max(maxDb, 3);
                    const dbRange = maxDb - minDb || 1;

                    // Rebuild full path so scaling stays consistent
                    magD   = '';
                    phaseD = '';
                    for (let i = 0; i < curve.length; i++) {
                        const p  = curve[i];
                        const px = (i / (steps - 1)) * w;
                        const py = h - ((p.magnitudeDb - minDb) / dbRange) * (h - 4) - 2;
                        const pp = (h / 2) - (p.phaseShiftDeg / 180) * (h / 2 - 4);
                        magD   += (i === 0 ? 'M' : 'L') + px.toFixed(1) + ',' + Math.max(1, Math.min(h - 1, py)).toFixed(1);
                        phaseD += (i === 0 ? 'M' : 'L') + px.toFixed(1) + ',' + Math.max(1, Math.min(h - 1, pp)).toFixed(1);
                    }
                    if (svgMag)   svgMag.setAttribute('d', magD);
                    if (svgPhase) svgPhase.setAttribute('d', phaseD);
                }

                // ── YIELD to browser so it can paint ──
                await new Promise(r => requestAnimationFrame(r));
            }

            // Final result
            if (curve.length >= 2) {
                const features = this._analyseBodeCurve(curve);
                const result   = { curve, features, steps: curve.length };
                const resGroup = document.getElementById('bodeResultsGroup');
                if (resGroup) resGroup.style.display = 'block';
                this._populateBodeResults(features);
                this._drawBodeZone(result);
                if (btn) btn.innerText = '⚡ RUN SWEEP — SHOW ON SCOPE';
            } else {
                if (btn) btn.innerText = '⚡ RUN SWEEP — SHOW ON SCOPE';
                alert('Sweep failed — ensure signal is playing.');
            }
        } catch(err) {
            console.error('Bode sweep error:', err);
            if (btn) btn.innerText = '⚡ RUN SWEEP — SHOW ON SCOPE';
        }
        this._bodeRunning = false;
    },

    _analyseBodeCurve(curve) {
        if (!curve || curve.length < 3) return {};
        const midStart = Math.floor(curve.length * 0.3);
        const midEnd   = Math.floor(curve.length * 0.7);
        let flatDb = 0, flatCount = 0;
        for (let i = midStart; i < midEnd; i++) { flatDb += curve[i].magnitudeDb; flatCount++; }
        const refDb = flatCount > 0 ? flatDb / flatCount : 0;
        let hpfCornerHz = null;
        for (let i = 0; i < curve.length; i++) {
            if (curve[i].magnitudeDb >= refDb - 3) { hpfCornerHz = Math.round(curve[i].freqHz); break; }
        }
        let lpfCornerHz = null;
        for (let i = curve.length - 1; i >= 0; i--) {
            if (curve[i].magnitudeDb >= refDb - 3) { lpfCornerHz = Math.round(curve[i].freqHz); break; }
        }
        let maxPhase = 0;
        curve.forEach(p => { if (Math.abs(p.phaseShiftDeg) > Math.abs(maxPhase)) maxPhase = p.phaseShiftDeg; });
        let rolloffSlope = 0;
        if (curve.length >= 4) {
            const last = curve[curve.length - 1], prev = curve[curve.length - 4];
            const octs = Math.log2(last.freqHz / prev.freqHz);
            rolloffSlope = octs > 0 ? parseFloat(((last.magnitudeDb - prev.magnitudeDb) / octs).toFixed(1)) : 0;
        }
        return { hpfCornerHz, lpfCornerHz, overallGainDb: parseFloat(refDb.toFixed(2)), maxPhaseShiftDeg: parseFloat(maxPhase.toFixed(2)), rolloffSlopeDbOctave: rolloffSlope };
    },

    _populateBodeResults(f) {
        const set = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
        set('bodeResHpf',   f.hpfCornerHz            ? f.hpfCornerHz + 'Hz'                               : '---');
        set('bodeResLpf',   f.lpfCornerHz             ? f.lpfCornerHz + 'Hz'                               : '---');
        set('bodeResPhase', f.maxPhaseShiftDeg != null ? f.maxPhaseShiftDeg.toFixed(1) + '°'              : '---');
        set('bodeResSlope', f.rolloffSlopeDbOctave != null ? f.rolloffSlopeDbOctave.toFixed(1) + 'dB/oct' : '---');
        set('bodeResGain',  f.overallGainDb != null   ? f.overallGainDb.toFixed(2) + 'dB'                 : '---');
    },

    _drawBodePanelCurves(result) {
        if (!result.curve || result.curve.length < 2) return;
        const w = 340, h = 140, curve = result.curve;
        const dbs = curve.map(p => p.magnitudeDb);
        let maxDb = 3, minDb = -40;
        for (const d of dbs) { if (d > maxDb) maxDb = d; if (d < minDb) minDb = d; }
        const dbRange = maxDb - minDb || 1;
        let magD = '', phaseD = '';
        curve.forEach((p, i) => {
            const x  = (i / (curve.length - 1)) * w;
            const yM = h - ((p.magnitudeDb - minDb) / dbRange) * (h - 4) - 2;
            const yP = (h / 2) - (p.phaseShiftDeg / 180) * (h / 2 - 4);
            magD   += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + Math.max(1, Math.min(h-1, yM)).toFixed(1);
            phaseD += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + Math.max(1, Math.min(h-1, yP)).toFixed(1);
        });
        const magEl = document.getElementById('bodeMagCurve'); if (magEl) magEl.setAttribute('d', magD);
        const phaseEl = document.getElementById('bodePhaseCurve'); if (phaseEl) phaseEl.setAttribute('d', phaseD);
        if (result.features) {
            const f = result.features;
            const logStart = Math.log10(State.bode.startHz || 20), logStop = Math.log10(State.bode.stopHz || 20000), logRange = logStop - logStart || 1;
            if (f.hpfCornerHz) { const x = ((Math.log10(f.hpfCornerHz) - logStart) / logRange) * w; const el = document.getElementById('bodeHpfMarker'); if (el) { el.setAttribute('x1', x); el.setAttribute('x2', x); el.style.display = ''; } }
            if (f.lpfCornerHz) { const x = ((Math.log10(f.lpfCornerHz) - logStart) / logRange) * w; const el = document.getElementById('bodeLpfMarker'); if (el) { el.setAttribute('x1', x); el.setAttribute('x2', x); el.style.display = ''; } }
        }
    },

    _drawBodeZone(result) {
        if (!result.curve || result.curve.length < 2) return;
        const w = 340, h = 70, curve = result.curve;
        let maxDb = 3, minDb = -40;
        curve.forEach(p => { if (p.magnitudeDb > maxDb) maxDb = p.magnitudeDb; if (p.magnitudeDb < minDb) minDb = p.magnitudeDb; });
        const dbRange = maxDb - minDb || 1;
        let magD = '', phaseD = '';
        curve.forEach((p, i) => {
            const x  = (i / (curve.length - 1)) * w;
            const yM = h - ((p.magnitudeDb - minDb) / dbRange) * (h - 4) - 2;
            const yP = (h / 2) - (p.phaseShiftDeg / 180) * (h / 2 - 4);
            magD   += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + Math.max(1, Math.min(h-1, yM)).toFixed(1);
            phaseD += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + Math.max(1, Math.min(h-1, yP)).toFixed(1);
        });
        const magEl = document.getElementById('bodeZoneMag'); if (magEl) magEl.setAttribute('d', magD);
        const phaseEl = document.getElementById('bodeZonePhase'); if (phaseEl) phaseEl.setAttribute('d', phaseD);
        const f = result.features || {};
        const res = document.getElementById('bodeZoneResult');
        if (res) { const parts = []; if (f.hpfCornerHz) parts.push('HPF:'+f.hpfCornerHz+'Hz'); if (f.lpfCornerHz) parts.push('LPF:'+f.lpfCornerHz+'Hz'); res.innerText = parts.join(' | ') || '---'; }
        const zone = document.getElementById('bodeZone');
        if (zone) zone.classList.add('show');
        App.resize();
    },

    setArtifact(key, value) {
        Artifacts.params[key] = parseFloat(value);
        const el = document.getElementById('art-' + key); if (!el) return;
        switch (key) {
            case 'dcOffset':  el.innerText = (value >= 0 ? '+' : '') + parseFloat(value).toFixed(2) + 'V'; break;
            case 'micBias':   el.innerText = parseFloat(value).toFixed(2) + 'V'; break;
            case 'hpfCorner': el.innerText = Math.round(parseFloat(value) * 300) + 'Hz'; break;
            case 'quantize':  el.innerText = Math.round(16 - parseFloat(value) * 12) + 'bit'; break;
            default:          el.innerText = Math.round(parseFloat(value) * 100) + '%';
        }
        Persist.scheduleSave();
    },

    resetArtifacts() {
        Object.keys(Artifacts.params).forEach(k => { Artifacts.params[k] = 0; });
        document.querySelectorAll('#sspanel-artifacts input[type=range]').forEach(s => { s.value = 0; });
        const defaults = { 'art-dcOffset':'0.00V','art-harmDistort':'0%','art-srcClip':'0%','art-acCouple':'0%','art-micBias':'0.00V','art-asymClip':'0%','art-agcPumping':'0%','art-hpfCorner':'0Hz','art-rolloff':'0%','art-noiseFloor':'0%','art-quantize':'16bit' };
        Object.entries(defaults).forEach(([id, val]) => { const el = document.getElementById(id); if (el) el.innerText = val; });
        Persist.save();
    },

    toggleChannel(ch) {
        if (ch === 1) {
            State.sim.ch1Enabled = !State.sim.ch1Enabled;
            const pill = document.getElementById('pill1'); const toggle = document.getElementById('ch1Toggle');
            if (pill)   pill.classList.toggle('off', !State.sim.ch1Enabled);
            if (toggle) { toggle.innerText = State.sim.ch1Enabled ? 'ON' : 'OFF'; toggle.classList.toggle('on', State.sim.ch1Enabled); }
        } else if (ch === 2) {
            State.sim.ch2Enabled = !State.sim.ch2Enabled;
            const pill = document.getElementById('pill2'); const toggle = document.getElementById('ch2Toggle');
            if (pill)   pill.classList.toggle('off', !State.sim.ch2Enabled);
            if (toggle) { toggle.innerText = State.sim.ch2Enabled ? 'ON' : 'OFF'; toggle.classList.toggle('on', State.sim.ch2Enabled); }
        } else if (ch === 3) {
            if (!this._isAnalyserUnlocked()) return;
            State.sim.ch3Enabled = !State.sim.ch3Enabled;
            const pill = document.getElementById('pill3'); const toggle = document.getElementById('ch3Toggle');
            if (pill)   pill.classList.toggle('off', !State.sim.ch3Enabled);
            if (toggle) { toggle.innerText = State.sim.ch3Enabled ? 'ON' : 'OFF'; toggle.classList.toggle('on', State.sim.ch3Enabled); }
        }
        Persist.save();
    },

    setCHGain(ch, value) {
        const v = parseFloat(value);
        if (ch === 1) { State.ch1Gain = v; const el = document.getElementById('ch1GainVal'); if (el) el.innerText = v.toFixed(1) + 'x'; }
        else          { State.ch2Gain = v; const el = document.getElementById('ch2GainVal'); if (el) el.innerText = v.toFixed(1) + 'x'; }
        Persist.scheduleSave();
    },

    setCH2Offset(value) {
        State.ch2Offset = parseInt(value);
        const el = document.getElementById('ch2OffsetVal'); if (el) el.innerText = (value > 0 ? '+' : '') + value + 'px';
        Persist.scheduleSave();
    },

    setSimWave(type) {
        State.sim.waveType = type; State.sim.phase_acc = 0;
        document.querySelectorAll('.wave-btn, .ss-wavebtn').forEach(b => b.classList.toggle('active', b.dataset.wave === type));
        const dutyRow = document.getElementById('dutyRow'); if (dutyRow) dutyRow.style.display = (type === 'pwm' || type === 'square') ? 'flex' : 'none';
        Persist.scheduleSave();
    },

    setSimFreq(val) {
        State.sim.frequency = parseFloat(val);
        const label = val >= 1000 ? (val/1000).toFixed(2)+'kHz' : Math.round(val)+'Hz';
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

    setSimFileGain(val) { State.sim.amplitude = parseFloat(val); const el = document.getElementById('simFileGainVal'); if (el) el.innerText = parseFloat(val).toFixed(2) + 'x'; Persist.scheduleSave(); },

    setSimSampleRate(sr, btn) {
        State.simSampleRate = sr;
        document.querySelectorAll('[data-sr]').forEach(b => b.classList.toggle('active', b === btn));
        if (State.simMode && State.dataArray) { State.dataArray = new Uint8Array(State.fftSize); State.freqArray = new Uint8Array(State.fftSize / 2); State.ch2Data = null; State.ch3Data = null; }
        Persist.scheduleSave();
    },

    setSimSource(src) { this.setCH2Source(src); },

    toggleSimPlay() { State.sim.playing = !State.sim.playing; this._syncPlayPauseButtons(); Persist.scheduleSave(); },
    stopSim()       { State.sim.playing = false; State.sim.phase_acc = 0; Persist.scheduleSave(); },
    toggleCH2Source() {},

    toggleSimChevron() {
        const content = document.getElementById('simChevronContent');
        const strip   = document.getElementById('simCollapsedStrip');
        const chevron = document.getElementById('simChevronIcon');
        const expanded = content && content.style.display !== 'none';
        if (content) content.style.display = expanded ? 'none' : 'flex';
        if (strip)   strip.style.display   = expanded ? 'flex' : 'none';
        if (chevron) chevron.innerText      = expanded ? '∨' : '∧';
        App.resize();
    },

    togglePause() {
        if (State.simMode) {
            State.sim.playing = !State.sim.playing;
            this._syncPlayPauseButtons(); Persist.scheduleSave();
        } else {
            State.paused = !State.paused;
            const btn = document.getElementById('pauseBtn');
            if (btn) { btn.innerText = State.paused ? '▶ RESUME' : '⏸ PAUSE'; btn.className = State.paused ? 'btn-secondary' : 'btn-primary'; }
            document.getElementById('statusTxt').innerText = State.paused ? 'PAUSED' : 'LIVE';
            if (State.paused) document.getElementById('statusDot').classList.remove('active');
            else              document.getElementById('statusDot').classList.add('active');
        }
    },

    _syncPlayPauseButtons() {
        if (!State.simMode) return;
        const playing  = State.sim.playing;
        const pauseBtn = document.getElementById('pauseBtn');
        if (pauseBtn) { pauseBtn.innerText = playing ? '⏸ PAUSE' : '▶ PLAY'; pauseBtn.className = playing ? 'btn-primary' : 'btn-secondary'; pauseBtn.disabled = false; }
        const simPlayBtn = document.getElementById('simPlayBtn');
        if (simPlayBtn) { simPlayBtn.innerText = playing ? '⏸ PAUSE' : '▶ PLAY'; simPlayBtn.className = playing ? 'btn-primary' : 'btn-secondary'; }
        const dot = document.getElementById('statusDot');
        const txt = document.getElementById('statusTxt');
        if (dot) { dot.classList.toggle('sim', true); dot.classList.toggle('active', false); }
        if (txt) txt.innerText = playing ? 'SIM' : 'SIM PAUSED';
    },

    updateZoom(v)      { State.zoom = parseFloat(v); document.getElementById('zoomVal').innerText = State.zoom.toFixed(1) + 'x'; Persist.scheduleSave(); },
    updateGain(v)      { State.gain = parseFloat(v); document.getElementById('gainVal').innerText = State.gain.toFixed(1) + 'x'; Persist.scheduleSave(); },
    updateSmoothing(v) { State.smoothing = parseFloat(v); if (State.analyser) State.analyser.smoothingTimeConstant = State.smoothing; document.getElementById('smoothVal').innerText = State.smoothing.toFixed(2); Persist.scheduleSave(); },

    adjustFFTSize(dir) {
        const sizes = [512, 1024, 2048, 4096, 8192];
        let idx = sizes.indexOf(State.fftSize);
        if (idx < 0) idx = 3; // default to 4096
        idx = Math.max(0, Math.min(sizes.length - 1, idx + dir));
        State.fftSize = sizes[idx];

        // ── Recreate all buffers to match new size ──
        State.dataArray = new Uint8Array(State.fftSize);
        State.freqArray = new Uint8Array(State.fftSize / 2);
        State.ch2Data   = State.simMode ? new Uint8Array(State.fftSize) : null;

        document.getElementById('fftSizeVal').innerText = State.fftSize;
        if (State.analyser) {
            State.analyser.fftSize = State.fftSize;
            State.dataArray = new Uint8Array(State.analyser.fftSize);
            State.freqArray = new Uint8Array(State.analyser.frequencyBinCount);
            const bFft = document.getElementById('bFftSize'); if (bFft) bFft.innerText = State.fftSize;
            const bRes = document.getElementById('bFreqRes'); if (bRes && State.audioCtx) bRes.innerText = (State.audioCtx.sampleRate / State.fftSize).toFixed(2) + 'Hz';
        }
        // ── Sync mic analyser buffer ──
        App.resyncMicAnalyser();

        Persist.scheduleSave();
    },

    adjustTimeDiv(dir) {
        if (State.timeDivIndex === null) State.timeDivIndex = Math.floor(TIME_DIV_STEPS.length / 2);
        State.timeDivIndex = Math.max(0, Math.min(TIME_DIV_STEPS.length - 1, State.timeDivIndex + dir));
        const ms = TIME_DIV_STEPS[State.timeDivIndex];
        const label = ms >= 1 ? ms.toFixed(0) + 'ms' : (ms * 1000).toFixed(0) + 'µs';
        document.getElementById('timeDivVal').innerText = label;
        const menu = document.getElementById('timeDivValMenu'); if (menu) menu.innerText = label;
        const sr = State.simMode ? State.simSampleRate : (State.audioCtx ? State.audioCtx.sampleRate : null);
        if (sr && State.dataArray) {
            const spd = (ms / 1000) * sr;
            State.zoom = Math.max(1, Math.min(8, State.dataArray.length / (spd * 10)));
            document.getElementById('zoomSlider').value  = State.zoom;
            document.getElementById('zoomVal').innerText = State.zoom.toFixed(1) + 'x';
        }
        Persist.scheduleSave();
    },

    adjustVoltDiv(dir) {
        if (State.voltDivIndex === null) State.voltDivIndex = Math.floor(VOLT_DIV_STEPS.length / 2);
        State.voltDivIndex = Math.max(0, Math.min(VOLT_DIV_STEPS.length - 1, State.voltDivIndex + dir));
        const v = VOLT_DIV_STEPS[State.voltDivIndex];
        const label = v.toFixed(2) + 'V';
        document.getElementById('voltDivVal').innerText = label;
        const menu = document.getElementById('voltDivValMenu'); if (menu) menu.innerText = label;
        State.gain = 10 - (State.voltDivIndex / (VOLT_DIV_STEPS.length - 1)) * 9;
        document.getElementById('gainSlider').value  = State.gain;
        document.getElementById('gainVal').innerText = State.gain.toFixed(1) + 'x';
        Persist.scheduleSave();
    },

    captureSnapshot() {
        const canvas = document.getElementById('scopeCanvas');
        const link = document.createElement('a');
        link.download = `labscope_${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    },

    // ══════════════════════════════════════
    // THEME
    // ══════════════════════════════════════
    setTheme(theme) {
        State.theme = theme;
        document.documentElement.setAttribute('data-theme', theme);
        document.querySelectorAll('.theme-btn[data-theme]').forEach(b => b.classList.toggle('active', b.dataset.theme === theme));
        Persist.scheduleSave();
    },

    // ── CHANNEL COLORS ──
    // ── FIX: data-group="ch1" not "ch1-color" ──
    setCH1Color(color) {
        State.ch1Color  = color;
        State.waveColor = color;
        this._swatch('ch1', color);
        Persist.scheduleSave();
    },
    setCH2Color(color) { State.ch2Color = color; this._swatch('ch2', color); Persist.scheduleSave(); },
    setCH3Color(color) { State.ch3Color = color; this._swatch('ch3', color); Persist.scheduleSave(); },

    // Kept for canvas grid (no UI in theme tab anymore — only called from persist restore)
    setGridColor(color) { State.gridColor = color; Persist.scheduleSave(); },
    setMeasColor(color) {
        State.measColor = color;
        document.documentElement.style.setProperty('--amber', color);
        this._swatch('meas', color);
        Persist.scheduleSave();
    },

    // ── PERSIST COMPAT — intentionally no-ops for CSS var overrides ──
    // These used to set --text-mid/--text-main which broke all grey UI text
    setWaveColor(color)          { State.waveColor = color; },
    setSettingsTextColor(color)  { State.settingsTextColor = color; /* NO CSS var override */ },
    setSettingsFont(font)        { State.settingsFont = font; },
    setSettingsFontSize(v)       { State.settingsFontSize = parseInt(v); },
    setScopeTextColor(color)     {
        State.scopeTextColor = color;
        // Only set neon (canvas overlay color) — NOT text-mid/text-main
        document.documentElement.style.setProperty('--neon', color);
    },
    setScopeFont(font) {
        State.scopeFont = font;
        document.documentElement.style.setProperty('--font-display', FONT_MAP[font] || FONT_MAP.retro);
        document.documentElement.style.setProperty('--font-scope',   FONT_MAP[font] || FONT_MAP.retro);
    },
    setScopeFontSize(v) { State.scopeFontSize = parseInt(v); },
    setInfoTextColor(color) { State.infoTextColor = color; },
    setInfoFont(font) {
        State.infoFont = font;
        document.documentElement.style.setProperty('--font-data', FONT_MAP[font] || FONT_MAP.mono);
    },
    setInfoFontSize(v) { State.infoFontSize = parseInt(v); },

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
