// Save / load to localStorage. Progress that survives a reload:
// money, which story missions are done, packages collected, best stats.
import { CFG } from './config.js';

export function defaultSave() {
  return {
    money: 250,
    missionsDone: [false, false, false, false],
    packagesTaken: [],
    best: { earned: 0, fares: 0, kills: 0 },
  };
}

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(CFG.SAVE_KEY);
    if (!raw) return defaultSave();
    const data = JSON.parse(raw);
    const base = defaultSave();
    return {
      money: typeof data.money === 'number' ? data.money : base.money,
      missionsDone: Array.isArray(data.missionsDone) && data.missionsDone.length === 4
        ? data.missionsDone.map(Boolean)
        : base.missionsDone,
      packagesTaken: Array.isArray(data.packagesTaken) ? data.packagesTaken : base.packagesTaken,
      best: { ...base.best, ...(data.best || {}) },
    };
  } catch (e) {
    return defaultSave();
  }
}

export function storeSave(save) {
  try {
    window.localStorage.setItem(CFG.SAVE_KEY, JSON.stringify(save));
  } catch (e) {
    // Storage full or blocked (private mode): the game plays on anyway.
  }
}

// Copy the live game state back into the save object.
export function syncSaveToGame(save, G) {
  save.money = Math.round(G.money);
  save.missionsDone = G.missionDone.slice();
  save.packagesTaken = G.world.pkgSpots
    .map((p, i) => (p.taken ? i : -1))
    .filter((i) => i >= 0);
  save.best.earned = Math.max(save.best.earned, G.stats.earned);
  save.best.fares = Math.max(save.best.fares, G.stats.fares);
  save.best.kills = Math.max(save.best.kills, G.stats.kills);
}

export function applySaveToGame(G, save) {
  G.money = save.money;
  G.missionDone = save.missionsDone.slice();
  save.packagesTaken.forEach((i) => {
    if (G.world.pkgSpots[i]) G.world.pkgSpots[i].taken = true;
  });
  G.stats.best = { ...save.best };
}

// Clear the save (used from the pause menu: hold-to-confirm in game).
export function wipeSave() {
  try {
    window.localStorage.removeItem(CFG.SAVE_KEY);
  } catch (e) {
    // Nothing to clear.
  }
  return defaultSave();
}
