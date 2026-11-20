// Save / load through localStorage. The save holds progression, not the
// live world: money, finished missions, collected packages and best stats.
// A broken or missing save just means a fresh start.

const SAVE_KEY = 'solmar-city-save-v1';

export function defaultSave() {
  return {
    money: 250,
    missionsDone: [],
    packagesFound: [],
    stats: {
      carsStolen: 0,
      faresDone: 0,
      bestWanted: 0,
      missionsDone: 0,
      playSeconds: 0,
    },
    clockMinutes: 10 * 60,
  };
}

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data.money !== 'number') return null;
    const fresh = defaultSave();
    return {
      ...fresh,
      ...data,
      stats: { ...fresh.stats, ...(data.stats || {}) },
    };
  } catch {
    return null;
  }
}

export function writeSave(game) {
  try {
    const data = {
      money: game.player.money,
      missionsDone: game.missionsDone.slice(),
      packagesFound: game.packagesFound.slice(),
      stats: { ...game.stats },
      clockMinutes: game.clockMinutes,
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Storage may be unavailable (private mode); the game plays on.
  }
}
