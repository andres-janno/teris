// src/server/mcp/instructions.ts — juhis AI-le (MCP initialize vastuse "instructions").
// Hallatakse admin.teris.ee-s (platform_settings); koodis ainult vaikejuhis.
import { authDb } from '../db.ts';

export const MCP_INSTRUCTIONS_KEY = 'mcp_instructions';
export const MCP_INSTRUCTIONS_MAX = 20000;

export const DEFAULT_MCP_INSTRUCTIONS = `Teris on põllumajandusettevõtte haldustarkvara. Andmed on ühe ettevõtte omad ja ainult lugemiseks.

Mõisted:
- Hooaeg = kalendriaasta. Põllul on igal hooajal oma pindala, kultuur ja sort.
- Töö (list_field_works) on plaan: mida põllul teha kavatsetakse.
- Kanne (list_work_entries) on tegelikult tehtud tegevus (põlluraamat): kuupäev, tegija, masin, materjalid ja kogused.
- Materjalide kulu kokku: summarize_material_usage.
- Laoseis: list_stock_levels. Laokanded ja kõik rahasummad (hinnad, kulud, väärtused) on nähtavad ainult finantsõigusega kasutajale — vaata whoami (financeAccess).

Põllu, masina, materjali ja lao saab anda nime või numbri järgi. Kui nimi sobib mitmele, tuleb vastuseks valikute loend — küsi kasutajalt täpsustust.
Loendid on piiratud: kontrolli vastuses total ja shown; kui shown < total, ütle seda kasutajale või kitsenda päringut.
Kuupäevad on kujul pp.kk.aaaa. Vasta kasutajale tema keeles.`;

export async function loadMcpInstructions(): Promise<string> {
  const row = await authDb().platformSetting.findUnique({ where: { key: MCP_INSTRUCTIONS_KEY }, select: { value: true } });
  return row && row.value.trim() ? row.value : DEFAULT_MCP_INSTRUCTIONS;
}

export type McpInstructionsDto = { value: string; isDefault: boolean; defaultValue: string; updatedBy: string | null; updatedAt: string | null; maxLength: number };

export async function getMcpInstructionsAdmin(): Promise<McpInstructionsDto> {
  const row = await authDb().platformSetting.findUnique({ where: { key: MCP_INSTRUCTIONS_KEY } });
  const isDefault = !row || !row.value.trim();
  return {
    value: isDefault ? DEFAULT_MCP_INSTRUCTIONS : row.value,
    isDefault,
    defaultValue: DEFAULT_MCP_INSTRUCTIONS,
    updatedBy: row?.updatedBy ?? null,
    updatedAt: row?.updatedAt.toISOString() ?? null,
    maxLength: MCP_INSTRUCTIONS_MAX
  };
}

export async function saveMcpInstructions(value: unknown, pu: { id: string; username: string }): Promise<{ ok: true } | { ok: false; error: string }> {
  if (typeof value !== 'string' || !value.trim()) return { ok: false, error: 'Juhis on tühi — vaikejuhise taastamiseks kasuta „Taasta vaikejuhis“' };
  if (value.length > MCP_INSTRUCTIONS_MAX) return { ok: false, error: `Juhis on liiga pikk (kuni ${MCP_INSTRUCTIONS_MAX} märki)` };
  await authDb().$transaction(async (tx) => {
    await tx.platformSetting.upsert({
      where: { key: MCP_INSTRUCTIONS_KEY },
      create: { key: MCP_INSTRUCTIONS_KEY, value, updatedBy: pu.username },
      update: { value, updatedBy: pu.username }
    });
    await tx.platformAuditLog.create({ data: { action: 'MCP_INSTRUCTIONS_UPDATE', platformUserId: pu.id, targetTenantId: null, details: { length: value.length } } });
  });
  return { ok: true };
}

export async function resetMcpInstructions(pu: { id: string; username: string }): Promise<void> {
  await authDb().$transaction(async (tx) => {
    const { count } = await tx.platformSetting.deleteMany({ where: { key: MCP_INSTRUCTIONS_KEY } });
    if (count > 0) await tx.platformAuditLog.create({ data: { action: 'MCP_INSTRUCTIONS_RESET', platformUserId: pu.id, targetTenantId: null } });
  });
}
