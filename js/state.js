// ── STATE.JS v1.0.4 — CUSTOM DEFAULT THEME ──
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

    // ── CANVAS COLORS (YOUR CUSTOM THEME) ──
    waveColor: '#00ff41',   // Green waveform (kept as is)
    gridColor: '#006666',   // Teal/cyan grid (your selection)

    // ── MEASUREMENTS BAR COLOR ──
    measColor: '#ffffff',   // White measurements (your selection)

    // ── SETTINGS PANEL SECTION (ORANGE THEME) ──
    settingsTextColor: '#ffb300',  // Orange text
    settingsFont:      'retro',    // Orbitron
    settingsFontSize:  100,        // 100%

    // ── SCOPE / MAIN AREA SECTION (WHITE THEME) ──
    scopeTextColor: '#ffffff',     // White text
    scopeFont:      'retro',       // Orbitron
    scopeFontSize:  100,           // 100%

    // ── SIGNAL INFO TAB SECTION (ORANGE THEME) ──
    infoTextColor: '#ffb300',      // Orange text
    infoFont:      'retro',        // Orbitron
    infoFontSize:  100,            // 100%

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
