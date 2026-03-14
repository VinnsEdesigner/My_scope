// ── STATE.JS v1.0.0 ──
const State = {
    // audio
    audioCtx:   null,
    analyser:   null,
    dataArray:  null,
    freqArray:  null,
    isRunning:  false,
    paused:     false,

    // display
    currentTab: 'osc',
    zoom:       1,
    gain:       3,
    smoothing:  0.6,
    fftSize:    4096,

    // timebase / volt div
    timeDivIndex: null,
    voltDivIndex: null,

    // trigger
    triggerEnabled: false,
    triggerMode:    'auto',
    triggerEdge:    'rising',
    triggerUpper:   0.30,
    triggerLower:  -0.30,
    triggerFired:   false,
    triggerArmed:   true,
    triggerFrame:   null,

    // signal detection
    lastSignalType: '---',

    // calibration
    calibFreq: 1.0,
    calibVpp:  1.0,

    // theme
    theme: 'dark',   // 'dark' | 'light'
    font:  'retro',  // 'retro' | 'mono' | 'modern' | 'pro'

    // animation
    animId: null,
};

const TIME_DIV_STEPS = [0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500];
const VOLT_DIV_STEPS = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1.0, 2.0];

// App version — semantic versioning
const APP_VERSION = {
    major: 1, minor: 0, patch: 0,
    toString() { return `v${this.major}.${this.minor}.${this.patch}`; },
    toFull()   { return `${this.major}.${this.minor}.${this.patch}`; }
};
