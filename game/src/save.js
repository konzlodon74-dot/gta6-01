// save.js — Nico's progress, kept in the browser's local storage.
//
// A save holds the cash on hand, how far the story has run, lifetime
// earnings and where Nico was standing. Anything unreadable is treated
// as no save at all: a fresh start is always safe.

const SAVE_KEY = 'palmera-heat-save-v1';

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    if (typeof data.cash !== 'number' || typeof data.storyStep !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

export function storeSave(data) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    // Storage can be unavailable (private mode, quotas); the game goes on.
  }
}

export function wipeSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // Nothing to wipe if storage itself is out of reach.
  }
}
