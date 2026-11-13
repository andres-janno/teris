// src/components/PoiManagerModal.tsx
import React, { useState, useEffect } from 'react';
import { NumberInput } from './NumberInput';
import {
  MapPin,
  Plus,
  Trash2,
  Crosshair,
  Download,
  Info,
  Check,
  Edit2
} from 'lucide-react';
import type { PointOfInterest, PoiCategory } from '../types/poi';
import { confirmDialog, alertDialog } from './ConfirmDialog';
import { Button, Dialog, DialogContent, DialogHeader, DialogBody, DialogFooter, DialogForm } from './ui';

interface PoiManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  pois: PointOfInterest[];
  onAddPoi: (poi: Omit<PointOfInterest, 'id' | 'createdAt'>) => void;
  onUpdatePoi: (id: string, updated: Partial<PointOfInterest>) => void;
  onDeletePoi: (id: string) => void;
  onFocusPoi: (poi: PointOfInterest) => void;
  onStartPickLocation: (currentDraft: {
    id?: string;
    name: string;
    category: PoiCategory;
    position: [number, number];
    description?: string;
    capacity?: string;
    contactPerson?: string;
    phone?: string;
    accessNotes?: string;
    radiusM?: number;
  }) => void;
  initialDraft?: {
    id?: string;
    name?: string;
    category?: PoiCategory;
    position?: [number, number];
    description?: string;
    capacity?: string;
    contactPerson?: string;
    phone?: string;
    accessNotes?: string;
    radiusM?: number;
  } | null;
  initialCoords?: [number, number] | null;
}

const CATEGORY_META: Record<PoiCategory, { label: string; emoji: string }> = {
  dryer: { label: 'Kuivati / Viljahoidla', emoji: '🌾' },
  water_point: { label: 'Veepunkt', emoji: '💧' },
  workshop: { label: 'Töökoda', emoji: '🔧' },
  fuel_station: { label: 'Tankla', emoji: '⛽' },
  warehouse: { label: 'Väetis', emoji: '📦' },
  other: { label: 'Muu', emoji: '📍' }
};

export const PoiManagerModal: React.FC<PoiManagerModalProps> = ({
  isOpen,
  onClose,
  pois,
  onAddPoi,
  onUpdatePoi,
  onDeletePoi,
  onFocusPoi,
  onStartPickLocation,
  initialDraft,
  initialCoords,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form fields
  const [name, setName] = useState('');
  const [category, setCategory] = useState<PoiCategory>('dryer');
  const [lat, setLat] = useState<number | null>(58.138);
  const [lng, setLng] = useState<number | null>(25.882);
  const [description, setDescription] = useState('');
  const [capacity, setCapacity] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [accessNotes, setAccessNotes] = useState('');
  const [radiusM, setRadiusM] = useState<number | null>(25);

  // Handle incoming draft or coordinates
  useEffect(() => {
    if (initialDraft) {
      setIsAdding(true);
      setEditingId(initialDraft.id || null);
      if (initialDraft.name !== undefined) setName(initialDraft.name);
      if (initialDraft.category !== undefined) setCategory(initialDraft.category);
      if (initialDraft.position) {
        setLat(initialDraft.position[0]);
        setLng(initialDraft.position[1]);
      }
      if (initialDraft.description !== undefined) setDescription(initialDraft.description);
      if (initialDraft.capacity !== undefined) setCapacity(initialDraft.capacity);
      if (initialDraft.contactPerson !== undefined) setContactPerson(initialDraft.contactPerson);
      if (initialDraft.phone !== undefined) setPhone(initialDraft.phone);
      if (initialDraft.accessNotes !== undefined) setAccessNotes(initialDraft.accessNotes);
      if (initialDraft.radiusM !== undefined) setRadiusM(initialDraft.radiusM);
    } else if (initialCoords) {
      setIsAdding(true);
      setLat(initialCoords[0]);
      setLng(initialCoords[1]);
    }
  }, [initialDraft, initialCoords, isOpen]);

  if (!isOpen) return null;

  const filteredPois = selectedCategory === 'all'
    ? pois
    : pois.filter(p => p.category === selectedCategory);

  const handleStartAdd = () => {
    setEditingId(null);
    setName('');
    setCategory('dryer');
    setLat(58.138);
    setLng(25.882);
    setDescription('');
    setCapacity('');
    setContactPerson('');
    setPhone('');
    setAccessNotes('');
    setRadiusM(25);
    setIsAdding(true);
  };

  const handleStartEdit = (poi: PointOfInterest) => {
    setEditingId(poi.id);
    setName(poi.name);
    setCategory(poi.category);
    setLat(poi.position[0]);
    setLng(poi.position[1]);
    setDescription(poi.description || '');
    setCapacity(poi.capacity || '');
    setContactPerson(poi.contactPerson || '');
    setPhone(poi.phone || '');
    setAccessNotes(poi.accessNotes || '');
    setRadiusM(poi.radiusM ?? 25);
    setIsAdding(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    // Koordinaadid on kohustuslikud
    if (lat == null || lng == null) {
      void alertDialog('Sisesta laius- ja pikkuskraad või vali asukoht kaardilt.');
      return;
    }
    const radius = Math.min(1000, Math.max(5, Math.round(Number(radiusM)) || 25));

    if (editingId) {
      onUpdatePoi(editingId, {
        name: name.trim(),
        category,
        position: [lat, lng],
        description: description.trim() || undefined,
        capacity: capacity.trim() || undefined,
        contactPerson: contactPerson.trim() || undefined,
        phone: phone.trim() || undefined,
        accessNotes: accessNotes.trim() || undefined,
        radiusM: radius
      });
    } else {
      onAddPoi({
        name: name.trim(),
        category,
        position: [lat, lng],
        description: description.trim() || undefined,
        capacity: capacity.trim() || undefined,
        contactPerson: contactPerson.trim() || undefined,
        phone: phone.trim() || undefined,
        accessNotes: accessNotes.trim() || undefined,
        radiusM: radius,
        isActive: true
      });
    }

    setIsAdding(false);
    setEditingId(null);
  };

  const handlePickOnMap = () => {
    onStartPickLocation({
      id: editingId || undefined,
      name,
      category,
      position: [lat ?? 58.138, lng ?? 25.882],
      description,
      capacity,
      contactPerson,
      phone,
      accessNotes,
      radiusM: radiusM ?? 25
    });
  };

  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(pois, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', 'agrimap_poi_taristu.json');
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const bodyContent = (
    <div className="fullpage-board-content">
          {/* Action Bar */}
          <div className="poi-top-bar">
            {/* Category tabs */}
            <div className="category-filter-tabs">
              <button
                className={`filter-tab ${selectedCategory === 'all' ? 'active' : ''}`}
                onClick={() => setSelectedCategory('all')}
              >
                Kõik ({pois.length})
              </button>
              {(Object.keys(CATEGORY_META) as PoiCategory[]).map((cat) => {
                const count = pois.filter(p => p.category === cat).length;
                return (
                  <button
                    key={cat}
                    className={`filter-tab ${selectedCategory === cat ? 'active' : ''}`}
                    onClick={() => setSelectedCategory(cat)}
                  >
                    <span>{CATEGORY_META[cat].emoji} {CATEGORY_META[cat].label.split('/')[0]}</span>
                    <span className="count-pill">{count}</span>
                  </button>
                );
              })}
            </div>

            <div className="poi-top-actions">
              <Button size="sm"
                onClick={handleExportJson}
                title="Ekspordi JSON failina">
                <Download size={14} />
                <span>Ekspordi</span>
              </Button>
              <Button variant="primary" size="sm"
                onClick={handleStartAdd}>
                <Plus size={14} />
                <span>Lisa uus asukoht</span>
              </Button>
            </div>
          </div>

          {/* Asukoha lisamine/muutmine eraldi aknas registri peal */}
          {isAdding && (
            <Dialog open onOpenChange={(open) => { if (!open) { setIsAdding(false); setEditingId(null); } }}>
              <DialogContent size="lg" className="poi-edit-modal">
                <DialogForm onSubmit={handleSubmit}>
                  <DialogHeader
                    icon={editingId ? <Edit2 size={20} className="text-emerald" /> : <Plus size={20} className="text-emerald" />}
                    title={editingId ? `Muuda asukohta: ${name}` : 'Lisa uus asukoht'}
                  />
                  <DialogBody>

              <div className="form-header-row">
                <Button type="button"
                  size="sm" className="btn-pick-map-highlight"
                  onClick={handlePickOnMap}
                  title="Vali täpne asukoht kaardilt klõpsates">
                  <Crosshair size={14} className="text-emerald" />
                  <span>Vali asukoht kaardilt</span>
                </Button>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label>Nimi *</label>
                  <input
                    type="text"
                    required
                    placeholder="nt Loisu vesi või Riidaja kuivati"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label>Kategooria</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as PoiCategory)}
                    className="form-input"
                  >
                    {(Object.keys(CATEGORY_META) as PoiCategory[]).map((cat) => (
                      <option key={cat} value={cat}>
                        {CATEGORY_META[cat].emoji} {CATEGORY_META[cat].label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Laiuskraad (Lat WGS84)</label>
                  <NumberInput value={lat} onChange={setLat} decimals={6} />
                </div>

                <div className="form-group">
                  <label>Pikkuskraad (Lng WGS84)</label>
                  <NumberInput value={lng} onChange={setLng} decimals={6} />
                </div>

                <div className="form-group">
                  <label>Raadius, m</label>
                  <NumberInput
                    integer
                    min={5}
                    max={1000}
                    value={radiusM}
                    onChange={setRadiusM}
                    title="Sõidu punkt selle kauguse piires loetakse objekti juures olevaks (5–1000 m, vaikimisi 25)"
                  />
                </div>

                <div className="form-group">
                  <label>Mahutavus / Jõudlus</label>
                  <input
                    type="text"
                    placeholder="nt 40 m³ mahuti / 1000 L/min"
                    value={capacity}
                    onChange={(e) => setCapacity(e.target.value)}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label>Kontaktisik & Telefon</label>
                  <div className="input-split">
                    <input
                      type="text"
                      placeholder="Nimi"
                      value={contactPerson}
                      onChange={(e) => setContactPerson(e.target.value)}
                      className="form-input"
                    />
                    <input
                      type="text"
                      placeholder="+372 555..."
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="form-input"
                    />
                  </div>
                </div>

                <div className="form-group full-width">
                  <label>Kirjeldus</label>
                  <textarea
                    rows={2}
                    placeholder="nt tootmisbaas, masinakuur ja töökoda"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="form-input"
                  />
                </div>

                <div className="form-group full-width">
                  <label>Ligipääsujuhis (suurtele pritsidele/veokitele)</label>
                  <textarea
                    rows={2}
                    placeholder="Ligipääs maanteelt 24198, kõvakattega ringtee..."
                    value={accessNotes}
                    onChange={(e) => setAccessNotes(e.target.value)}
                    className="form-input"
                  />
                </div>
              </div>

                  </DialogBody>

                  <DialogFooter>
                    <Button type="button"
                      variant="ghost"
                      onClick={() => {
                        setIsAdding(false);
                        setEditingId(null);
                      }}>
                      Loobu
                    </Button>
                    <Button type="submit" variant="primary">
                      <Check size={14} />
                      <span>{editingId ? 'Salvesta muudatused' : 'Lisa asukoht'}</span>
                    </Button>
                  </DialogFooter>
                </DialogForm>
              </DialogContent>
            </Dialog>
          )}

          {/* Asukohad kaartidena (sama stiil nagu Tehnika lehel) */}
          {filteredPois.length === 0 ? (
            <div className="empty-state">
              <Info size={24} className="text-muted" />
              <p>Selles kategoorias pole ühtegi asukohta lisatud.</p>
            </div>
          ) : (
            <div className="vehicle-grid">
              {filteredPois.map((p) => {
                const meta = CATEGORY_META[p.category] || CATEGORY_META.other;
                return (
                  <div key={p.id} className="vehicle-card glass-card" onClick={() => handleStartEdit(p)}>
                    <div className="v-card-header">
                      <div className="v-title-wrap">
                        <div className="v-avatar card-emoji-avatar">{meta.emoji}</div>
                        <div>
                          <h4 className="v-name">{p.name}</h4>
                          <span className="v-model">{meta.label}</span>
                        </div>
                      </div>
                      <div className="card-header-actions">
                        <Button variant="ghost" size="icon-sm"
                          title="Näita kaardil"
                          aria-label="Näita kaardil"
                          onClick={(e) => {
                            e.stopPropagation();
                            onFocusPoi(p);
                            onClose();
                          }}>
                          <Crosshair size={14} />
                        </Button>
                        <Button variant="ghost" size="icon-sm"
                          title="Muuda andmeid või asukohta"
                          aria-label="Muuda"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartEdit(p);
                          }}>
                          <Edit2 size={14} />
                        </Button>
                        <Button variant="danger-ghost" size="icon-sm"
                          title="Kustuta"
                          aria-label="Kustuta"
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (await confirmDialog(`Kas soovid kindlasti kustutada asukoha "${p.name}"?`)) onDeletePoi(p.id);
                          }}>
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </div>

                    <div className="v-info-rows">
                      {p.description && <div className="v-info-item card-info-text">{p.description}</div>}
                      {p.capacity && (
                        <div className="v-info-item"><span className="text-muted">Mahutavus:</span> <strong>{p.capacity}</strong></div>
                      )}
                      {(p.contactPerson || p.phone) && (
                        <div className="v-info-item">
                          <span className="text-muted">Kontakt:</span>
                          <strong>{p.contactPerson || '–'}</strong>
                          {p.phone && (
                            <a href={`tel:${p.phone}`} onClick={(e) => e.stopPropagation()}>{p.phone}</a>
                          )}
                        </div>
                      )}
                      {p.accessNotes && (
                        <div className="v-info-item"><span className="text-muted">Ligipääs:</span> <span>{p.accessNotes}</span></div>
                      )}
                      <div className="v-info-item text-muted">
                        <MapPin size={13} />
                        <span>{p.position[0].toFixed(5)}, {p.position[1].toFixed(5)}</span>
                      </div>
                      <div className="v-info-item"><span className="text-muted">Raadius:</span> <strong>{p.radiusM ?? 25} m</strong></div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
  );

  return (
    <div className="fullpage-board-view">
      <main className="fullpage-board-main wide">
        <div className="fullpage-board-header">
          <div className="fullpage-title-wrap">
            <MapPin className="text-emerald" size={26} />
            <div>
              <h2>Taristu</h2>
              <p className="fullpage-subtitle">Kuivatid, veevõtukohad, töökojad, tanklad ja laod</p>
            </div>
          </div>
        </div>
        <div className="fullpage-board-body">
          {bodyContent}
        </div>
      </main>
    </div>
  );
};
