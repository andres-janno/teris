import React, { useEffect, useState } from 'react';
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
  Menu,
  X
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, NavSwitch, NavSwitchItem, cn } from './ui';
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
  onOpenReleaseNotes?: () => void;
  hasUnreadReleaseNotes?: boolean;
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
  guideOpen = false,
  onOpenReleaseNotes,
  hasUnreadReleaseNotes = false
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const visibleNavItems = NAV_ITEMS.filter((item) => item.view !== 'weather' || showWeather);
  const activeNavItem = visibleNavItems.find((item) => item.view === mainView);

  useEffect(() => {
    if (!mobileMenuOpen || typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(min-width: 1101px)');
    const handleChange = (e: MediaQueryListEvent) => {
      if (e.matches) setMobileMenuOpen(false);
    };
    mq.addEventListener('change', handleChange);
    return () => mq.removeEventListener('change', handleChange);
  }, [mobileMenuOpen]);

  return (
    <header className="z-1000 flex h-16 items-center justify-between border-b border-border bg-white/95 px-4 backdrop-blur-md transition-colors duration-250 dark:bg-background/90">
      {/* Logo klõps laeb lehe uuesti algolekusse (kaardivaade, nagu uues brauseris avamine) */}
      <a href="/" className="flex shrink-0 items-center gap-3 no-underline" title="Ava TERIS algusest" onClick={() => onChangeMainView?.('map')}>
        <TerisLogo variant="responsive" />
      </a>

      {/* Menüü on logo ja paremal olevate nuppude vahelise ruumi keskel; kitsal ekraanil (≤ 1100px) hamburgeri rippmenüü */}
      <div className="flex min-w-0 flex-1 items-center px-4">
        {onChangeMainView && (
          <>
            <div className="hidden min-w-0 flex-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden min-[1101px]:flex">
              <NavSwitch className="mx-auto" aria-label="Põhivaade">
                {visibleNavItems.map(({ view, label, Icon }) => (
                  <NavSwitchItem key={view} current={mainView === view} onClick={() => onChangeMainView(view)}>
                    <Icon size={15} className="max-[1401px]:hidden" />
                    <span>{label}</span>
                  </NavSwitchItem>
                ))}
              </NavSwitch>
            </div>

            <div className="flex min-w-0 items-center min-[1101px]:hidden">
              <DropdownMenu open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    className="max-w-full gap-2 px-2.5"
                    aria-label="Ava peamenüü"
                    title="Peamenüü"
                  >
                    {mobileMenuOpen ? <X size={16} className="shrink-0" /> : <Menu size={16} className="shrink-0" />}
                    <span className="truncate">{activeNavItem?.label ?? (mainView === 'guide' ? 'Juhend' : 'Menüü')}</span>
                  </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent align="start" className="min-w-52">
                  {visibleNavItems.map(({ view, label, Icon }) => {
                    const isCurrent = mainView === view;
                    return (
                      <DropdownMenuItem
                        key={view}
                        aria-current={isCurrent ? 'page' : undefined}
                        className={cn(
                          isCurrent && 'bg-selection font-medium text-white data-[highlighted]:bg-selection data-[highlighted]:text-white'
                        )}
                        onSelect={() => onChangeMainView(view)}
                      >
                        <Icon />
                        <span>{label}</span>
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </>
        )}
      </div>

      <div className="flex items-center gap-2.5">
        {onOperatorFilterChange && (
          <OperatorSelector parties={parties} selected={operatorFilter} onChange={onOperatorFilterChange} />
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
            onOpenGuide={onOpenGuide}
            guideOpen={guideOpen}
            onOpenReleaseNotes={onOpenReleaseNotes}
            hasUnreadReleaseNotes={hasUnreadReleaseNotes}
            onLogout={onLogout}
            dbConnected={dbConnected}
          />
        )}
      </div>
    </header>
  );
};
