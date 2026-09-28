// src/components/RelatedPartiesModal.tsx
import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Users,
  Search,
  Plus,
  Edit2,
  Trash2,
  Building2,
  Phone,
  Mail,
  CreditCard,
  AlertCircle,
  Link2
} from 'lucide-react';
import type { RelatedParty, PartyType, PartyRole } from '../types/party';
import { PARTY_ROLE_CONFIG } from '../types/party';
import type { MasterField } from '../types/fieldRegister';
import type { Vehicle } from '../types/fleet';

interface RelatedPartiesModalProps {
  isOpen: boolean;
  onClose: () => void;
  parties: RelatedParty[];
  onSaveParty: (party: RelatedParty) => void;
  onDeleteParty: (partyId: string) => void;
  masterFields?: MasterField[];
  vehicles?: Vehicle[];
  selectedYear?: number;
  // Avatud teise akna (nt põllu muutmise) pealt — kuvatakse kõige peal.
  stacked?: boolean;
}

const ALL_ROLES: PartyRole[] = ['LANDOWNER', 'DRIVER', 'OPERATOR', 'OTHER'];

export const RelatedPartiesModal: React.FC<RelatedPartiesModalProps> = ({
  isOpen,
  onClose,
  parties,
  onSaveParty,
  onDeleteParty,
  masterFields = [],
  vehicles = [],
  selectedYear = 2026,
  stacked = false
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

      // Find assigned vehicles
      const assignedVehicles = vehicles.filter(
        (v) =>
          v.driverName &&
          (v.driverName.toLowerCase().includes(party.name.toLowerCase()) ||
            party.name.toLowerCase().includes(v.driverName.toLowerCase()))
      );

      return {
        ...party,
        linkedParcels,
        totalAreaHa: Math.round(totalHa * 100) / 100,
        assignedVehicles
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

  // Esc sulgeb ainult muutmisakna (register jääb avatuks).
  useEffect(() => {
    if (!isEditing) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsEditing(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isEditing]);

  if (!isOpen) return null;

  const editForm = isEditing && createPortal(
    <div className={`modal-backdrop sub-modal ${stacked ? 'stacked' : ''}`}>
    <form onSubmit={handleSaveForm} className="modal-content party-edit-modal animate-scale-up">
      <div className="modal-header">
        <div className="modal-title-group">
          <Edit2 size={20} className="text-emerald" />
          <h3>
            {editId ? `Muuda isikut: ${editName}` : 'Lisa uus seotud isik'}
          </h3>
        </div>
        <button className="icon-btn-ghost" type="button" onClick={() => setIsEditing(false)} title="Sulge (Esc)">
          <X size={20} />
        </button>
      </div>

      <div className="modal-body">

      {/* 1. Põhiandmed */}
      <div className="form-sub-header">
        <Building2 size={14} />
        <span>1. Isiku või organisatsiooni põhiandmed</span>
      </div>
      <div className="form-grid">
        <div className="form-group" style={{ gridColumn: 'span 2' }}>
          <label>Nimi või Ärinimi *</label>
          <input
            type="text"
            required
            placeholder="nt Loisu Agro OÜ või Jaan Tamm"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="form-input"
          />
        </div>

        <div className="form-group">
          <label>Isiku liik *</label>
          <select
            value={editType}
            onChange={(e) => setEditType(e.target.value as PartyType)}
            className="form-input"
          >
            <option value="PERSON">👤 Füüsiline isik (Eraisik)</option>
            <option value="LEGAL_ENTITY">🏢 Juriidiline isik (Ettevõte / OÜ / AS)</option>
          </select>
        </div>

        <div className="form-group">
          <label>{editType === 'LEGAL_ENTITY' ? 'Registrikood' : 'Isikukood'}</label>
          <input
            type="text"
            placeholder={editType === 'LEGAL_ENTITY' ? 'nt 10874512' : 'nt 38001010000'}
            value={editCode}
            onChange={(e) => setEditCode(e.target.value)}
            className="form-input"
          />
        </div>

        {editType === 'LEGAL_ENTITY' && (
          <div className="form-group">
            <label>KMKR number (Käibemaksukohustuslane)</label>
            <input
              type="text"
              placeholder="nt EE100874512"
              value={editVatNumber}
              onChange={(e) => setEditVatNumber(e.target.value)}
              className="form-input"
            />
          </div>
        )}
      </div>

      {/* 2. Rollid */}
      <div className="form-sub-header" style={{ marginTop: '16px' }}>
        <Users size={14} />
        <span>2. Rollid ja tegevusalad süsteemis (vali kõik sobivad)</span>
      </div>
      <div className="form-group">
        <div className="party-roles-checkbox-grid">
          {ALL_ROLES.map((role) => {
            const cfg = PARTY_ROLE_CONFIG[role];
            const isSelected = editRoles.includes(role);
            return (
              <div
                key={role}
                className={`party-role-checkbox ${isSelected ? 'selected' : ''}`}
                onClick={() => toggleRole(role)}
                style={{
                  background: isSelected ? 'rgba(16, 185, 129, 0.12)' : undefined,
                  borderColor: isSelected ? 'var(--emerald-500)' : undefined
                }}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => {}}
                />
                <span>{cfg.icon} {cfg.label}</span>
              </div>
            );
          })}
        </div>
      </div>
      <div className="form-group">
        <label>Märkused (nt muu seotud isiku täpsustus, lepingute info)</label>
        <textarea
          rows={2}
          placeholder="nt Raamatupidaja; rendileping L-2024/02 kehtib kuni 2032..."
          value={editNotes}
          onChange={(e) => setEditNotes(e.target.value)}
          className="form-input"
        />
      </div>

      {/* 3. Kontakt- ja finantsandmed */}
      <div className="form-sub-header" style={{ marginTop: '16px' }}>
        <CreditCard size={14} />
        <span>3. Kontakt- ja finantsandmed</span>
      </div>
      <div className="form-grid">
        <div className="form-group">
          <label>Telefoninumber</label>
          <input
            type="tel"
            placeholder="nt +372 5552 9988"
            value={editPhone}
            onChange={(e) => setEditPhone(e.target.value)}
            className="form-input"
          />
        </div>

        <div className="form-group">
          <label>E-posti aadress</label>
          <input
            type="email"
            placeholder="nt info@loisuagro.ee"
            value={editEmail}
            onChange={(e) => setEditEmail(e.target.value)}
            className="form-input"
          />
        </div>

        <div className="form-group" style={{ gridColumn: 'span 2' }}>
          <label>Aadress / Asukoht</label>
          <input
            type="text"
            placeholder="nt Loisu talu, Riidaja küla, Tõrva vald, 68716 Valgamaa"
            value={editAddress}
            onChange={(e) => setEditAddress(e.target.value)}
            className="form-input"
          />
        </div>

        <div className="form-group">
          <label>IBAN Pangakonto (arvelduskonto)</label>
          <input
            type="text"
            placeholder="nt EE452200221054321987"
            value={editBankAccount}
            onChange={(e) => setEditBankAccount(e.target.value)}
            className="form-input"
          />
        </div>

      </div>

      </div>

      <div className="modal-footer">
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => setIsEditing(false)}
        >
          Loobu
        </button>
        <button type="submit" className="btn btn-primary">
          Salvesta isik
        </button>
      </div>
    </form>
    </div>,
    document.body
  );

  return (
    <div className={`modal-backdrop ${stacked ? 'stacked' : ''}`}>
      <div className="modal-content glass-card field-register-modal parties-register-modal animate-scale-up">
        {/* Header - Identical to FieldManagerModal */}
        <div className="modal-header">
          <div className="modal-title-group">
            <Users className="text-emerald" size={24} />
            <div>
              <h3>Seotud isikute register</h3>
              <p className="modal-subtitle">
                Maaomanikud, rendileandjad, masinajuhid, kontaktisikud ja koostööpartnerid ({parties.length} isikut)
              </p>
            </div>
          </div>
          <button className="icon-btn-ghost" onClick={onClose} title="Sulge register">
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {/* Top Row: Quick Stats Bar (Identical pills to FieldManagerModal) */}
          <div className="register-header-controls">
            <div className="register-stats-pills">
              <div className="reg-stat-pill">
                <span className="lbl">Isikuid kokku:</span>
                <strong>{stats.total} tk</strong>
                <span className="sub-val" style={{ color: 'var(--text-muted)' }}>
                  ({stats.personsCount} eraisikut • {stats.companiesCount} ettevõtet)
                </span>
              </div>

              <div className="reg-stat-pill highlight">
                <span className="lbl">🏛️ Maaomanikke:</span>
                <strong>{stats.landownersCount} tk</strong>
                <span className="sub-val text-emerald">({stats.totalRentedAreaHa} ha seotud maad)</span>
              </div>

              <div className="reg-stat-pill tenure-owned">
                <span className="lbl">🚜 Töötajaid:</span>
                <strong>{stats.driversCount} tk</strong>
              </div>
            </div>
          </div>

          {/* Search, Filters & Actions Bar (Identical toolbar to FieldManagerModal) */}
          <div className="register-actions-bar">
            <div className="search-box-wrap">
              <Search size={16} className="search-icon" />
              <input
                type="text"
                placeholder="Otsi nime, isikukoodi, telefoni, katastrit või märkust..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="form-input search-input"
              />
              {searchQuery && (
                <button className="clear-search-btn" onClick={() => setSearchQuery('')}>
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Role filter */}
            <select
              className="form-input filter-select"
              value={selectedRoleFilter}
              onChange={(e) => setSelectedRoleFilter(e.target.value)}
            >
              <option value="all">Kõik rollid ({parties.length})</option>
              <option value="LANDOWNER">🏛️ Maaomanikud ({parties.filter(p => p.roles.includes('LANDOWNER')).length})</option>
              <option value="DRIVER">👤 Töötajad ({parties.filter(p => p.roles.includes('DRIVER')).length})</option>
              <option value="OPERATOR">🧑‍🌾 Operaatorid ({parties.filter(p => p.roles.includes('OPERATOR')).length})</option>
              <option value="OTHER">🤝 Muud seotud isikud ({parties.filter(p => p.roles.includes('OTHER')).length})</option>
            </select>

            {/* Type filter */}
            <select
              className="form-input filter-select"
              value={selectedTypeFilter}
              onChange={(e) => setSelectedTypeFilter(e.target.value)}
            >
              <option value="all">Kõik liigid</option>
              <option value="PERSON">👤 Eraisikud ({parties.filter(p => p.type === 'PERSON').length})</option>
              <option value="LEGAL_ENTITY">🏢 Ettevõtted ({parties.filter(p => p.type === 'LEGAL_ENTITY').length})</option>
            </select>

            <div className="actions-right">
              <button className="btn btn-primary btn-sm" onClick={startCreate}>
                <Plus size={14} />
                <span>Lisa uus seotud isik</span>
              </button>
            </div>
          </div>

          {/* Seotud isikute tabel (sama stiil nagu põldude registris) */}
          <div className="register-table-wrap parties-table-wrap">
            <table className="register-table parties-table">
              <thead>
                <tr>
                  <th>Nimi</th>
                  <th>Rollid</th>
                  <th>Telefon</th>
                  <th>E-post</th>
                  <th className="actions-col">Tegevused</th>
                </tr>
              </thead>
              <tbody>
                {filteredParties.map((party) => {
                  const isCompany = party.type === 'LEGAL_ENTITY';

                  return (
                    <tr key={party.id}>
                      <td className="name-cell">
                        <div className="field-title-line">
                          <span className="field-name">{party.name}</span>
                          <span className="party-type-tag" title={isCompany ? 'Ettevõte' : 'Eraisik'}>
                            {isCompany ? '🏢' : '👤'}
                          </span>
                        </div>
                        {(party.code || party.vatNumber) && (
                          <div className="cell-sub">
                            {party.code && (isCompany ? `Reg: ${party.code}` : `IK: ${party.code}`)}
                            {party.code && party.vatNumber && ' · '}
                            {party.vatNumber && `KMKR: ${party.vatNumber}`}
                          </div>
                        )}
                        {party.notes && <div className="cell-sub party-notes" title={party.notes}>💬 {party.notes}</div>}
                      </td>
                      <td>
                        <div className="field-sub-tags">
                          {party.roles.map((role) => {
                            const cfg = PARTY_ROLE_CONFIG[role];
                            if (!cfg) return null;
                            return (
                              <span
                                key={role}
                                className="sub-tag"
                                style={{
                                  color: cfg.color,
                                  backgroundColor: cfg.bgColor,
                                  borderColor: `${cfg.color}40`,
                                  fontWeight: 600
                                }}
                              >
                                {cfg.icon} {cfg.label}
                              </span>
                            );
                          })}
                        </div>
                      </td>
                      <td>
                        {party.phone ? (
                          <a href={`tel:${party.phone}`} className="party-contact-link" title="Helista">
                            <Phone size={12} className="text-emerald" />
                            <span>{party.phone}</span>
                          </a>
                        ) : (
                          <span className="muted">–</span>
                        )}
                      </td>
                      <td>
                        {party.email ? (
                          <a href={`mailto:${party.email}`} className="party-contact-link" title="Saada e-kiri">
                            <Mail size={12} className="text-blue" />
                            <span>{party.email}</span>
                          </a>
                        ) : (
                          <span className="muted">–</span>
                        )}
                      </td>
                      <td className="actions-col">
                        <div className="row-actions">
                          <button
                            className="icon-btn-ghost"
                            onClick={() => startEdit(party)}
                            title="Muuda isiku andmeid"
                            aria-label="Muuda"
                          >
                            <Edit2 size={15} />
                          </button>
                          {party.usageCount ? (
                            <button
                              className="icon-btn-ghost"
                              onClick={() => {
                                const parts: string[] = [];
                                if (party.assignedVehiclesCount) parts.push(`${party.assignedVehiclesCount} sõidukiga (juht)`);
                                if (party.operatorFieldsCount) parts.push(`${party.operatorFieldsCount} põlluga (operaator)`);
                                if (party.ownedParcelsCount) parts.push(`${party.ownedParcelsCount} katastriüksusega (omanik)`);
                                if (party.poiContactsCount) parts.push(`${party.poiContactsCount} asukohaga (kontakt)`);
                                if (party.performedOperationsCount) parts.push(`${party.performedOperationsCount} põllutööga (teostaja)`);
                                alert(`"${party.name}" on seotud:\n\n${parts.map((p) => `• ${p}`).join('\n')}\n\nKustutamiseks eemalda esmalt need seosed.`);
                              }}
                              title={`Ei saa kustutada — ${party.usageCount} seost süsteemis. Klõpsa, et näha, millised.`}
                            >
                              <Link2 size={14} />
                              <span className="usage-count-badge">{party.usageCount}</span>
                            </button>
                          ) : (
                            <button
                              className="icon-btn-danger"
                              onClick={() => {
                                if (confirm(`Kas soovid kindlasti eemaldada isiku "${party.name}"?`)) {
                                  onDeleteParty(party.id);
                                }
                              }}
                              title="Kustuta isik registrist"
                              aria-label="Kustuta"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filteredParties.length === 0 && (
            <div className="empty-register-state glass-card" style={{ padding: '32px', textAlign: 'center' }}>
              <AlertCircle size={28} className="text-amber" style={{ margin: '0 auto 8px auto' }} />
              <h4 style={{ color: 'var(--text-primary)', marginBottom: '4px' }}>Otsingule vastavaid isikuid ei leitud</h4>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Proovi muuta otsingusõna või vali teine rollifilter.</p>
            </div>
          )}
        </div>

        {editForm}

        <div className="modal-footer">
          <div className="footer-left-info">
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Kuvatakse <strong>{filteredParties.length}</strong> isikut <strong>{parties.length}</strong>-st &bull; Seotud hooaeg: <strong>{selectedYear}</strong>
            </span>
          </div>
          <button className="btn btn-ghost" onClick={onClose}>
            Sulge
          </button>
        </div>
      </div>
    </div>
  );
};
