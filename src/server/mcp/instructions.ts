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
