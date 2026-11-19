// src/components/SeasonManagerModal.tsx
import React, { useState } from 'react';
import {
  Lock,
  Unlock,
  Plus,
  Edit2,
  Info,
  CalendarDays
} from 'lucide-react';
import type { FarmingSeason } from '../types/season';
import type { MasterField } from '../types/fieldRegister';
import { formatDateTimeTallinn } from '../services/dateFormat';
import { SEASON_PHASE_META, deriveSeasonPhase } from '../types/season';
import { Badge, Button, Dialog, DialogContent, DialogHeader, DialogBody, DialogFooter, DialogForm, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, NumberInput, Field, FormGrid, Input, Textarea, PageHeader } from './ui';

const formatNum = (n: number | null | undefined, digits: number) =>
  n == null ? '–' : n.toLocaleString('et-EE', { minimumFractionDigits: digits, maximumFractionDigits: digits });

// Lukus hooaja vorm (fieldset:disabled): sisendid tuhmimad ja ilma tekstikursorita
const SEASON_FIELDSET = 'm-0 min-w-0 border-0 p-0 [&:disabled_[data-slot=input]]:cursor-default [&:disabled_[data-slot=input]]:opacity-75 [&:disabled_[data-slot=textarea]]:cursor-default [&:disabled_[data-slot=textarea]]:opacity-75';

interface SeasonManagerModalProps {
  isOpen: boolean;
  seasons: FarmingSeason[];
  masterFields: MasterField[];
  selectedYear: number;
  onUpdateSeason: (season: FarmingSeason) => void;
  onCloseSeason: (year: number) => void;
  onReopenSeason: (year: number) => void;
  onCreateSeason: (season: FarmingSeason) => void;
}

export const SeasonManagerModal: React.FC<SeasonManagerModalProps> = ({
  isOpen,
  seasons,
  masterFields,
  selectedYear,
  onUpdateSeason,
  onCloseSeason,
  onReopenSeason,
  onCreateSeason
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [editingYear, setEditingYear] = useState<number | null>(null);
  const [expandedYears, setExpandedYears] = useState<Set<number>>(new Set());

  // Form State
  const [formYear, setFormYear] = useState<number | null>(2027);
  const [formName, setFormName] = useState<string>('Hooaeg 2027');
  const [formNotes, setFormNotes] = useState<string>('');

  if (!isOpen) return null;

  // Lukus hooaega saab ainult vaadata: väljad keelatud, salvestusnuppe pole.
  const editingLocked = editingYear !== null && !!seasons.find(s => s.year === editingYear)?.isLocked;

  // Hooajaregistris uusim üleval (ainus koht, kus hooajad on kahanevas järjekorras).
  const sortedSeasons = [...seasons].sort((a, b) => b.year - a.year);

  // Pindala ja põldude arv arvutatakse põldude aastaandmetest (mitte hooaja kirjest).
  const fieldTotalsByYear = new Map<number, { areaHa: number; count: number }>();
  masterFields.forEach((mf) => {
    mf.history.forEach((h) => {
      const t = fieldTotalsByYear.get(h.year) ?? { areaHa: 0, count: 0 };
      t.areaHa += h.areaHa || 0;
      t.count += 1;
      fieldTotalsByYear.set(h.year, t);
    });
  });

  const toggleNotes = (year: number) =>
    setExpandedYears(prev => {
      const next = new Set(prev);
      if (next.has(year)) next.delete(year); else next.add(year);
      return next;
    });

  // Hooaja oleku jaoks: hooaja põllud on selle või eelmise hooaja põllud. Põllul, millel
  // selle aasta kirje puudub (eelmisest hooajast edasi tulnud), on kultuur määramata.
  const seasonCrops = (year: number): (string | null)[] =>
    masterFields
      .filter((mf) => mf.history.some((h) => h.year === year || h.year === year - 1))
      .map((mf) => mf.history.find((h) => h.year === year)?.crop ?? null);

  const handleStartAdd = () => {
    const nextYear = Math.max(...seasons.map(s => s.year), 2026) + 1;
    setFormYear(nextYear);
    setFormName(`Hooaeg ${nextYear}`);
    setFormNotes('');
    setEditingYear(null);
    setIsAdding(true);
  };

  const handleStartEdit = (s: FarmingSeason) => {
    setFormYear(s.year);
    setFormName(s.name);
    setFormNotes(s.notes || '');
    setEditingYear(s.year);
    setIsAdding(true);
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (formYear == null) return;
    if (editingYear !== null) {
      const existing = seasons.find(s => s.year === editingYear);
      if (existing) {
        const updated: FarmingSeason = {
          ...existing,
          name: formName,
          notes: formNotes || null
        };
        onUpdateSeason(updated);
      }
    } else {
      const newSeason: FarmingSeason = {
        id: `season-${formYear}`,
        year: formYear,
        name: formName,
        isLocked: false,
        notes: formNotes || null
      };
      onCreateSeason(newSeason);
    }
    setIsAdding(false);
    setEditingYear(null);
  };

  const bodyContent = (
    <>
      {/* Add / Edit Form eraldi aknas registri peal */}
      {isAdding && (
        <Dialog open onOpenChange={(open) => { if (!open) { setIsAdding(false); setEditingYear(null); } }}>
          <DialogContent size="md">
            <DialogForm onSubmit={handleSaveForm}>
              <DialogHeader
                icon={editingLocked ? <Lock size={20} /> : <Edit2 size={20} />}
                title={
                  editingLocked
                    ? `Lukus hooaeg: ${editingYear}`
                    : editingYear ? `Muuda hooaega: ${editingYear}` : 'Lisa uus hooaeg'
                }
              />
              <DialogBody>
              <fieldset className={SEASON_FIELDSET} disabled={editingLocked}>
              <FormGrid className="grid-cols-[160px_1fr] gap-3 max-[520px]:grid-cols-1">
                <Field label="Aasta (Hooaeg) *" htmlFor="season-year">
                  <NumberInput
                    id="season-year"
                    integer
                    required
                    min={2020}
                    max={2040}
                    disabled={editingYear !== null}
                    value={formYear}
                    onChange={(yr) => {
                      setFormYear(yr);
                      if (yr != null) setFormName(`Hooaeg ${yr}`);
                    }}
                  />
                </Field>

                <Field label="Hooaja nimetus" htmlFor="season-name">
                  <Input
                    id="season-name"
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                  />
                </Field>

                <Field label="Hooaja märkmed" htmlFor="season-notes" span="full">
                  <Textarea
                    id="season-notes"
                    rows={3}
                    placeholder="Ilmastikuolud, saagikokkuvõte, PRIA toetuste koodid..."
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                  />
                </Field>
              </FormGrid>
              </fieldset>
              </DialogBody>

              {!editingLocked && (
                <DialogFooter>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => { setIsAdding(false); setEditingYear(null); }}
                  >
                    Loobu
                  </Button>
                  <Button type="submit" variant="primary">
                    {editingYear ? 'Salvesta muudatused' : 'Loo hooaeg'}
                  </Button>
                </DialogFooter>
              )}
            </DialogForm>
          </DialogContent>
        </Dialog>
      )}

          {/* Hooaegade tabel: üks rida hooaja kohta, et hooaegu oleks lihtne võrrelda */}
          <Table scroll="fill" bordered>
              <TableHeader>
                <TableRow>
                  <TableHead>Hooaeg</TableHead>
                  <TableHead>Olek</TableHead>
                  <TableHead numeric>Pindala, ha</TableHead>
                  <TableHead numeric>Põlde</TableHead>
                  <TableHead actions><span className="sr-only">Tegevused</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedSeasons.map((season) => {
                  const isCurrent = season.year === selectedYear;
                  const notesOpen = expandedYears.has(season.year);
                  const totals = fieldTotalsByYear.get(season.year);
                  const areaHa = totals?.areaHa ?? null;
                  const meta = SEASON_PHASE_META[deriveSeasonPhase(season.isLocked, seasonCrops(season.year))];

                  return (
                    <React.Fragment key={season.year}>
                    <TableRow
                      selected={isCurrent}
                      className={notesOpen && season.notes ? '[&>td]:border-b-transparent' : undefined}
                      onClick={season.notes ? () => toggleNotes(season.year) : undefined}
                      title={season.notes && !notesOpen ? 'Klõpsa märkuse nägemiseks' : undefined}
                    >
                      <TableCell wrap className="min-w-27.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-base font-medium leading-natural">{season.year}</span>
                          {season.notes && <Info size={13} className="text-subtle" />}
                        </div>
                        {season.name !== `Hooaeg ${season.year}` && (
                          <div className="text-xs leading-natural text-muted-foreground">{season.name}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge tone={meta.tone} title={meta.description}>{meta.label}</Badge>
                      </TableCell>
                      <TableCell numeric className="font-mono text-xs leading-natural">{formatNum(areaHa, 1)}</TableCell>
                      <TableCell numeric className="font-mono text-xs leading-natural">{formatNum(totals?.count ?? null, 0)}</TableCell>
                      <TableCell actions onClick={(e) => e.stopPropagation()}>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleStartEdit(season)}
                          title={season.isLocked ? 'Vaata hooaja andmeid' : 'Muuda hooaja parameetreid'}
                        >
                          <Edit2 size={15} />
                        </Button>
                        {season.isLocked ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => onReopenSeason(season.year)}
                            title={`Hooaeg on lukus${season.closedAt ? ` (suletud ${formatDateTimeTallinn(season.closedAt)}${season.closedBy ? `, ${season.closedBy}` : ''})` : ''} – klõpsa avamiseks`}
                          >
                            <Lock size={15} />
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => onCloseSeason(season.year)}
                            title="Hooaeg on avatud – klõpsa lukustamiseks (lõpeta koristus ja sulge muudatusteks)"
                          >
                            <Unlock size={15} />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                    {notesOpen && season.notes && (
                      <TableRow selected={isCurrent} className="[&>td]:pt-0" onClick={() => toggleNotes(season.year)}>
                        <TableCell colSpan={5} wrap>
                          <div className="flex items-start gap-1.5 text-xs leading-snug text-muted-foreground [&>svg]:mt-0.5 [&>svg]:shrink-0">
                            <Info size={13} />
                            <span>{season.notes}</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                    </React.Fragment>
                  );
                })}
              </TableBody>
          </Table>
          <p className="m-0 w-0 min-w-full text-xs leading-natural text-subtle">
            Märkusega real (<Info size={11} />) näitab klõps märkust. Pindala ja põldude arv tulevad põldude andmetest. Luku ikoon näitab hooaja olekut, klõps lukustab või avab. Lukus hooaega saab muuta pärast avamist.
          </p>
    </>
  );

  return (
    <div className="fullpage-board-view">
      <main className="fullpage-board-main">
        <PageHeader
          icon={<CalendarDays />}
          title="Hooajad"
          subtitle="Hooaegade register: aasta, nimi ja märkmed. Importimisel luuakse puuduv hooaeg automaatselt."
          actions={!isAdding ? (
            <Button variant="primary" onClick={handleStartAdd}>
              <Plus size={16} />
              <span>Loo uus hooaeg</span>
            </Button>
          ) : undefined}
        />
        <div className="fullpage-board-body">
          {bodyContent}
        </div>
      </main>
    </div>
  );
};
