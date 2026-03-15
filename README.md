# 🔬 Lab Scope v1.0.3 (Mobile Edition)

A web-based oscilloscope built for electronics hobbyists with no PC — just your smartphone and an AUX jack ⚡

## 🚀 Features
- **Oscilloscope View** — Real-time time-domain waveform with zoom & gain control
- **FFT Spectrum Analyzer** — Frequency spectrum with color-coded intensity bars
- **Signal Type Detection** — Auto-classifies Sine / Square / Triangle / Sawtooth / Noise / DC in real time
- **Live Measurements** — Frequency, Vpp, RMS, dBFS with color-coded warnings
- **Trigger System** — AUTO / NORMAL / SINGLE modes, RISE/FALL/BOTH edge, upper+lower threshold band
- **Manual Trigger Input** — Type exact threshold voltage directly
- **Time/Div + Volt/Div** — Manual and auto timebase/amplitude scaling like a real scope
- **Calibration** 
- **Pause / Resume**
- **Snapshot** — 
- **Network-First Caching** 
- **CRT Scanline Effect** 

## 🛠️ Tech Stack
- **Languages:** HTML5, CSS3, Vanilla JavaScript (Modular)
- **API:** Web Audio API — AnalyserNode
- **Fonts:** Orbitron + Share Tech Mono (Google Fonts)
- **Architecture:** PWA — manifest.json + Service Worker

## 📁 File Structure
```
My_scope/
├── index.html              ← structure & imports only
├── manifest.json           ← PWA config
├── service-worker.js       ← offline caching (network-first)
├── README.md
│
├── css/
│   ├── base.css            ← variables, reset, body
│   ├── header.css          ← logo, badge, status dot
│   ├── tabs.css            ← main tab bar
│   ├── measurements.css    ← measurement bar
│   ├── canvas.css          ← scope area, overlays, CRT effect
│   ├── controls.css        ← bottom buttons
│   ├── menu.css            ← hamburger side panel
│   └── splash.css          ← splash screen
│
└── js/
    ├── state.js            ← global state (single source of truth)
    ├── app.js              ← main loop, resize, boot
    ├── audio.js            ← AudioContext, mic/AUX init
    ├── grid.js             ← grid + time/div + volt/div labels
    ├── oscilloscope.js     ← waveform renderer
    ├── fft.js              ← FFT spectrum + signal info view
    ├── trigger.js          ← full trigger engine
    ├── signal-detect.js    ← waveform classifier
    ├── measurements.js     ← Vpp, RMS, dBFS, freq calc
    ├── calibration.js      ← freq + Vpp calibration
    ├── ui.js               ← all buttons, sliders, menus
    └── (future modules here)
```

## 📖 How to Use
1. Open the [Live App](https://VinnsEdesigner.github.io/My_scope/)
2. Tap **▶ START PROBE**
3. Grant microphone permission
4. For hardware testing — connect probe to AUX jack
5. Open **☰ menu** to access trigger, calibration and settings

## ⚙️ Trigger System
| Mode | Behaviour |
|------|-----------|
| AUTO | Always displays, even without trigger event |
| NORMAL | Only updates display when trigger fires |
| SINGLE | Captures once then pauses — re-arm manually |

## 🔬 Signal Detection
| Signal | Detection Method |
|--------|-----------------|
| SINE | Crest factor ≈ 1.41 |
| SQUARE | Clip ratio > 22% |
| TRIANGLE | Crest factor > 1.60 |
| SAWTOOTH | Slope asymmetry > 33% |
| NOISE | Low RMS, no pattern |
| DC | Amplitude < 6 counts |

## ⚠️ AUX Input Safety
- Never connect mains voltage directly 💀
- Maximum safe input: < 1Vpp audio-level signals

## 🗺️ Roadmap
- [ ] XY mode (Lissajous figures)
- [ ] Signal generator (tone output via speaker)
- [ ] Waveform history buffer
- [ ] CSV data export
- [ ] Cursors for manual measurement

---
*Built by VinnsEdesigner ⚡ | Nyeri, Kenya 🇰🇪*
