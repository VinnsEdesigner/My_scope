// ── STATE.JS v1.0.5 — YOUR CUSTOM THEME AS DEFAULT ──
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

    // ── BACKGROUND THEME ──
    theme: 'dark',

    // ── CANVAS COLORS (YOUR EXACT THEME) ──
    waveColor: '#00ff41',   // Green waveform
    gridColor: '#336666',   // Teal grid (CUSTOM COLOR)

    // ── MEASUREMENTS BAR COLOR ──
    measColor: '#ffffff',   // White (6th option)

    // ── SETTINGS PANEL SECTION ──
    settingsTextColor: '#ffb300',  // Orange (3rd option)
    settingsFont:      'retro',    // Orbitron
    settingsFontSize:  120,        // 120% bigger text

    // ── SCOPE / MAIN AREA SECTION ──
    scopeTextColor: '#ffffff',     // White (6th option)
    scopeFont:      'retro',       // Orbitron
    scopeFontSize:  120,           // 120% bigger text

    // ── SIGNAL INFO TAB SECTION ──
    infoTextColor: '#ffb300',      // Orange (3rd option)
    infoFont:      'retro',        // Orbitron
    infoFontSize:  120,            // 120% bigger text

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
    major: 1, minor: 0, patch: 5,
    toString() { return `v${this.major}.${this.minor}.${this.patch}`; },
};
