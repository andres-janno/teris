// src/server/adminRules.ts — kasutajate halduse puhtad reeglid (testitavad ilma andmebaasita).

export const USERNAME_ERROR = 'Kasutajanimi peab olema 1–64 märki (a–z, 0–9, . _ -)';

export function normalizeUsername(raw: unknown): string | null {
  const username = String(raw ?? '').trim().toLowerCase();
  return /^[a-z0-9._-]{1,64}$/.test(username) ? username : null;
}

export interface AdminTarget {
  id: string;
  isActive: boolean;
  isAdmin: boolean;
}

export type AdminChange = { kind: 'update'; isActive?: boolean; isAdmin?: boolean } | { kind: 'delete' };

// Tagastab veateate või null, kui muudatus on lubatud. actorId '' = käsurida (pole "iseennast").
export function checkAdminChange(
  actorId: string,
  target: AdminTarget,
  change: AdminChange,
  activeAdminCount: number
): string | null {
  const removesAdmin = change.kind === 'delete' || change.isActive === false || change.isAdmin === false;
  if (!removesAdmin) return null;
  if (actorId === target.id) {
    return 'Seda muudatust ei saa teha: iseennast ei saa keelata, kustutada ega admini õigusest ilma jätta';
  }
  if (target.isActive && target.isAdmin && activeAdminCount <= 1) {
    return 'Seda muudatust ei saa teha: vähemalt üks aktiivne admin peab jääma';
  }
  return null;
}
