// src/types/auth.ts
export interface AuthUser {
  id: string;
  username: string;
  displayName: string | null;
  isAdmin: boolean;
  mustChangePassword: boolean;
}

export interface AdminUser {
  id: string;
  username: string;
  displayName: string | null;
  isActive: boolean;
  isAdmin: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}
