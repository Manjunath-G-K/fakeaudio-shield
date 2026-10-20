import { useSyncExternalStore } from "react";

// One audio element for the whole chat, like a messaging app: starting a voice note stops the
// previous one. A play request can be limited to a range (used for "play the suspicious part").
const audio = typeof Audio !== "undefined" ? new Audio() : null;
let state = { url: null, playing: false, time: 0, duration: 0, range: null };
const listeners = new Set();
const emit = (patch) => { state = { ...state, ...patch }; listeners.forEach((l) => l()); };

if (audio) {
  audio.preload = "auto";
  audio.addEventListener("timeupdate", () => {
    if (state.range && audio.currentTime >= state.range[1]) {
      audio.pause();
      emit({ time: state.range[1] });
      return;
    }
    emit({ time: audio.currentTime });
  });
  audio.addEventListener("play", () => emit({ playing: true }));
  audio.addEventListener("pause", () => emit({ playing: false }));
  audio.addEventListener("ended", () => emit({ playing: false, time: 0, range: null }));
  audio.addEventListener("loadedmetadata", () => emit({ duration: audio.duration }));
}

export const player = {
  /** Play `url`, optionally only between range[0] and range[1] seconds. */
  async play(url, range = null) {
    if (!audio) return;
    if (state.url !== url) {
      audio.src = url;
      emit({ url, time: 0, duration: 0 });
    }
    if (range) audio.currentTime = range[0];
    emit({ range });
    try { await audio.play(); } catch { emit({ playing: false }); }
  },
  pause() { audio?.pause(); },
  seek(url, seconds) {
    if (!audio) return;
    if (state.url !== url) { audio.src = url; emit({ url, duration: 0 }); }
    audio.currentTime = seconds;
    emit({ time: seconds, range: null });
  },
  stopIf(url) { if (state.url === url) { audio.pause(); audio.removeAttribute("src"); emit({ url: null, playing: false, time: 0, range: null }); } },
};

const subscribe = (l) => { listeners.add(l); return () => listeners.delete(l); };
const snapshot = () => state;

/** Current player state; components compare `url` with their own clip. */
export const usePlayer = () => useSyncExternalStore(subscribe, snapshot, snapshot);
