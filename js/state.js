// ── STATE.JS v1.3.2 ──
const State = {
    // ── AUDIO ──
    audioCtx:     null,
    analyser:     null,
    micSource:    null,
    dataArray:    null,
    freqArray:    null,
    ch1FreqArray: null,
    isRunning:    false,
    paused:       false,

    // ── DISPLAY ──
    currentTab:      'osc',
    oscViewChannel:  'ch1',
    zoom:            1,
    gain:            3,
    smoothing:       0.6,
    fftSize:         4096,
    timeDivIndex:    null,
    voltDivIndex:    null,

    // ── TRIGGER ──
    triggerEnabled: false,
    triggerMode:    'auto',
    triggerEdge:    'rising',
    triggerUpper:   0.30,
    triggerLower:  -0.30,
    triggerFired:   false,
    triggerArmed:   true,
    triggerFrame:   null,

    // ── SIGNAL / CALIBRATION ──
    lastSignalType: '---',
    calibFreq:      1.0,
    calibVpp:       1.0,

    // ── CANVAS / CHANNEL COLORS ──
    waveColor:  '#ff1744',    // live mode waveform (backwards compat)
    ch1Color:   '#e040fb',    // CH1 — purple
    ch2Color:   '#ff1744',    // CH2 — red
    ch3Color:   '#00e5ff',    // CH3 — cyan
    gridColor:  '#001a1a',
    measColor:  '#ffb300',

    // ── THEME ──
    theme: 'dark',

    // ── SETTINGS (kept for persist compat) ──
    settingsTextColor: '#00e5ff',
    settingsFont:      'retro',
    settingsFontSize:  120,
    scopeTextColor:    '#00e5ff',
    scopeFont:         'retro',
    scopeFontSize:     120,
    infoTextColor:     '#ffb300',
    infoFont:          'retro',
    infoFontSize:      120,

    // ── SIM MODE ──
    simMode:       false,
    simSampleRate: 44100,

    // ── CHANNEL SOURCES ──
    ch1Source: 'mic',
    ch2Source: 'synth',

    // ── PER-CHANNEL GAIN + OFFSET ──
    ch1Gain:   3,
    ch2Gain:   3,
    ch2Offset: 0,

    // ── BODE SWEEP SETTINGS ──
    bode: { startHz: 20, stopHz: 20000, steps: 50 },

    // ── SIM PARAMS ──
    sim: {
        waveType:   'sine',
        frequency:  1000,
        amplitude:  0.8,
        phase:      0,
        dutyCycle:  0.5,
        playing:    false,
        phase_acc:  0,
        ch1Enabled: true,
        ch2Enabled: true,
        ch3Enabled: false,
    },

    // ── MULTI-CHANNEL DATA BUFFERS ──
    ch2Data: null,
    ch3Data: null,

    // ── ANALYSER RESULTS ──
    analyserResult: null,

    // ── ANIMATION ──
    animId: null,
};

const TIME_DIV_STEPS = [0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500];
const VOLT_DIV_STEPS = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1.0, 2.0];

const FONT_MAP = {
    retro:  "'Orbitron', monospace",
    mono:   "'Share Tech Mono', monospace",
    modern: "'Rajdhani', sans-serif",
    pro:    "'Bebas Neue', sans-serif",
};

const APP_VERSION = {
    major: 1, minor: 3, patch: 2,
    toString() { return `v${this.major}.${this.minor}.${this.patch}`; },
};
