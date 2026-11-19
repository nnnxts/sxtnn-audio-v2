/** Petite vibration au toucher (Android). Sans effet là où elle n'est pas supportée (iPhone, ordinateur). */
export function tap(ms = 8) {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(ms);
  } catch {
    /* ignoré */
  }
}
