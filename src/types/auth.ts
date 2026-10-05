// src/types/auth.ts
export interface AuthUser {
  id: string;
  username: string;
  displayName: string | null;
  isAdmin: boolean;
  isFinanceManager: boolean; // finantsjuht: kannete finantsid ja põldude tulemus
  mustChangePassword: boolean;
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
