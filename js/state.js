// ── STATE.JS v1.1.1 ──
const State = {
    // ── AUDIO ──
    audioCtx:   null,
    analyser:   null,
    dataArray:  null,
    freqArray:  null,
    isRunning:  false,
    paused:     false,

    // ── DISPLAY ──
    currentTab:   'osc',
    zoom:         1,
    gain:         3,
    smoothing:    0.6,
    fftSize:      4096,
    timeDivIndex: null,
    voltDivIndex: null,

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

    // ── CANVAS COLORS ──
    waveColor: '#ff1744',   // RED default waveform
    gridColor: '#001a1a',   // dark teal grid

    // ── MEASUREMENTS BAR COLOR ──
    measColor: '#ffb300',   // amber — fixed default

    // ── SETTINGS PANEL SECTION ──
    settingsTextColor: '#00e5ff',
    settingsFont:      'retro',
    settingsFontSize:  120,

    // ── SCOPE / MAIN AREA SECTION ──
    scopeTextColor: '#00e5ff',
    scopeFont:      'retro',
    scopeFontSize:  120,

    // ── SIGNAL INFO SECTION ──
    infoTextColor: '#ffb300',
    infoFont:      'retro',
    infoFontSize:  120,

    // ── SIM MODE ──
    simMode:       false,
    simSampleRate: 44100,
    sim: {
        source:    'synth',     // 'synth' | 'file'
        waveType:  'sine',      // sine|square|triangle|sawtooth|ramp|pwm|noise|dc
        frequency: 1000,
        amplitude: 0.8,
        phase:     0,
        dutyCycle: 0.5,
        playing:   false,
        phase_acc: 0,           // internal phase accumulator
    },

    // ── ANIMATION ──
    animId: null,
};

// ── TIMEBASE / VOLT STEPS ──
const TIME_DIV_STEPS = [0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500];
const VOLT_DIV_STEPS = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1.0, 2.0];

// ── FONT MAP ──
const FONT_MAP = {
    retro:  "'Orbitron', monospace",
    mono:   "'Share Tech Mono', monospace",
    modern: "'Rajdhani', sans-serif",
    pro:    "'Bebas Neue', sans-serif",
};

// ── SEMANTIC VERSION ──
const APP_VERSION = {
    major: 1, minor: 1, patch: 1,
    toString() { return `v${this.major}.${this.minor}.${this.patch}`; },
};

// ── NOTE: initializeTheme() is called from app.js after ALL scripts load ──
// This prevents BUG1 where UI was called before it existed
