// src/server/mcp/instructions.ts — juhis AI-le (MCP initialize vastuse "instructions").
// Hallatakse admin.teris.ee-s (platform_settings); koodis ainult vaikejuhis.
import { authDb } from '../db.ts';

export const MCP_INSTRUCTIONS_KEY = 'mcp_instructions';
export const MCP_INSTRUCTIONS_MAX = 20000;

export const DEFAULT_MCP_INSTRUCTIONS = `Teris on põllumajandusettevõtte haldustarkvara. Andmed on ühe ettevõtte omad ja valdavalt ainult lugemiseks (v.a artiklite lisamine, põldude planeeritud saagiootuste muutmine, põllutööde plaanide ja kannete loomine ning laoseisu korrigeerimine inventuurikandega).

Mõisted:
- Hooaeg = kalendriaasta. Põllul on igal hooajal oma pindala, kultuur, sort ja planeeritud saagiootus (t/ha), mida saab muuta tööriistaga update_field_target_yields (nõuab kehtivat litsentsi ja avatud hooaega).
- Töö (list_field_works) on plaan: mida põllul teha kavatsetakse. Uue põllutöö plaani saab luua tööriistaga create_field_work (nõuab kehtivat litsentsi ja avatud hooaega).
- Kanne (list_work_entries) on tegelikult tehtud tegevus (põlluraamat): kuupäev, tegija, masin, materjalid ja kogused. Planeeritud tööle saab kande lisada tööriistaga create_work_entry (nõuab kehtivat litsentsi ja avatud hooaega; uuendab laoseisu ja töö staatust).
- Kulumaterjalide kulu kokku: summarize_article_usage. Artiklid (list_articles) on teenused (tööaeg) ja kaubad (kulumaterjal, toodang, muu kaup); laoseis on ainult kaupadel. Uue artikli saab lisada tööriistaga create_article (nõuab kehtivat litsentsi; teenuse hind finantsõigusega).
- Laoseis: list_stock_levels, laod: list_warehouses. Laokanded (list_stock_movements) ja kõik rahasummad (hinnad, kulud, väärtused, tunnihinnad, pangakontod) on nähtavad ainult finantsõigusega kasutajale — vaata whoami (financeAccess).
- Laoseisu korrigeerimine: create_stock_inventory loob etteantud tegelike koguste järgi inventuurikande (INVENTORY), mis viib laoseisu vastavusse (nõuab finantsõigust ja kehtivat litsentsi). Enne loomist kontrolli vajadusel praegust seisu (list_stock_levels) ja täpsusta ladu/kuupäev.
- Saagipartiid: list_harvest_lots ja get_harvest_lot annavad koristatud partiid, punkrid, kaalumised ja kuivatuskulud.
- Registrid: mullaproovid (list_soil_samples), seotud isikud (list_related_parties), taristu/huvipunktid (list_points_of_interest), kultuurid/sordid (list_crops), tööliigid ja mallid (list_work_types).
- Telemeetria mooduliga: list_trips (sõidud ja põlluread), list_telemetry_devices (seadmed ja seosed), get_vehicle_activity (süütetunnid), list_trip_gaps (jälgimata töö märgid — vihjed, mitte tõend, ütle seda kasutajale).
- Ilm: weather_summary annab ERA5-Landi ilmakokkuvõtte. Ilma põlluta — aastate võrdlus 01.04–31.08 koos pikaajalise keskmisega; põlluga — selle hooaja ilm külvist koristuseni. Andmed tulevad umbes nädalase viitega ja on ~9 km ruudu keskmine, mitte põllu mõõtmine.

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
