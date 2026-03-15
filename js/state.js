// ── STATE.JS v1.0.4 — YOUR CUSTOM THEME + BIGGER TEXT ──
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
    triggerMode:    'auto',   // 'auto' | 'normal' | 'single'
    triggerEdge:    'rising', // 'rising' | 'falling' | 'both'
    triggerUpper:   0.30,
    triggerLower:  -0.30,
    triggerFired:   false,
    triggerArmed:   true,
    triggerFrame:   null,

    // ── SIGNAL / CALIBRATION ──
    lastSignalType: '---',
    calibFreq:      1.0,
    calibVpp:       1.0,

    // ── BACKGROUND THEME ──
    theme: 'dark', // 'dark' | 'light'

    // ── CANVAS COLORS (YOUR EXACT THEME) ──
    waveColor: '#00ff41',   // Green waveform
    gridColor: '#336666',   // Teal grid

    // ── MEASUREMENTS BAR COLOR ──
    measColor: '#ffffff',   // White

    // ── SETTINGS PANEL SECTION (ORANGE + BIGGER) ──
    settingsTextColor: '#ffb300',  // Orange
    settingsFont:      'retro',    // Orbitron
    settingsFontSize:  120,        // 120% - BIGGER!

    // ── SCOPE / MAIN AREA SECTION (WHITE + BIGGER) ──
    scopeTextColor: '#ffffff',     // White
    scopeFont:      'retro',       // Orbitron
    scopeFontSize:  120,           // 120% - BIGGER!

    // ── SIGNAL INFO TAB SECTION (ORANGE + BIGGER) ──
    infoTextColor: '#ffb300',      // Orange
    infoFont:      'retro',        // Orbitron
    infoFontSize:  120,            // 120% - BIGGER!

    // ── ANIMATION ──
    animId: null,
};

// ── TIMEBASE / VOLT STEPS ──
const TIME_DIV_STEPS = [0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500];
const VOLT_DIV_STEPS = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1.0, 2.0];

// ── FONT MAP — used by ui.js and fft.js ──
const FONT_MAP = {
    retro:  "'Orbitron', monospace",
    mono:   "'Share Tech Mono', monospace",
    modern: "'Rajdhani', sans-serif",
    pro:    "'Bebas Neue', sans-serif",
};

// ── SEMANTIC VERSION ──
const APP_VERSION = {
    major: 1, minor: 0, patch: 4,
    toString() { return `v${this.major}.${this.minor}.${this.patch}`; },
};
