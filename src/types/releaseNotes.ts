// src/types/releaseNotes.ts — jagatud tüübid ja konstandid väljalaske märkmetele (server, admin, kliendirakendus).

export type ReleaseNoteCategory = 'FEATURE' | 'FIX' | 'IMPROVEMENT';
export type ReleaseNoteStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type ReleaseNoteAudience = 'ALL_ACTIVE_USERS' | 'TENANT_ADMINS';
export type ReleaseNoteDeliveryStatus = 'PENDING' | 'SENT' | 'FAILED';

export interface ReleaseNoteItem {
  id: string;
  category: ReleaseNoteCategory;
  area?: string;
  text: string;
}

export interface ReleaseNoteSourceCommit {
  hash: string;
  subject: string;
  date?: string;
}

export interface ChangelogEntry {
  commit?: string;
  date?: string;
  type: ReleaseNoteCategory;
  area?: string;
  text: string;
}

export interface ReleaseNoteDeliveryCounts {
  total: number;
  pending: number;
  sent: number;
  failed: number;
}

export interface PlatformReleaseNoteRow {
  id: string;
  version: string;
  title: string;
  summary: string | null;
  items: ReleaseNoteItem[];
  sourceCommits: ReleaseNoteSourceCommit[];
  fromCommit: string | null;
  toCommit: string | null;
  status: ReleaseNoteStatus;
  publishedAt: string | null;
  publishedBy: string | null;
  emailAudience: ReleaseNoteAudience | null;
  emailQueuedAt: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  deliveryCounts: ReleaseNoteDeliveryCounts;
}

export interface ClientReleaseNote {
  id: string;
  version: string;
  title: string;
  summary: string | null;
  items: ReleaseNoteItem[];
  publishedAt: string;
}

export interface ClientReleaseNotesPayload {
  releases: ClientReleaseNote[];
  unreadCount: number;
  hasUnread: boolean;
  receiveReleaseNotes: boolean;
}

export const RELEASE_NOTE_CATEGORIES: readonly ReleaseNoteCategory[] = ['FEATURE', 'IMPROVEMENT', 'FIX'] as const;

export const RELEASE_NOTE_CATEGORY_LABELS: Record<ReleaseNoteCategory, { singular: string; plural: string }> = {
  FEATURE: { singular: 'Uus võimalus', plural: 'Uued võimalused' },
  IMPROVEMENT: { singular: 'Täiustus', plural: 'Täiustused' },
  FIX: { singular: 'Parandus', plural: 'Parandused' }
};

export const RELEASE_NOTE_AUDIENCE_LABELS: Record<ReleaseNoteAudience, string> = {
  ALL_ACTIVE_USERS: 'Kõik aktiivsete ettevõtete kasutajad',
  TENANT_ADMINS: 'Ainult ettevõtete adminid'
};

export const RELEASE_NOTE_STATUS_LABELS: Record<ReleaseNoteStatus, string> = {
  DRAFT: 'Mustand',
  PUBLISHED: 'Avaldatud',
  ARCHIVED: 'Arhiveeritud'
};
