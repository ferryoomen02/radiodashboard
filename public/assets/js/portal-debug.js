/**
 * Tijdelijke debug voor auth-/redirect-/fetch-problemen.
 * Zet op false om alle SonicWave-consolelogs uit te zetten.
 */
export const SONICWAVE_DEBUG = true;

let redirectCount = 0;
const REDIRECT_WARN = 4;

export function swLog(phase, message, detail) {
  if (!SONICWAVE_DEBUG) return;
  const t = new Date().toISOString().slice(11, 23);
  if (detail !== undefined) {
    console.log(`[SonicWave ${t}] [${phase}]`, message, detail);
  } else {
    console.log(`[SonicWave ${t}] [${phase}]`, message);
  }
}

/** Roep aan vlak vóór location.href = ... om redirect-loops te zien */
export function swLogRedirect(to, reason) {
  if (!SONICWAVE_DEBUG) return;
  redirectCount += 1;
  swLog("REDIRECT", `→ ${to}`, reason);
  if (redirectCount >= REDIRECT_WARN) {
    console.warn(
      `[SonicWave] Redirect-teller = ${redirectCount}. Mogelijke loop tussen /login en /dashboard — check netwerk-tab en of JWT_SECRET gelijk is.`
    );
  }
}
