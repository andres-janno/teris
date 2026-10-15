// src/server/licenseGate.ts
// Litsentsi jõustamine API-s: litsentsita moodulite teekonnad ja aegunud litsentsi korral
// muudatused keelatakse. Olek jäetakse päringule (licenseOf), et käsitlejad saaksid
// vastust kohandada (nt /api/fleet ilma telemeetriata).
import type { IncomingMessage, ServerResponse } from 'http';
import { json } from './http.ts';
import {
  loadLicenseState, moduleForRoute, isAllowedWhenReadOnly,
  LICENSE_READ_ONLY_MESSAGE, MODULE_NOT_LICENSED_MESSAGE,
  type LicenseState, type LicenseModule
} from './license.ts';

type Denial = { status: 403; body: { error: string; code: 'MODULE_NOT_LICENSED' | 'LICENSE_READ_ONLY' } };

export function decideLicense(state: LicenseState, pathname: string, method: string): Denial | null {
  const module = moduleForRoute(pathname);
  if (module && !state.modules.includes(module)) {
    return { status: 403, body: { error: MODULE_NOT_LICENSED_MESSAGE, code: 'MODULE_NOT_LICENSED' } };
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
  req: IncomingMessage, res: ServerResponse, pathname: string, method: string, tenantId: string
): Promise<boolean> {
  const state = await loadLicenseState(tenantId);
  states.set(req, state);
  const denial = decideLicense(state, pathname, method);
  if (!denial) return false;
  json(res, denial.body, denial.status);
  return true;
}
