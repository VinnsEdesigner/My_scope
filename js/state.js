// ── STATE.JS — single source of truth ──
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

    // timebase / volt div (manual override, null = auto)
    timeDivIndex:  null,   // index into TIME_DIV_STEPS
    voltDivIndex:  null,   // index into VOLT_DIV_STEPS

    // trigger
    triggerEnabled: false,
    triggerMode:    'auto',    // 'auto' | 'normal' | 'single'
    triggerEdge:    'rising',  // 'rising' | 'falling' | 'both'
    triggerUpper:   0.30,      // normalized -1 to 1
    triggerLower:  -0.30,
    triggerFired:   false,
    triggerArmed:   true,
    triggerFrame:   null,      // frozen dataArray snapshot for single mode

    // signal detection
    lastSignalType: '---',

    // calibration multipliers
    calibFreq: 1.0,
    calibVpp:  1.0,

    // animation
    animId: null,
};

// Timebase steps (ms/div)
const TIME_DIV_STEPS = [0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500];
// Volt/div steps (V/div normalized)
const VOLT_DIV_STEPS = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1.0, 2.0];
