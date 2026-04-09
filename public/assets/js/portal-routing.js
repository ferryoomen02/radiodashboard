import { getAuth, isSuperAdminRole } from "./portal-auth.js";
import { SONICWAVE_DEBUG } from "./portal-debug.js";

/**
 * Tijdelijke logging: waarom een redirect plaatsvindt (geen /account meer voor guards).
 * Zet SONICWAVE_DEBUG in portal-debug.js op false om te stoppen.
 */
export function logAuthRouting(event, detail = {}) {
  if (!SONICWAVE_DEBUG) return;
  const role = getAuth()?.user?.role;
  console.log("[SonicWave auth-routing]", event, { ...detail, role });
}

/**
 * Ontbrekende module / feature-recht: altijd naar /dashboard (nooit /account).
 * SUPER_ADMIN zou hier normaal niet moeten landen; als dat toch gebeurt → /dashboard.
 * Logt altijd (tijdelijk) zodat live te zien is waarom deze fallback draait.
 */
export function redirectNoModuleAccess(reason) {
  const role = getAuth()?.user?.role;
  console.warn("[SonicWave auth-routing] redirect → /dashboard (geen module-recht; vroeger /account)", {
    reason,
    role,
    superAdmin: isSuperAdminRole(role),
  });
  logAuthRouting("redirectNoModuleAccess", {
    reason,
    target: "/dashboard",
    wasPreviously: "/account",
    superAdmin: isSuperAdminRole(role),
  });
  window.location.href = "/dashboard";
}
