# 🔬 Lab Scope v2.0 (Mobile Edition)

A web-based oscilloscope for electronics hobbyists with no PC — just your smartphone ⚡

## 🚀 Features
- **Oscilloscope View** — Real-time time-domain waveform with zoom & gain control
- **FFT Spectrum Analyzer** — Frequency spectrum with color-coded intensity bars
- **Signal Diagnostics** — Live measurements; Frequency, Vpp, RMS, dBFS
- **Smart Warnings** — Color alerts when signal levels are too hot 🔴
- **Pause / Resume** — Freeze the waveform anytime
- **Snapshot** — Save waveform as PNG image
- **PWA Enabled** — Install on homescreen, works 100% offline
- **CRT Scanline Effect** 

## 🛠️ Tech Stack
- **Languages:** HTML5, CSS3, Vanilla JavaScript
- **API:** Web Audio API — AnalyserNode
- **Fonts:** Orbitron + Share Tech Mono (Google Fonts)
- **Architecture:** PWA — manifest.json + Service Worker

## 📖 How to Use
1. Open the [Live App](https://VinnsEdesigner.github.io/My_scope/)
2. Tap **▶ START PROBE**
3. Grant microphone permission
4. For hardware testing — connect probe to AUX jack ⚠️ keep input voltage safe, max 1V peak!

## ⚠️ AUX Input Safety
- Never connect mains voltage directly 💀
- Use a voltage divider circuit to step down signals
- Safe range: audio-level signals only (< 1Vpp)

## 📁 File Structure
```
My_scope/
├── index.html         ← full app (UI + logic)
├── manifest.json      ← PWA config
├── service-worker.js  ← offline caching
└── README.md
```

## 🗺️ Roadmap
- [ ] Trigger level control
- [ ] Multiple color themes
- [ ] Signal frequency history graph
- [ ] Modular file architecture

---
*Built by VinnsEdesigner ⚡ | Nyeri,Kenya 🇰🇪*
