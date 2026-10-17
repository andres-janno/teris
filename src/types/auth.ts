// src/types/auth.ts
export type LicenseModule = 'TELEMETRY' | 'SATELLITE' | 'WEATHER';

export interface AuthLicense {
  readOnly: boolean; // aegunud litsents: andmed ainult lugemiseks
  validUntil: string | null; // YYYY-MM-DD
  expiresSoon: boolean; // aegub 14 päeva jooksul
  modules: LicenseModule[];
}

export interface AuthUser {
  id: string;
  username: string;
  displayName: string | null;
  isAdmin: boolean;
  isFinanceManager: boolean; // finantsjuht: kannete finantsid ja põldude tulemus
  mustChangePassword: boolean;
  tenantName: string;
  license: AuthLicense;
}

export interface AdminUser {
  id: string;
  username: string;
  displayName: string | null;
  email: string | null;
  hasPassword: boolean;
  isActive: boolean;
  isAdmin: boolean;
  isFinanceManager: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  lastSeenAt?: string | null;
  createdAt: string;
}

/** Ettevõtte admini antud kasutajatoe ligipääsu luba. */
export interface SupportGrant {
  id: string;
  validUntil: string;
  revokedAt: string | null;
  createdAt: string;
  grantedBy: { username: string; displayName: string | null };
  active: boolean;
}

/** Kasutajatoe sisenemise kirje. */
export interface SupportAccessEntry {
  startedAt: string;
  platformUsername: string;
  grantId: string;
}
