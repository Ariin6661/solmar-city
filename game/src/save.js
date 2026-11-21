// Solmar City — saving to localStorage.
//
// The save is small and forgiving: money, finished missions, collected
// packages and best stats. A corrupt or missing save simply yields a
// fresh profile, never a crash.

import { CFG } from './config.js';

export function freshSave() {
  return {
    money: 250,
    missionsDone: [],
    packages: [],
    taxiDone: 0,
    bestWanted: 0,
    bestMoney: 250,
  };
}

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(CFG.saveKey);
    if (!raw) return freshSave();
    const data = JSON.parse(raw);
    const base = freshSave();
    return {
      // A hand-edited save with negative money must not load as debt.
      money: typeof data.money === 'number' ? Math.max(0, data.money) : base.money,
      missionsDone: Array.isArray(data.missionsDone) ? data.missionsDone : [],
      packages: Array.isArray(data.packages) ? data.packages : [],
      taxiDone: typeof data.taxiDone === 'number' ? data.taxiDone : 0,
      bestWanted: typeof data.bestWanted === 'number' ? data.bestWanted : 0,
      bestMoney: typeof data.bestMoney === 'number' ? data.bestMoney : base.money,
    };
  } catch (err) {
    return freshSave();
  }
}

export function storeSave(data) {
  try {
    window.localStorage.setItem(CFG.saveKey, JSON.stringify(data));
  } catch (err) {
    // Storage full or unavailable (private mode): the game keeps going.
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(CFG.saveKey);
  } catch (err) {
    // Nothing to clear.
  }
}
