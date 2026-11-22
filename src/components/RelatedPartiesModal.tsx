// src/components/RelatedPartiesModal.tsx
import React, { useState, useMemo, useEffect } from 'react';
import {
  Users,
  Plus,
  Edit2,
  Trash2,
  Building2,
  Phone,
  Mail,
  CreditCard,
  AlertCircle,
  Link2,
  MessageSquare
} from 'lucide-react';
import type { RelatedParty, PartyType, PartyRole } from '../types/party';
import { PARTY_ROLE_CONFIG } from '../types/party';
import type { MasterField } from '../types/fieldRegister';
import type { Vehicle } from '../types/fleet';
import { confirmDialog, alertDialog } from './ConfirmDialog';
import { ResourceCostFields, isRateValid } from './ResourceCostFields';
import { api } from '../services/api';
import type { Article } from '../types/fieldWork';
import { Button, Card, CardHeader, CardActions, Dialog, DialogContent, DialogHeader, DialogForm, DialogBody, DialogFooter, Badge, EmptyState, FilterClear, FilterSelect, SearchInput, Field, FormGrid, Input, Select, Textarea, CheckboxField, SectionTitle, PageHeader, IconBox, cn } from './ui';
import { cardGridClass, infoCardClass, infoCardTitleWrapClass, infoCardNameClass, infoCardSubClass, infoRowsClass, statChipLabelClass, statChipNumClass, statChipSubClass, registerIconBoxClass, boardViewClass, boardMainClass, boardBodyClass, boardContentClass, boardFooterClass, registerHeaderControlsClass, registerActionsBarClass, searchFieldClass, dialogHeaderControlsClass, dialogActionsBarClass } from './ui/variants';

// Statistikakiip (vana .reg-stat-pill): silt, number, alamväärtus
const STAT_PILL = 'flex items-center gap-1.5 rounded-md border border-border bg-field px-3 py-1.5 text-sm leading-natural';
// Kontaktirida isiku kaardil (vana .party-contact-link/-note)
const CONTACT_ROW = 'flex min-w-0 items-start gap-2 leading-snug text-muted-foreground [&>svg]:mt-0.5 [&>svg]:shrink-0';
// Telefoni ja e-posti link: sama rida, tekst murdub, hõljumisel allajoonitud
const CONTACT_LINK = cn(CONTACT_ROW, 'max-w-full self-start no-underline [&>span]:wrap-anywhere [&:hover>span]:text-foreground [&:hover>span]:underline');

interface RelatedPartiesModalProps {
  isOpen: boolean;
  onClose: () => void;
  parties: RelatedParty[];
  onSaveParty: (party: RelatedParty) => void;
  onDeleteParty: (partyId: string) => void;
  masterFields?: MasterField[];
  vehicles?: Vehicle[];
  selectedYear?: number;
  isFullPage?: boolean;
  canManageFinance?: boolean; // tunnihinda näeb ja muudab ainult finantsõigusega kasutaja
}

const ALL_ROLES: PartyRole[] = ['LANDOWNER', 'DRIVER', 'OPERATOR', 'SUPPLIER', 'OTHER'];

export const RelatedPartiesModal: React.FC<RelatedPartiesModalProps> = ({
  isOpen,
  onClose,
  parties,
  onSaveParty,
  onDeleteParty,
  masterFields = [],
  vehicles = [],
  selectedYear = 2026,
  isFullPage = false,
  canManageFinance = false,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('all');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('all');

  // Form State for creating or editing
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState<PartyType>('PERSON');
  const [editCode, setEditCode] = useState('');
  const [editVatNumber, setEditVatNumber] = useState('');
  const [editRoles, setEditRoles] = useState<PartyRole[]>(['LANDOWNER']);
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editBankAccount, setEditBankAccount] = useState('');
  const [costArticles, setCostArticles] = useState<Article[]>([]);
  const [editServiceId, setEditServiceId] = useState('');
  const [editRate, setEditRate] = useState<number | null>(null);
  // Teenuste valik töötaja vormil
  useEffect(() => {
    api.getArticles().then(setCostArticles).catch(() => setCostArticles([]));
  }, []);
  const [editNotes, setEditNotes] = useState('');

  // Open Edit Form
  const startEdit = (party: RelatedParty) => {
    setEditId(party.id);
    setEditName(party.name);
    setEditType(party.type);
    setEditCode(party.code || '');
    setEditVatNumber(party.vatNumber || '');
    setEditRoles(party.roles || ['OTHER']);
    setEditPhone(party.phone || '');
    setEditEmail(party.email || '');
    setEditAddress(party.address || '');
    setEditBankAccount(party.bankAccount || '');
    setEditServiceId(party.serviceArticleId ?? '');
    setEditRate(party.hourlyRate ?? null);
    setEditNotes(party.notes || '');
    setIsEditing(true);
  };

  // Open Create Form
  const startCreate = () => {
    setEditId(null);
    setEditName('');
    setEditType('PERSON');
    setEditCode('');
    setEditVatNumber('');
    setEditRoles(['LANDOWNER']);
    setEditPhone('');
    setEditEmail('');
    setEditAddress('');
    setEditBankAccount('');
    setEditServiceId('');
    setEditRate(null);
    setEditNotes('');
    setIsEditing(true);
  };

  // Toggle role in form
  const toggleRole = (role: PartyRole) => {
    if (editRoles.includes(role)) {
      if (editRoles.length > 1) {
        setEditRoles(editRoles.filter((r) => r !== role));
      }
    } else {
      setEditRoles([...editRoles, role]);
    }
  };

  // Save form
  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) return;
    // Tunnihinna väli on nähtav ainult töötaja rolliga
    if (canManageFinance && editRoles.includes('DRIVER') && !isRateValid(editRate)) { alertDialog('Hind peab olema 0 või suurem'); return; }

    const partyToSave: RelatedParty = {
      id: editId || `party-${Date.now()}`,
      name: editName.trim(),
      type: editType,
      code: editCode.trim() || undefined,
      vatNumber: editVatNumber.trim() || undefined,
      // Ilma rollita kirje on "Muu seotud isik" (täpsustus märkustes).
      roles: editRoles.length > 0 ? editRoles : ['OTHER'],
      phone: editPhone.trim() || undefined,
      email: editEmail.trim() || undefined,
      address: editAddress.trim() || undefined,
      bankAccount: editBankAccount.trim().replace(/\s+/g, '') || undefined,
      serviceArticleId: editRoles.includes('DRIVER') ? (editServiceId || null) : null,
      ...(canManageFinance ? { hourlyRate: editRoles.includes('DRIVER') ? editRate : null } : {}),
      notes: editNotes.trim() || undefined,
      updatedAt: new Date().toISOString()
    };

    onSaveParty(partyToSave);
    setIsEditing(false);
  };

  // Enriched parties with active cadastral & machinery connections
  const enrichedParties = useMemo(() => {
    return parties.map((party) => {
      // Find cadastral parcels linked to this party
      const linkedParcels: { cadastralCode: string; fieldAreaHa: number; fieldName: string }[] = [];
      let totalHa = 0;

      masterFields.forEach((field) => {
        const yearRec = field.history.find((h) => h.year === selectedYear) || field.history[0];
        const parcels = yearRec?.cadastralParcels || field.cadastralParcels || [];

        parcels.forEach((p) => {
          const isOwnerMatch =
            p.ownerName &&
            (p.ownerName.toLowerCase().includes(party.name.toLowerCase()) ||
              party.name.toLowerCase().includes(p.ownerName.toLowerCase()));

          if (isOwnerMatch) {
            linkedParcels.push({
              cadastralCode: p.cadastralCode,
              fieldAreaHa: p.fieldAreaHa,
              fieldName: field.name
            });
            totalHa += p.fieldAreaHa;
          }
        });
      });

      return {
        ...party,
        linkedParcels,
        totalAreaHa: Math.round(totalHa * 100) / 100
      };
    });
  }, [parties, masterFields, vehicles, selectedYear]);

  // Filtered parties list
  const filteredParties = useMemo(() => {
    return enrichedParties.filter((party) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        party.name.toLowerCase().includes(q) ||
        (party.code && party.code.toLowerCase().includes(q)) ||
        (party.phone && party.phone.toLowerCase().includes(q)) ||
        (party.email && party.email.toLowerCase().includes(q)) ||
        (party.bankAccount && party.bankAccount.toLowerCase().includes(q)) ||
        (party.notes && party.notes.toLowerCase().includes(q));

      const matchesRole =
        selectedRoleFilter === 'all' || party.roles.includes(selectedRoleFilter as PartyRole);

      const matchesType =
        selectedTypeFilter === 'all' || party.type === selectedTypeFilter;

      return matchesSearch && matchesRole && matchesType;
    });
  }, [enrichedParties, searchQuery, selectedRoleFilter, selectedTypeFilter]);

  // Overall statistics
  const stats = useMemo(() => {
    let landownersCount = 0;
    let driversCount = 0;
    let companiesCount = 0;
    let personsCount = 0;
    let totalRentedAreaHa = 0;

    enrichedParties.forEach((p) => {
      if (p.type === 'LEGAL_ENTITY') companiesCount++;
      else personsCount++;

      if (p.roles.includes('LANDOWNER')) {
        landownersCount++;
        totalRentedAreaHa += p.totalAreaHa || 0;
      }
      if (p.roles.includes('DRIVER')) driversCount++;
    });

    return {
      total: enrichedParties.length,
      landownersCount,
      driversCount,
      companiesCount,
      personsCount,
      totalRentedAreaHa: Math.round(totalRentedAreaHa * 100) / 100
    };
  }, [enrichedParties]);

  if (!isOpen && !isFullPage) return null;

  const editForm = isEditing && (
    <Dialog open onOpenChange={(open) => { if (!open) setIsEditing(false); }}>
    <DialogContent size="lg">
    <DialogForm onSubmit={handleSaveForm}>
      <DialogHeader
        icon={<Edit2 size={20} />}
        title={editId ? `Muuda isikut: ${editName}` : 'Lisa uus seotud isik'}
      />

      <DialogBody>

      {/* 1. Põhiandmed */}
      <SectionTitle ruled>
        <Building2 size={14} />
        <span>1. Isiku või organisatsiooni põhiandmed</span>
      </SectionTitle>
      <FormGrid>
        <Field label="Nimi või Ärinimi *" htmlFor="party-name" span="full">
          <Input
            id="party-name"
            type="text"
            required
            placeholder="nt Loisu Agro OÜ või Jaan Tamm"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
          />
        </Field>

        <Field label="Isiku liik *" htmlFor="party-type">
          <Select
            id="party-type"
            value={editType}
            onValueChange={(v) => setEditType(v as PartyType)}
            options={[
              { value: 'PERSON', label: '👤 Füüsiline isik (Eraisik)' },
              { value: 'LEGAL_ENTITY', label: '🏢 Juriidiline isik (Ettevõte / OÜ / AS)' },
            ]}
          />
        </Field>

        <Field label={editType === 'LEGAL_ENTITY' ? 'Registrikood' : 'Isikukood'} htmlFor="party-code">
          <Input
            id="party-code"
            type="text"
            placeholder={editType === 'LEGAL_ENTITY' ? 'nt 10874512' : 'nt 38001010000'}
            value={editCode}
            onChange={(e) => setEditCode(e.target.value)}
          />
        </Field>

        {editType === 'LEGAL_ENTITY' && (
          <Field label="KMKR number (Käibemaksukohustuslane)" htmlFor="party-vat">
            <Input
              id="party-vat"
              type="text"
              placeholder="nt EE100874512"
              value={editVatNumber}
              onChange={(e) => setEditVatNumber(e.target.value)}
            />
          </Field>
        )}
      </FormGrid>

      {/* 2. Rollid */}
      <SectionTitle ruled spaced>
        <Users size={14} />
        <span>2. Rollid ja tegevusalad süsteemis (vali kõik sobivad)</span>
      </SectionTitle>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-2 rounded-sm border border-border bg-field p-2.5">
        {ALL_ROLES.map((role) => {
          const cfg = PARTY_ROLE_CONFIG[role];
          const isSelected = editRoles.includes(role);
          return (
            <CheckboxField
              key={role}
              className={cn('items-center gap-2 rounded-sm border border-border bg-card px-2.5 py-1.5 text-sm transition-colors select-none hover:border-primary', isSelected && 'border-primary bg-primary/12')}
              checked={isSelected}
              onCheckedChange={() => toggleRole(role)}
              label={`${cfg.icon} ${cfg.label}`}
            />
          );
        })}
      </div>
      <Field label="Märkused (nt muu seotud isiku täpsustus, lepingute info)" htmlFor="party-notes">
        <Textarea
          id="party-notes"
          rows={2}
          placeholder="nt Raamatupidaja; rendileping L-2024/02 kehtib kuni 2032..."
          value={editNotes}
          onChange={(e) => setEditNotes(e.target.value)}
        />
      </Field>

      {/* 3. Kontakt- ja finantsandmed */}
      <SectionTitle ruled spaced>
        <CreditCard size={14} />
        <span>3. Kontakt- ja finantsandmed</span>
      </SectionTitle>
      <FormGrid>
        <Field label="Telefoninumber" htmlFor="party-phone">
          <Input
            id="party-phone"
            type="tel"
            placeholder="nt +372 5552 9988"
            value={editPhone}
            onChange={(e) => setEditPhone(e.target.value)}
          />
        </Field>

        <Field label="E-posti aadress" htmlFor="party-email">
          <Input
            id="party-email"
            type="email"
            placeholder="nt info@loisuagro.ee"
            value={editEmail}
            onChange={(e) => setEditEmail(e.target.value)}
          />
        </Field>

        <Field label="Aadress / Asukoht" htmlFor="party-address" span="full">
          <Input
            id="party-address"
            type="text"
            placeholder="nt Loisu talu, Riidaja küla, Tõrva vald, 68716 Valgamaa"
            value={editAddress}
            onChange={(e) => setEditAddress(e.target.value)}
          />
        </Field>

        <Field label="IBAN Pangakonto (arvelduskonto)" htmlFor="party-iban">
          <Input
            id="party-iban"
            type="text"
            placeholder="nt EE452200221054321987"
            value={editBankAccount}
            onChange={(e) => setEditBankAccount(e.target.value)}
          />
        </Field>

        {editRoles.includes('DRIVER') && (
          <ResourceCostFields
            serviceKind="LABOR_TIME" articles={costArticles}
            serviceArticleId={editServiceId} onServiceChange={setEditServiceId}
            hourlyRate={editRate} onRateChange={setEditRate} canManageFinance={canManageFinance}
          />
        )}

      </FormGrid>

      </DialogBody>

      <DialogFooter>
        <Button
          type="button"
          variant="ghost"
          onClick={() => setIsEditing(false)}
        >
          Loobu
        </Button>
        <Button type="submit" variant="primary">
          Salvesta isik
        </Button>
      </DialogFooter>
    </DialogForm>
    </DialogContent>
    </Dialog>
  );

  const bodyContent = (
    <>
      {/* Top Row: Quick Stats Bar (Identical pills to FieldManagerModal) */}
          <div className={isFullPage ? registerHeaderControlsClass : dialogHeaderControlsClass}>
            <div className="flex flex-wrap gap-2">
              <div className={STAT_PILL}>
                <span className={statChipLabelClass}>Isikuid kokku:</span>
                <strong className={statChipNumClass}>{stats.total} tk</strong>
                <span className={cn(statChipSubClass, 'text-subtle')}>
                  ({stats.personsCount} eraisikut • {stats.companiesCount} ettevõtet)
                </span>
              </div>

              <div className={cn(STAT_PILL, 'border-primary/35 bg-primary/12')}>
                <span className={statChipLabelClass}>🏛️ Maaomanikke:</span>
                <strong className={cn(statChipNumClass, 'text-success-text')}>{stats.landownersCount} tk</strong>
                <span className={statChipSubClass}>({stats.totalRentedAreaHa} ha seotud maad)</span>
              </div>

              <div className={cn(STAT_PILL, 'border-l-3 border-l-primary')}>
                <span className={statChipLabelClass}>🚜 Töötajaid:</span>
                <strong className={statChipNumClass}>{stats.driversCount} tk</strong>
              </div>
            </div>
          </div>

          {/* Search, Filters & Actions Bar (Identical toolbar to FieldManagerModal) */}
          <div className={isFullPage ? registerActionsBarClass : dialogActionsBarClass}>
            <SearchInput className={isFullPage ? searchFieldClass : undefined} value={searchQuery} onChange={setSearchQuery} placeholder="Otsi nime, isikukoodi, telefoni, katastrit või märkust..." aria-label="Otsi nime, isikukoodi, telefoni, katastrit või märkust..." />

            {/* Role filter */}
            <FilterClear active={selectedRoleFilter !== 'all'} onClear={() => setSelectedRoleFilter('all')}>
              <FilterSelect
                value={selectedRoleFilter}
                defaultValue="all"
                onChange={setSelectedRoleFilter}
                options={[
                  { value: 'all', label: `Kõik rollid (${parties.length})` },
                  { value: 'LANDOWNER', label: `🏛️ Maaomanikud (${parties.filter(p => p.roles.includes('LANDOWNER')).length})` },
                  { value: 'DRIVER', label: `👤 Töötajad (${parties.filter(p => p.roles.includes('DRIVER')).length})` },
                  { value: 'OPERATOR', label: `🧑‍🌾 Operaatorid (${parties.filter(p => p.roles.includes('OPERATOR')).length})` },
                  { value: 'SUPPLIER', label: `🚚 Tarnijad (${parties.filter(p => p.roles.includes('SUPPLIER')).length})` },
                  { value: 'OTHER', label: `🤝 Muud seotud isikud (${parties.filter(p => p.roles.includes('OTHER')).length})` }
                ]}
              />
            </FilterClear>

            {/* Type filter */}
            <FilterClear active={selectedTypeFilter !== 'all'} onClear={() => setSelectedTypeFilter('all')}>
              <FilterSelect
                value={selectedTypeFilter}
                defaultValue="all"
                onChange={setSelectedTypeFilter}
                options={[
                  { value: 'all', label: 'Kõik liigid' },
                  { value: 'PERSON', label: `👤 Eraisikud (${parties.filter(p => p.type === 'PERSON').length})` },
                  { value: 'LEGAL_ENTITY', label: `🏢 Ettevõtted (${parties.filter(p => p.type === 'LEGAL_ENTITY').length})` }
                ]}
              />
            </FilterClear>

            <Button variant="primary" size="sm" onClick={startCreate}>
              <Plus size={14} />
              <span>Lisa uus seotud isik</span>
            </Button>
          </div>

          {/* Seotud isikute tabel (sama stiil nagu põldude registris) */}
          {/* Isikud kaartidena (sama stiil nagu Tehnika lehel) */}
          <div className={cardGridClass}>
            {filteredParties.map((party) => {
              const isCompany = party.type === 'LEGAL_ENTITY';
              const accent = PARTY_ROLE_CONFIG[party.roles[0]]?.color;

              return (
                <Card key={party.id} padding="sm" interactive className={infoCardClass} onClick={() => startEdit(party)}>
                  <CardHeader align="start">
                    <div className={infoCardTitleWrapClass}>
                      <IconBox
                        size="md"
                        className={registerIconBoxClass}
                        style={accent ? { borderColor: accent } : undefined}
                        title={isCompany ? 'Ettevõte' : 'Eraisik'}
                      >
                        {isCompany ? '🏢' : '👤'}
                      </IconBox>
                      <div>
                        <h4 className={infoCardNameClass}>{party.name}</h4>
                        <span className={infoCardSubClass}>
                          {party.code ? (isCompany ? `Reg: ${party.code}` : `IK: ${party.code}`) : (isCompany ? 'Ettevõte' : 'Eraisik')}
                          {party.vatNumber && ` · KMKR: ${party.vatNumber}`}
                        </span>
                      </div>
                    </div>
                    <CardActions>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          startEdit(party);
                        }}
                        title="Muuda isiku andmeid"
                        aria-label="Muuda"
                      >
                        <Edit2 size={14} />
                      </Button>
                      {party.usageCount ? (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            const parts: string[] = [];
                            if (party.operatorFieldsCount) parts.push(`${party.operatorFieldsCount} põlluga (operaator)`);
                            if (party.ownedParcelsCount) parts.push(`${party.ownedParcelsCount} katastriüksusega (omanik)`);
                            alertDialog(`"${party.name}" on seotud:\n\n${parts.map((p) => `• ${p}`).join('\n')}\n\nKustutamiseks eemalda esmalt need seosed.`);
                          }}
                          title={`Ei saa kustutada — ${party.usageCount} seost süsteemis. Klõpsa, et näha, millised.`}
                        >
                          <Link2 size={14} />
                          <Badge tone="danger">{party.usageCount}</Badge>
                        </Button>
                      ) : (
                        <Button
                          variant="danger-ghost"
                          size="icon-sm"
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (await confirmDialog(`Kas soovid kindlasti eemaldada isiku "${party.name}"?`)) {
                              onDeleteParty(party.id);
                            }
                          }}
                          title="Kustuta isik registrist"
                          aria-label="Kustuta"
                        >
                          <Trash2 size={14} />
                        </Button>
                      )}
                    </CardActions>
                  </CardHeader>

                  <div className={infoRowsClass}>
                    {party.roles.length > 0 && (
                      <div className="mb-0.5 flex flex-wrap items-center gap-1.5">
                        {party.roles.map((role) => {
                          const cfg = PARTY_ROLE_CONFIG[role];
                          if (!cfg) return null;
                          return (
                            <Badge key={role} tone={cfg.tone}>
                              {cfg.icon} {cfg.label}
                            </Badge>
                          );
                        })}
                      </div>
                    )}
                    {party.phone && (
                      <a href={`tel:${party.phone}`} className={CONTACT_LINK} title="Helista" onClick={(e) => e.stopPropagation()}>
                        <Phone size={13} />
                        <span>{party.phone}</span>
                      </a>
                    )}
                    {party.email && (
                      <a href={`mailto:${party.email}`} className={CONTACT_LINK} title="Saada e-kiri" onClick={(e) => e.stopPropagation()}>
                        <Mail size={13} />
                        <span>{party.email}</span>
                      </a>
                    )}
                    {party.notes && (
                      <div className={cn(CONTACT_ROW, '[&>svg]:text-subtle')} title={party.notes}>
                        <MessageSquare size={13} />
                        <span className="line-clamp-2 text-muted-foreground">{party.notes}</span>
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>

          {filteredParties.length === 0 && (
            <EmptyState icon={<AlertCircle size={28} />} title="Otsingule vastavaid isikuid ei leitud" description="Proovi muuta otsingusõna või vali teine rollifilter." />
          )}
    </>
  );

  if (isFullPage) {
    return (
      <div className={boardViewClass}>
        <main className={boardMainClass}>
          <PageHeader
            icon={<Users />}
            title="Isikud"
            helpKey="view.parties"
            subtitle="Maaomanikud, rendileandjad, masinajuhid, kontaktisikud ja koostööpartnerid"
            actions={!isEditing ? (
              <Button
                type="button"
                variant="primary"
                onClick={startCreate}
              >
                <Plus size={16} />
                <span>Lisa uus isik</span>
              </Button>
            ) : undefined}
          />
          <div className={boardBodyClass}>
            {editForm}
            <div className={boardContentClass}>
              {bodyContent}
            </div>
          </div>
          <div className={boardFooterClass}>
            <span>
              Kuvatakse {filteredParties.length} isikut {parties.length}-st &bull; Seotud hooaeg: {selectedYear}
            </span>
          </div>
        </main>
      </div>
    );
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent size="fit" className="flex flex-col min-w-[min(900px,96vw)]">
        <DialogHeader
          icon={<Users size={24} />}
          title="Seotud isikute register"
          description={`Maaomanikud, rendileandjad, masinajuhid, kontaktisikud ja koostööpartnerid (${parties.length} isikut)`}
        />

        <DialogBody>
          {bodyContent}
        </DialogBody>

        {editForm}

        <DialogFooter>
          <div className="mr-auto">
            <span className="text-sm text-muted-foreground">
              Kuvatakse {filteredParties.length} isikut {parties.length}-st &bull; Seotud hooaeg: {selectedYear}
            </span>
          </div>
          <Button variant="ghost" onClick={onClose}>
            Sulge
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
