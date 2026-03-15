// ── STATE.JS v1.0.1 ──
const State = {
    audioCtx:   null,
    analyser:   null,
    dataArray:  null,
    freqArray:  null,
    isRunning:  false,
    paused:     false,

    currentTab: 'osc',
    zoom:       1,
    gain:       3,
    smoothing:  0.6,
    fftSize:    4096,

    timeDivIndex: null,
    voltDivIndex: null,

    triggerEnabled: false,
    triggerMode:    'auto',
    triggerEdge:    'rising',
    triggerUpper:   0.30,
    triggerLower:  -0.30,
    triggerFired:   false,
    triggerArmed:   true,
    triggerFrame:   null,

    lastSignalType: '---',

    calibFreq: 1.0,
    calibVpp:  1.0,

    // ── THEME ──
    theme: 'dark',

    // ── THREE SECTION FONTS ──
    // Each section can independently be: 'orbitron' | 'mono' | 'rajdhani' | 'bebas'
    fontSettings: 'orbitron',
    fontScope:    'orbitron',
    fontInfo:     'mono',

    // ── FONT SIZE SCALE ──
    fontSizeScale: 1.0,  // 0.8 | 0.9 | 1.0 | 1.1 | 1.2

    animId: null,
};

const TIME_DIV_STEPS = [0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500];
const VOLT_DIV_STEPS = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1.0, 2.0];

const FONT_MAP = {
    orbitron: "'Orbitron', monospace",
    mono:     "'Share Tech Mono', monospace",
    rajdhani: "'Rajdhani', sans-serif",
    bebas:    "'Bebas Neue', sans-serif",
};

const APP_VERSION = {
    major: 1, minor: 0, patch: 1,
    toString() { return `v${this.major}.${this.minor}.${this.patch}`; }
};
