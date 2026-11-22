import React from 'react';
import {
  Layers,
  Tractor,
  MapPin,
  CalendarDays,
  Sprout,
  Map as MapIcon,
  SquareKanban,
  Users,
  Package,
  Repeat,
  CloudSun,
  BookOpen
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button, NavSwitch, NavSwitchItem, cn } from './ui';
import { headerNarrowHiddenClass, headerTriggerClass } from './ui/variants';
import { TerisLogo } from './TerisLogo';
import { UserMenu } from './UserMenu';
import { OperatorSelector } from './OperatorSelector';
import type { FarmingSeason } from '../types/season';
import type { RelatedParty } from '../types/party';
import type { AuthUser } from '../types/auth';

export const MAIN_VIEWS = ['map', 'seasons', 'fields', 'crops', 'rotation', 'works', 'fleet', 'infrastructure', 'parties', 'stock', 'weather'] as const;
// `guide` (Juhend) pole peamenüü kirje ega salvestu localStorage'isse: avaneb URL-i hash'iga (src/help/guideRoute.ts)
export type MainView = typeof MAIN_VIEWS[number] | 'guide';

// Peamenüü kirjed järjekorras; Ilm näidatakse ainult siis, kui `showWeather`.
const NAV_ITEMS: { view: MainView; label: string; Icon: LucideIcon }[] = [
  { view: 'map', label: 'Kaart', Icon: MapIcon },
  { view: 'fields', label: 'Põllud', Icon: Layers },
  { view: 'crops', label: 'Kultuurid', Icon: Sprout },
  { view: 'rotation', label: 'Külvikord', Icon: Repeat },
  { view: 'works', label: 'Põllutööd', Icon: SquareKanban },
  { view: 'stock', label: 'Laoarvestus', Icon: Package },
  { view: 'fleet', label: 'Tehnika', Icon: Tractor },
  { view: 'infrastructure', label: 'Taristu', Icon: MapPin },
  { view: 'parties', label: 'Isikud', Icon: Users },
  { view: 'weather', label: 'Ilm', Icon: CloudSun },
  { view: 'seasons', label: 'Hooajad', Icon: CalendarDays },
];

interface HeaderProps {
  fieldsCount?: number;
  totalAreaHa?: number;
  workedAreaHa?: number;
  activeVehiclesCount?: number;
  poiCount?: number;
  partiesCount?: number;
  parties?: RelatedParty[];
  cropsCount?: number;
  varietiesCount?: number;
  operatorFilter?: string[];
  onOperatorFilterChange?: (partyIds: string[]) => void;
  selectedYear?: number;
  activeSeason?: FarmingSeason;
  onOpenSeasonManager?: () => void;
  onOpenFieldsRegister?: () => void;
  onOpenParties?: () => void;
  onOpenCrops?: () => void;
  mainView?: MainView;
  onChangeMainView?: (view: MainView) => void;
  onOpenVehicles?: () => void;
  onOpenPoi?: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  dbConnected?: boolean;
  currentUser?: AuthUser;
  onChangePassword?: () => void;
  onOpenAiConnection?: () => void;
  onOpenUsers?: () => void;
  onOpenWeatherCredential?: () => void;
  onLogout?: () => void;
  showWeather?: boolean;
  onOpenGuide?: () => void;
  guideOpen?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  parties = [],
  operatorFilter = [],
  onOperatorFilterChange,
  mainView = 'map',
  onChangeMainView,
  theme,
  onToggleTheme,
  dbConnected = false,
  currentUser,
  onChangePassword,
  onOpenAiConnection,
  onOpenUsers,
  onOpenWeatherCredential,
  onLogout,
  showWeather = false,
  onOpenGuide,
  guideOpen = false
}) => {
  return (
    <header className="z-1000 flex h-16 items-center justify-between border-b border-border bg-white/95 px-4 backdrop-blur-md transition-colors duration-250 dark:bg-background/90">
      {/* Logo klõps laeb lehe uuesti algolekusse (kaardivaade, nagu uues brauseris avamine) */}
      <a href="/" className="flex shrink-0 items-center gap-3 no-underline" title="Ava TERIS algusest" onClick={() => onChangeMainView?.('map')}>
        <TerisLogo variant="responsive" />
      </a>

      {/* Menüü on logo ja paremal olevate nuppude vahelise ruumi keskel */}
      <div className="flex min-w-0 flex-1 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {onChangeMainView && (
          <NavSwitch className="mx-auto" aria-label="Põhivaade">
            {NAV_ITEMS.filter((item) => item.view !== 'weather' || showWeather).map(({ view, label, Icon }) => (
              <NavSwitchItem key={view} current={mainView === view} onClick={() => onChangeMainView(view)}>
                <Icon size={15} />
                <span>{label}</span>
              </NavSwitchItem>
            ))}
          </NavSwitch>
        )}
      </div>

      <div className="flex items-center gap-2.5">
        {onOperatorFilterChange && (
          <OperatorSelector parties={parties} selected={operatorFilter} onChange={onOperatorFilterChange} />
        )}

        {onOpenGuide && (
          <Button variant="ghost" className={cn(headerTriggerClass)} aria-pressed={guideOpen} aria-label="Juhend" title="Juhend" onClick={onOpenGuide}>
            <BookOpen size={14} />
            <span className={headerNarrowHiddenClass}>Juhend</span>
          </Button>
        )}

        {currentUser && (
          <UserMenu
            user={currentUser}
            theme={theme}
            onToggleTheme={onToggleTheme}
            onChangePassword={onChangePassword}
            onOpenAiConnection={onOpenAiConnection}
            onOpenUsers={onOpenUsers}
            onOpenWeatherCredential={onOpenWeatherCredential}
            onLogout={onLogout}
            dbConnected={dbConnected}
          />
        )}
      </div>
    </header>
  );
};
