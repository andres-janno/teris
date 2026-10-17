// src/server/licenseGate.ts
// Litsentsi jõustamine API-s: litsentsita moodulite teekonnad ja aegunud litsentsi korral
// muudatused keelatakse. Olek jäetakse päringule (licenseOf), et käsitlejad saaksid
// vastust kohandada (nt /api/fleet ilma telemeetriata).
import type { IncomingMessage, ServerResponse } from 'http';
import { json } from './http.ts';
import {
  loadLicenseState, moduleForRoute, isAllowedWhenReadOnly, SUPPORT_REVOKE,
  LICENSE_READ_ONLY_MESSAGE, MODULE_NOT_LICENSED_MESSAGE,
  type LicenseState, type LicenseModule
} from './license.ts';

type Denial = { status: 403; body: { error: string; code: 'MODULE_NOT_LICENSED' | 'LICENSE_READ_ONLY' | 'SUPPORT_READ_ONLY' } };

export const SUPPORT_READ_ONLY_MESSAGE = 'Tugivaade on ainult lugemiseks';

export function decideLicense(state: LicenseState, pathname: string, method: string, supportView = false): Denial | null {
  const module = moduleForRoute(pathname);
  if (module && !state.modules.includes(module)) {
    return { status: 403, body: { error: MODULE_NOT_LICENSED_MESSAGE, code: 'MODULE_NOT_LICENSED' } };
  }
  // Tugivaade on alati ainult lugemiseks; loa tühistamine pole siin erand (seda teeb ettevõtte admin).
  if (supportView && (!isAllowedWhenReadOnly(pathname, method) || SUPPORT_REVOKE.test(pathname))) {
    return { status: 403, body: { error: SUPPORT_READ_ONLY_MESSAGE, code: 'SUPPORT_READ_ONLY' } };
  }
  if (state.readOnly && !isAllowedWhenReadOnly(pathname, method)) {
    return { status: 403, body: { error: LICENSE_READ_ONLY_MESSAGE, code: 'LICENSE_READ_ONLY' } };
  }
  return null;
}

const states = new WeakMap<IncomingMessage, LicenseState>();

export function licenseOf(req: IncomingMessage): LicenseState | null {
  return states.get(req) ?? null;
}

export function hasModule(state: LicenseState | null, m: LicenseModule): boolean {
  return !!state && state.modules.includes(m);
}

export async function applyLicenseGate(
  req: IncomingMessage, res: ServerResponse, pathname: string, method: string, tenantId: string,
  supportView = false
): Promise<boolean> {
  const state = await loadLicenseState(tenantId);
  // Tugivaates käsitletakse litsentsi alati kui ainult lugemiseks (nt GET-päringute kõrvalkirjutused jäävad ära);
  // ainult serveri sisene olek, kliendi litsentsi vastust see ei muuda.
  states.set(req, supportView ? { ...state, readOnly: true } : state);
  const denial = decideLicense(state, pathname, method, supportView);
  if (!denial) return false;
  json(res, denial.body, denial.status);
  return true;
}
