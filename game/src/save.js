// Solmar City — save game in localStorage.
// Money, finished missions, found packages and best stats survive a
// reload. Everything is guarded: a browser without storage just plays
// without saving.
const KEY = 'solmar-city-save-v1';

export function defaultSave() {
  return {
    money: 0,
    missionsDone: [],
    packagesFound: [],
    bestMoney: 0,
    kills: 0,
    fares: 0,
  };
}

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return defaultSave();
    const data = JSON.parse(raw);
    const clean = defaultSave();
    if (typeof data.money === 'number') clean.money = data.money;
    if (Array.isArray(data.missionsDone)) clean.missionsDone = data.missionsDone.filter((m) => typeof m === 'string');
    if (Array.isArray(data.packagesFound)) clean.packagesFound = data.packagesFound.filter((p) => typeof p === 'string');
    if (typeof data.bestMoney === 'number') clean.bestMoney = data.bestMoney;
    if (typeof data.kills === 'number') clean.kills = data.kills;
    if (typeof data.fares === 'number') clean.fares = data.fares;
    return clean;
  } catch (err) {
    return defaultSave();
  }
}

export function writeSave(data) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(data));
  } catch (err) {
    // Storage unavailable (private mode, file://) — play on unsaved.
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(KEY);
  } catch (err) {
    // Nothing to clear.
  }
}
