// src/types/apiKey.ts — AI ühenduse (MCP) API-võti; võtit ennast näidatakse ainult loomisel.
export interface ApiKeyRow {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt: string; // ISO
  lastUsedAt: string | null; // ISO
}

export interface CreatedApiKey extends ApiKeyRow {
  key: string;
  url: string;
}
