// src/components/InfrastructureView.tsx
import React, { useState } from 'react';
import { MapPin, Users } from 'lucide-react';
import { PoiManagerModal } from './PoiManagerModal';
import { RelatedPartiesModal } from './RelatedPartiesModal';
import type { PointOfInterest } from '../types/poi';
import type { RelatedParty } from '../types/party';
import type { MasterField } from '../types/fieldRegister';
import type { Vehicle } from '../types/fleet';

interface InfrastructureViewProps {
  pois: PointOfInterest[];
  onAddPoi: (poi: Omit<PointOfInterest, 'id' | 'createdAt'>) => void;
  onUpdatePoi: (id: string, updated: Partial<PointOfInterest>) => void;
  onDeletePoi: (id: string) => void;
  onFocusPoi: (poi: PointOfInterest) => void;
  onStartPickLocation: (currentDraft: any) => void;
  initialDraft?: any;
  initialCoords?: [number, number] | null;
  parties: RelatedParty[];
  onSaveParty: (party: RelatedParty) => void;
  onDeleteParty: (partyId: string) => void;
  masterFields?: MasterField[];
  vehicles?: Vehicle[];
  selectedYear?: number;
}

export const InfrastructureView: React.FC<InfrastructureViewProps> = ({
  pois,
  onAddPoi,
  onUpdatePoi,
  onDeletePoi,
  onFocusPoi,
  onStartPickLocation,
  initialDraft,
  initialCoords,
  parties,
  onSaveParty,
  onDeleteParty,
  masterFields = [],
  vehicles = [],
  selectedYear = 2026
}) => {
  const [subTab, setSubTab] = useState<'poi' | 'parties'>('poi');

  return (
    <div className="fullpage-board-view">
      <main className="fullpage-board-main wide">
        <div className="fullpage-board-header">
          <div className="fullpage-title-wrap">
            <MapPin className="text-emerald" size={26} />
            <div>
              <h2>Taristu</h2>
              <p className="fullpage-subtitle">
                Olulised asukohad, tugipunktid ning seotud isikute ja partnerite kontaktid
              </p>
            </div>
          </div>

          <nav className="fullpage-tabs" aria-label="Taristu jaotised">
            <button
              type="button"
              className={`fullpage-tab ${subTab === 'poi' ? 'active' : ''}`}
              onClick={() => setSubTab('poi')}
            >
              <MapPin size={16} />
              <span>Taristu punktid</span>
            </button>
            <button
              type="button"
              className={`fullpage-tab ${subTab === 'parties' ? 'active' : ''}`}
              onClick={() => setSubTab('parties')}
            >
              <Users size={16} />
              <span>Seotud isikud</span>
            </button>
          </nav>
        </div>

        <div className="fullpage-board-body">
          {subTab === 'poi' && (
            <PoiManagerModal
              isOpen={true}
              isFullPage={true}
              embedded={true}
              onClose={() => {}}
              pois={pois}
              onAddPoi={onAddPoi}
              onUpdatePoi={onUpdatePoi}
              onDeletePoi={onDeletePoi}
              onFocusPoi={onFocusPoi}
              onStartPickLocation={onStartPickLocation}
              initialDraft={initialDraft}
              initialCoords={initialCoords}
            />
          )}

          {subTab === 'parties' && (
            <RelatedPartiesModal
              isOpen={true}
              isFullPage={true}
              embedded={true}
              onClose={() => {}}
              parties={parties}
              onSaveParty={onSaveParty}
              onDeleteParty={onDeleteParty}
              masterFields={masterFields}
              vehicles={vehicles}
              selectedYear={selectedYear}
            />
          )}
        </div>
      </main>
    </div>
  );
};
