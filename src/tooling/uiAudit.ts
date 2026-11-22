// src/tooling/uiAudit.ts — UI ühtlustamise mõõdik: mitu erinevat kirjasuurust, nurka, vahet ja värvikoodi on
// stiilides ning kui palju inline-stiile ja keelatud suvalisi Tailwindi väärtusi komponentides.
// Puhtad funktsioonid; failide lugemine on scripts/ui-audit.mts-is.

export interface AuditReport {
  fontSizes: string[];
  radii: string[];
  spacing: string[];
  cssColors: string[];
  inlineStyles: number;
  tsxColors: number;
  arbitrary: { path: string; cls: string }[];
  offScaleSpacing: { path: string; cls: string }[];
  inlineFontSizes: string[];
  tsxColorFiles: { path: string; count: number }[];
  legacyComponentClasses: string[];
  legacyButtonFiles: { path: string; count: number }[];
  legacyModalFiles: { path: string; count: number }[];
  legacyTableFiles: { path: string; count: number }[];
  legacyBadgeTabFiles: { path: string; count: number }[];
  legacyFormFieldFiles: { path: string; count: number }[];
  legacyMenuPopupFiles: { path: string; count: number }[];
  legacyOverviewFiles: { path: string; count: number }[];
  legacyCardFiles: { path: string; count: number }[];
  rawButtonFiles: { path: string; count: number }[];
  roleButtonFiles: { path: string; count: number }[];
}

// Värv: hex (HTML-i numbriline võrdlusmärk &#8212; välja arvatud) või rgb/rgba/hsl/hsla; muutujaga värve ei loeta.
const COLOR = /(?<!&)#[0-9a-fA-F]{3,8}\b|(?:rgba?|hsla?)\((?:[^()]|\([^()]*\))*\)/gi;
const SPACING_DECL =
  /(?:^|[\s;{])(?:padding|margin|gap|row-gap|column-gap)(?:-(?:top|right|bottom|left|inline|block)(?:-(?:start|end))?)?\s*:\s*([^;}]+)/g;
// Keelatud ainult skaalaga seotud suvalised väärtused (sh negatiivsed ja loogilised vahed); suurused (w-[…])
// ja olekuvariandid (data-[…]:) on lubatud. Eesliide "md:" jätab klassi ilma, sest koolon ei kuulu lookbehindi.
// Hõlmab ka leading- ja Tailwind v4 muutujasüntaksit (text-(--x)) ja külgpiiret (border-t-[…]).
const ARBITRARY =
  /(?<![\w-])-?(?:text|leading|p[xytrblse]?|m[xytrblse]?|gap(?:-[xy])?|rounded(?:-[a-z]{1,2})?|bg|border(?:-[xytrbl])?)-(?:\[[^\]\s]*\]|\(--[\w-]+\))/g;
// Vahe-klass arvuga (p-5, -mt-3.5, md:gap-x-7); `size-`, `h-`, `w-`, `translate-x-` jne ei lähe lookbehindist läbi.
const SPACING_CLASS = /(?<![\w-])(-?(?:p[xytrblse]?|m[xytrblse]?|gap(?:-[xy])?)-(\d+(?:\.\d+)?|px))(?![\w.[(-])/g;
const SPACING_SCALE = new Set(['0', 'px', '0.5', '1', '1.5', '2', '2.5', '3', '4', '6', '8']);
// Vana komponendi klassiselektor CSS-is (spec: nupu/dialoogi/tabeli klassid kustutatakse).
const LEGACY_COMPONENT = /\.((?:btn|modal|badge|pill|tab|data-table|table)[\w-]*)/g;
// Üldised vanad nupuklassid (etapp 2.1). Erinupud (basemap-btn jne) ja paigutusklass btn-full ei loe.
const LEGACY_BUTTON =
  /(?<![\w-])(btn|btn-primary|btn-secondary|btn-ghost|btn-danger|btn-sm|btn-xs|btn-icon-only|icon-btn|icon-btn-ghost|icon-btn-danger|icon-btn-ghost-sm|icon-btn-ghost-xs|btn-disabled)(?![\w-])/g;
// Vanad modaaliklassid (etapp 2.2). Vaatepõhised sisuklassid (finance-modal jne) ei loe.
const LEGACY_MODAL =
  /(?<![\w-])(modal-backdrop|sub-modal|confirm-dialog-backdrop|modal-content|modal-header|modal-title-group|modal-title-with-icon|modal-icon-badge|modal-subtitle|modal-body|modal-footer)(?![\w-])/g;
// Toored tabelielemendid ja vanad tabeliklassid (etapp 2.3). ui/ kausta ei loeta (seal on ui/Table ise).
const LEGACY_TABLE =
  /<(table|thead|tbody|tfoot|tr|th|td)(?=[\s>])|(?<![\w-])(register-table-wrap|register-table|num-col|actions-col|row-actions|clickable-row)(?![\w-])/g;
// Vanad märgi-, saki- ja segmendiklassid (etapp 2.4). ui/ kausta ei loeta. Jääb alles valvurina: peab olema 0.
const LEGACY_BADGE_TAB =
  /(?<![\w-])(status-badge|fleet-active-badge|active-pill|user-status-pill|user-status-dot|season-status-badge|work-phase-badge|support-panel-status|stock-shortage-badge|users-admin-badge|article-default-badge|tenure-badge|cad-tenure-tag|weather-credential-ok|weather-credential-missing|count-pill|finance-count-badge|finance-tab-badge|crop-group-count|usage-count-badge|finance-year-badge|mini-badge|badge-list|sub-tag|winter-tag|field-num-badge|finance-field-badge|field-code-badge|equipment-tag|finance-kind-badge|finance-crop-pill|year-widget-stat|telemetry-pill-impl|telemetry-pill-time|telemetry-pill-action|category-filter-tabs|filter-tab|year-tabs|year-tab|work-register-tabs|finance-filter-chips|finance-filter-chip|segmented-control|segmented-option|cc-segmented|year-widget-pills|year-widget-btn|area-preset-btn|tab-lock-icon|pill-lock-icon)(?![\w-])/g;
// Toored vormielemendid ja vanad vormiklassid (etapp 2.5). ui/ kausta ei loeta (seal on ka DateInput, NumberInput,
// FilterSelect). Lubatud toored: <input type="file"> ja <input type="range"> (type esimese atribuudina).
// Jääb alles valvurina: peab olema 0.
const LEGACY_FORM_FIELD =
  /<(input|select|textarea)(?=[\s>/])(?![^>]*\btype="(?:file|range|color)")|(?<![\w-])(form-input|form-group|form-grid|form-row-3|input-split|input-with-unit|search-input|search-box-wrap|auto-resize-textarea|auto-field-input|time-select|users-admin-checkbox|checkbox-label|filter-select-trigger|date-input-btn)(?![\w-])/g;
// Käsitsi tehtud menüüd ja hüpikud (etapp 2.6): vanad klassid, käsitsi antud menüürollid ja aria-haspopup.
// ui/ kausta ei loeta. Jääb alles valvurina: peab olema 0. Leafleti hüpikuklassid (popup-row jms) ei loe.
const LEGACY_MENU_POPUP =
  /(?<![\w-])((?:operator-selector|user-menu|map-context-menu|help-hint)[\w-]*)(?![\w-])|role="(menu|menuitem|menuitemcheckbox|menuitemradio|tooltip)"|aria-haspopup=/g;
// Kaardid (etapp 2.7): tsx-is vana klaasikaardi klass; CSS-is nende klasside lihtreegel (ainult klass, ilma oleku
// või järglaseta), mis seab ise välimuse — välimus peab tulema ui/Card-ist, vaate klassis jääb ainult asetus.
// `!important` välimus on teadlik erand (olekuääris, erandnurk) ega loe. Jääb alles valvurina: peab olema 0.
const LEGACY_CARD_TSX = /(?<![\w-])glass-card(?![\w-])/g;
// Toored <button (etapp 3b): kõik nupud tulevad ui komponentidest. ui/ kausta ei loeta. Lubatud erandid
// (failitee lõpp → mitu tohib olla): jääb alles valvurina, väljaspool erandeid peab olema 0.
const RAW_BUTTON = /<button(?=[\s>])/g;
// Kommentaarid (`/* */`, `{/* */}`, rea lõpu `//`) ei loe; `://` (URL) ja jutumärgi järel olev `//` jääb.
const stripComments = (src: string): string => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\w"'`])\/\/.*$/gm, '$1');
export const RAW_BUTTON_ALLOWED: Readonly<Record<string, number>> = {
  'src/components/LoginPage.tsx': 1, // login-forgot-link: tekstilink sisselogimislehel (kasutaja otsus)
  'src/components/MapView.tsx': 1, // Leafleti popup-HTML-string, pole React
};
const overAllowed = (allowed: Readonly<Record<string, number>>, path: string, count: number): number => {
  const key = Object.keys(allowed).find((k) => path.endsWith(k));
  return key ? Math.max(0, count - allowed[key]) : count;
};
const rawButtonsOverAllowed = (path: string, count: number): number => overAllowed(RAW_BUTTON_ALLOWED, path, count);

// `role="button"` väljaspool ui/ (etapp 3c): klõpsatav div/span peab olema Button / CardButton / ChipButton / TableRow.
// Erand ainult siis, kui elemendi sees (või sees, kus ta asub) on teine nupp: pesastatud interaktiivsus ei luba välimist <button>-it.
// Jääb alles valvurina, väljaspool erandeid peab olema 0.
const ROLE_BUTTON = /(?<![\w-])role="button"/g;
export const ROLE_BUTTON_ALLOWED: Readonly<Record<string, number>> = {
  'src/components/LayerControl.tsx': 1, // kaardikihtide päis: sees ikoonnupp (Ahenda/Laienda)
  'src/components/MapYearSelector.tsx': 1, // kultuuride legendi päis: sees ikoonnupp
  'src/components/TripRouteView.tsx': 1, // „Teekond“ lüliti asub soovituse nupu (CardButton) sees
  'src/components/VehicleTracker.tsx': 1, // masinakaardi märkus: kaart ise on interaktiivne (Card interactive), märkus sees
};
const roleButtonsOverAllowed = (path: string, count: number): number => overAllowed(ROLE_BUTTON_ALLOWED, path, count);

// Vana `@media (max-width: N)` = Tailwindi `max-[N+1px]` (max-[…] on range-süntaks: laius < N); sama konteineripäringul `@max-[…]`.
// `min-[Npx]` nihet ei vaja. Vana murdepunkt või ümmargune arv ilma +1-ta on peaaegu kindlasti viga.
const MAX_BREAKPOINT = /(?<![\w-])(@?max-\[(\d+)px\]):/g;
export const OLD_BREAKPOINTS: ReadonlySet<number> = new Set([520, 560, 640, 680, 720, 760, 860, 1100, 1400, 1655]);

/** Murdepunktid, kus +1 puudub: N jagub 10-ga või on tuntud vana max-width. */
export function offByOneBreakpoints(src: string): string[] {
  return [...stripComments(src).matchAll(MAX_BREAKPOINT)]
    .filter((m) => Number(m[2]) % 10 === 0 || OLD_BREAKPOINTS.has(Number(m[2])))
    .map((m) => m[1]);
}
export const LEGACY_CARD_CLASSES: ReadonlySet<string> = new Set([
  'glass-card',
  // ujuvpaneelid kaardi peal
  'add-poi-banner',
  // register- ja loendikaardid
  'history-filter-bar',
  'empty-register-state',
  // KPI ja statistika plaadid
  'trip-tile',
  // sektsioonikastid
  // teenusepakkuja admin (admin-login kustus 4g-s: admin.css kustutatud)
  'admin-login', 'admin-stat',
]);
// Vanad ülevaateklassid (etapp 4.1): päis, jaotise pealkiri, näitaja plaat, legendi kirje, rida „silt: väärtus“ ja
// FinanceModal'i finance-* klassid ja tahvli fw-* klassid (etapp 4b) ja 4c Tehnika/sõitude klassid (RETIRED_4C) ja 4d kaardi paneelide klassid (RETIRED_4D) ja 4e dialoogide klassid (RETIRED_4E) ja 4f päise ja kesta klassid (RETIRED_4F). ui/ kausta ei loeta. Jääb alles valvurina: peab olema 0.
// 4c: Tehnika ja sõitude kustutatud klassid (etapp 4c). Eesliidete asemel täpsed nimed: id-d (`dev-assign-…`, `trip-notes`) ei loe.
// `dev-imei`, `dev-model`, `imp-name` on ka vormiväljade id-d: id="…" ja htmlFor="…" väärtusi regex ei loe (lookbehind).
// Jagatud klass auth-error-banner puudub teadlikult (jääb ühiste etapini). vehicle-card, v-* ja telemetry-suggestion-* viidi 4e-s ära (RETIRED_4E).
export const RETIRED_4C: readonly string[] = [
  'assign-datetime', 'assign-hint', 'assign-hint-active', 'attached-status', 'card-header-right', 'connectivity-type-picker',
  'dev-assign-select', 'dev-assignment-box', 'dev-card-header', 'dev-fresh-dot', 'dev-fresh-legend', 'dev-fresh-legend-item',
  'dev-header-line', 'dev-icon-wrap', 'dev-imei', 'dev-model', 'dev-telemetry-item', 'dev-telemetry-summary', 'dev-telemetry-time',
  'dev-title-wrap', 'device-assign-label', 'device-card', 'device-unassigned-notice', 'devices-grid', 'devices-section',
  'devices-section-title', 'devices-sections', 'dot-idle', 'equipment-slot', 'filter-period', 'fleet-board-body', 'fleet-board-main',
  'fleet-board-view', 'fleet-card-notes', 'fleet-cell-date', 'fleet-cell-date-end', 'fleet-cell-duration', 'fleet-cell-main',
  'fleet-cell-notes', 'fleet-cell-sub', 'fleet-cell-title', 'fleet-edit-modal', 'fleet-form-grid', 'fleet-icon-box', 'fleet-top-bar',
  'footer-start', 'fresh-day', 'fresh-live', 'fresh-none', 'fresh-old', 'fresh-week', 'gauge-item', 'gauge-lbl', 'gauge-text',
  'imp-actions', 'imp-assign-select', 'imp-card-footer', 'imp-card-header', 'imp-icon-wrap', 'imp-meta', 'imp-name',
  'imp-serial-row', 'imp-status-box', 'imp-title-wrap', 'implement-card', 'implement-history-section', 'implements-grid',
  'inline-icon-text', 'option-info', 'swap-modal-card', 'swap-modal-desc', 'swap-option-item', 'swap-option-line',
  'swap-options-list', 'tag-text', 'telemetry-device-id', 'trip-dialog', 'trip-dialog-entry', 'trip-dialog-entry-cell',
  'trip-dialog-fields', 'trip-dialog-fields-wrap', 'trip-dialog-map', 'trip-dialog-visits', 'trip-details', 'trip-gap-count',
  'trip-gap-icon', 'trip-gap-review', 'trip-gap-row', 'trip-gap-text', 'trip-import-status', 'trip-route', 'trip-route-current',
  'trip-route-line', 'trip-route-list', 'trip-route-summary', 'trip-route-time', 'trip-route-toggle', 'trip-route-unknown',
  'trip-stop', 'trip-stop-dot', 'trip-stop-place', 'trip-stop-time', 'trip-stops', 'trip-tiles', 'trip-timesplit',
  'trip-timesplit-bar', 'trip-timesplit-label', 'trip-timesplit-legend', 'trip-timesplit-part', 'unassign-option',
  'v-card-footer', 'v-equipment-badge-row', 'v-gauges-grid', 'with-bottom-gap',
];
// 4d: kaardi paneelide kustutatud klassid (etapp 4d). Täpsed nimed. Jäävad klassid puuduvad teadlikult: crop-legend-item (valitud olek),
// layer-loading-bar (::after), cc-range (liuguri käepide), add-poi-banner (värv). map-top-*-stack jäävad 4f-s: ainult polster map.css-is.
export const RETIRED_4D: readonly string[] = [
  'active-dot', 'basemap-btn', 'basemap-cadastre-toggle', 'basemap-grid', 'basemap-name', 'cadastre-color', 'cc-date', 'cc-header',
  'cc-label', 'cc-link-btn', 'cc-now', 'cc-now-pct', 'cc-now-time', 'cc-notice', 'cc-notice-loading', 'cc-period',
  'cc-period-controls', 'cc-period-icon', 'cc-play-icon', 'cc-player', 'cc-select', 'cc-slider', 'cc-slider-fill', 'cc-spin',
  'cc-start', 'cc-stat', 'cc-stats', 'cc-status-dot', 'cc-time', 'cc-time-bound', 'cc-timeline', 'cc-title', 'cc-title-field',
  'cc-title-name', 'cc-title-status', 'cc-title-text', 'cc-toggle', 'cc-value', 'cc-value-impl', 'cc-value-sub', 'coords-tracker',
  'crop-bar-segment', 'crop-field-count', 'crop-left-info', 'crop-list', 'crop-name-label', 'crop-right-info', 'crop-text-block',
  'crop-total-ha', 'cultivation-color', 'cultivation-panel', 'cumulative-crop-bar', 'fields-color', 'is-hidden-map', 'is-sim-active',
  'layer-color-indicator', 'layer-control-body', 'layer-control-header', 'layer-control-panel', 'layer-field-box',
  'layer-fit-section', 'layer-header-title', 'layer-item', 'layer-label', 'layer-label-content', 'layer-loading',
  'layer-loading-spinner', 'layer-section', 'layer-sub-options', 'layer-subtext', 'layer-text', 'legend-filter-reset',
  'map-year-floating-widget', 'overlay-list', 'poi-color', 'pulse-anim', 'radar-legend', 'radar-legend-progress',
  'radar-legend-range', 'radar-legend-scale', 'radar-legend-step', 'radar-legend-swatch', 'radar-legend-time',
  'radar-legend-timeline', 'radar-legend-title', 'radar-legend-track', 'radar-legend-unit', 'satellite-cloudfree', 'satellite-color',
  'satellite-color-legend', 'satellite-date-row', 'satellite-ndvi-bar', 'satellite-ndvi-classes', 'satellite-ndvi-labels',
  'satellite-ndvi-legend', 'satellite-panel', 'satellite-panel-note', 'satellite-panel-source', 'satellite-panel-title',
  'satellite-play-row', 'satellite-product-row', 'satellite-progress', 'satellite-progress-bar', 'soil-color', 'soil-legend-gradient',
  'soil-legend-gradient-bar', 'soil-legend-gradient-labels', 'soil-legend-list', 'soil-metric-radio-item', 'soil-metric-radio-list',
  'tech-color', 'v-indiv-actions', 'v-indiv-emoji', 'v-indiv-info', 'v-indiv-names', 'v-indiv-row', 'v-indiv-subtitle',
  'v-indiv-title', 'vehicle-filter-subgroup', 'vehicle-individual-list', 'weather-color', 'widget-crop-legend-section',
  'widget-crop-list', 'widget-legend-content', 'widget-legend-header', 'widget-legend-title', 'year-header-right',
  'year-widget-header', 'year-widget-season', 'year-widget-title',
];
// 4e: dialoogide ja registrite kustutatud klassid (etapp 4e). Täpsed nimed. Jäävad klassid puuduvad teadlikult: `year-col`, `year-col-label`,
// `year-cell`, `has-crop` (Külvikorra aastaveeru CSS-konksud), `detail-section`, `login-notice` (jagatud, jäävad erandiks).
export const RETIRED_4E: readonly string[] = [
  'add-cad-btn', 'add-work-actions', 'add-work-body', 'add-work-check', 'add-work-count', 'add-work-footer', 'add-work-name', 'add-work-option',
  'add-work-phase', 'add-work-phase-label', 'add-work-tag', 'alert-action', 'alert-box', 'alert-left', 'auto-field-icon', 'auto-filled-input',
  'cad-tenure-hint', 'card-emoji-avatar', 'card-info-text', 'confirm-dialog', 'confirm-dialog-body', 'confirm-dialog-icon',
  'crop-auto-color-toggle', 'crop-color-dot', 'crop-edit-modal', 'crop-group-block', 'crop-group-block-header', 'crop-group-columns',
  'crop-group-empty', 'crop-group-ha', 'crop-icon-input', 'crop-inline-edit', 'crop-inline-edit-actions', 'crop-latin', 'crop-name-cell',
  'crop-register-table', 'crop-register-wrap', 'crop-row', 'crop-total-area', 'edit-cad-action', 'edit-cad-grid', 'edit-cad-locked',
  'edit-cadastral-list', 'eligible-ha-sub', 'field-edit-insights', 'field-label-row', 'field-register-modal', 'field-shape-body',
  'field-shape-empty', 'field-shape-map', 'footer-left-info', 'form-header-row', 'is-compact', 'is-stacked', 'muted-note',
  'parties-register-modal', 'party-contact-link', 'party-contact-note', 'party-edit-modal', 'party-role-checkbox', 'party-roles-checkbox-grid',
  'pick-map-highlight', 'poi-edit-modal', 'poi-top-actions', 'poi-top-bar', 'pria-article-cell', 'pria-grid', 'pria-grid-head', 'pria-lines',
  'reg-stat-pill', 'register-crop-group', 'register-crop-group-title', 'register-crop-summary', 'register-crop-summary-groups',
  'register-crop-summary-tenure', 'register-stats-pills', 'season-area-box', 'season-cell', 'season-cell-head', 'season-cell-name',
  'season-cell-notes', 'season-edit-modal', 'season-form-fieldset', 'season-form-grid', 'season-ha-val', 'season-header-actions',
  'season-locked-global-alert', 'season-notes-icon', 'season-notes-row', 'season-year', 'seasons-table-hint', 'secondary-note', 'size-cell',
  'soil-age', 'soil-age-dot', 'soil-footnote', 'soil-value', 'soil-year-cell', 'sticky-size', 'sub-val', 'telemetry-loading-notice',
  'telemetry-pill-field', 'telemetry-pill-meta', 'telemetry-pill-missing', 'telemetry-pill-row', 'telemetry-pill-unlink',
  'telemetry-pill-vehicle', 'telemetry-pill-worker', 'telemetry-pulse-icon', 'telemetry-suggestion-item', 'telemetry-suggestion-pill',
  'telemetry-suggestions-card', 'telemetry-suggestions-head', 'telemetry-suggestions-hint', 'telemetry-suggestions-list',
  'telemetry-suggestions-title', 'v-avatar', 'v-info-item', 'v-info-rows', 'v-model', 'v-title-wrap', 'variety-name', 'variety-name-cell',
  'variety-row', 'variety-seed-rate', 'vehicle-card', 'vehicle-grid', 'weather-season-crop', 'weather-season-past', 'weather-season-shifted',
  'with-action', 'work-entry-area-grid', 'work-entry-area-presets', 'work-entry-body', 'work-entry-finish', 'work-entry-grid', 'work-entry-hint',
  'work-entry-presets-label', 'work-entry-progress', 'work-entry-progress-head', 'work-entry-section', 'work-entry-top-grid',
  'work-entry-unit', 'work-entry-warning', 'work-full-name', 'year-crop', 'year-crop-edit-icon', 'year-crop-name', 'year-shape-btn',
];
// 4g: kustutatud klassid (T8 täidab loendi lõpuni).
export const RETIRED_4G: readonly string[] = ['admin-login', 'map-wrapper'];
// 4f: päise, menüüde, ribade, tugipaneeli ja rakenduse kesta kustutatud klassid (etapp 4f). Täpsed nimed; `teris-logo` puudub teadlikult (logofailide nimi `teris-logo.svg`).
export const RETIRED_4F: readonly string[] = [
  'admin-brand-word', 'app-container', 'app-header', 'db-error-banner', 'header-actions', 'header-account', 'header-account-chevron', 'header-account-content',
  'header-account-db', 'header-account-db-dot', 'header-account-footer', 'header-account-info', 'header-account-info-login',
  'header-account-info-name', 'header-account-sun', 'header-account-trigger', 'header-brand', 'header-nav-slot', 'header-operator',
  'header-operator-caption', 'header-operator-chevron', 'header-operator-content', 'header-operator-dot', 'header-operator-empty',
  'header-operator-text', 'header-operator-trigger', 'header-operator-value', 'license-banner', 'main-content', 'main-view-switch',
  'support-banner', 'support-panel', 'support-banner-end', 'support-panel-actions', 'support-panel-desc', 'support-panel-head', 'support-panel-icon',
  'support-panel-label', 'support-panel-log', 'support-panel-row', 'support-panel-title', 'support-panel-titles', 'support-panel-until',
  'support-panel-who', 'teris-logo-horizontal', 'teris-logo-icon', 'teris-logo-vertical',
  'auth-loading', 'forced-password-page', 'full-width', 'login-backdrop', 'login-brand', 'login-dust', 'login-forgot-row',
  'fullpage-board-view', 'fullpage-board-main', 'fullpage-board-body', 'fullpage-board-content', 'fullpage-board-footer', 'register-actions-bar',
  'register-header-controls', 'register-io-buttons', 'search-field', 'year-selector-group', 'year-label', 'cell-sub', 'cell-sub-inline', 'field-name',
  'field-title-line', 'field-sub-tags', 'sticky-name', 'name-cell', 'wrap-cell', 'has-corner-btn', 'fields-table', 'fields-table-crop',
  'field-menu', 'field-menu-anchor', 'field-menu-title', 'field-menu-note', 'field-map-card', 'field-map-card-anchor', 'fmc-header', 'fmc-name',
  'fmc-rows', 'fmc-actions', 'crop-indicator-dot', 'work-register-modal', 'work-register-body', 'work-name-cell', 'work-form-modal',
  'weather-body', 'weather-filters', 'weather-source', 'weather-note', 'weather-muted', 'weather-years-layout', 'weather-years', 'weather-years-wrap',
  'weather-point-map', 'weather-wet', 'weather-dry', 'weather-warm', 'weather-cool', 'weather-legend-row', 'weather-chart-grid', 'weather-chart-title',
  'weather-chart-box', 'weather-chart', 'weather-grid', 'weather-axis', 'weather-axis-line', 'weather-month-tick', 'weather-crosshair',
  'weather-crosshair-label', 'weather-crosshair-text', 'weather-bar', 'weather-bar-normal', 'weather-line', 'weather-line-normal', 'weather-line-0',
  'weather-line-1', 'weather-line-2', 'weather-line-3', 'weather-line-4', 'weather-line-5', 'weather-credential-modal', 'weather-credential-status',
  'weather-credential-state', 'weather-credential-error', 'weather-credential-form', 'weather-credential-help',
  'article-overuse', 'cell-badge', 'cell-badge-lead', 'stock-qty', 'stock-qty-in', 'stock-qty-out', 'articles-tabs', 'stock-doc-lines', 'stock-doc-qty',
  'stock-doc-amount', 'stock-doc-unit', 'stock-doc-unit-price', 'stock-doc-footer-row', 'stock-doc-modal', 'article-categories-group',
  'article-categories-add', 'article-categories-modal', 'article-form-modal', 'article-form-body', 'article-npk-inputs', 'article-merge-info',
  'harvest-lot-body', 'harvest-lot-head', 'harvest-lot-tiles', 'harvest-lot-section', 'harvest-lot-add', 'harvest-lot-add-weighing', 'harvest-lot-add-cost',
  // 4f järelkorjatud: Dropzone, vihjed, üleslaadimise eelvaade, AI võtmed, kasutajate admin ja teenusepakkuja admin (admin-login kustus 4g-s koos admin.css-iga, RETIRED_4G).
  'ai-instructions-footer', 'ai-instructions-input', 'ai-key-created', 'ai-key-help', 'ai-key-new', 'ai-key-table', 'ai-key-table-wrap', 'ai-key-url',
  'detail-section', 'dropzone', 'dropzone-icon', 'dropzone-state', 'file-reupload-hint', 'hint-text', 'is-block', 'notes-text', 'operator-field', 'p-crop',
  'p-ha', 'parsed-preview-box', 'preview-field-row', 'preview-fields-scroll', 'preview-header', 'upload-format-list', 'users-admin-mode',
  'users-admin-roles', 'users-admin-wrap', 'weather-chart-card',
  'admin-actions', 'admin-badge', 'admin-card', 'admin-card-foot', 'admin-card-head', 'admin-checks', 'admin-color-input', 'admin-danger-card',
  'admin-danger-row', 'admin-details', 'admin-expired', 'admin-field', 'admin-field-label', 'admin-field-value', 'admin-filter-row', 'admin-form',
  'admin-form-grid', 'admin-header', 'admin-header-right', 'admin-help', 'admin-help-dot', 'admin-help-editor', 'admin-help-filters', 'admin-help-group',
  'admin-help-item', 'admin-help-item-label', 'admin-help-item-text', 'admin-help-item-where', 'admin-help-list', 'admin-help-preview',
  'admin-help-updated', 'admin-hint', 'admin-interest-message', 'admin-license-grid', 'admin-meta', 'admin-muted', 'admin-nav', 'admin-preset-group',
  'admin-row-actions', 'admin-rte', 'admin-rte-area', 'admin-rte-sep', 'admin-shell', 'admin-soon', 'admin-split', 'admin-stat-row', 'admin-subform',
  'admin-subpanel', 'admin-support-link', 'admin-swatch', 'admin-toolbar', 'admin-two-col', 'admin-warning-text',
  'visits-axis', 'visits-bar', 'visits-chart', 'visits-grid', 'visits-tip',
];
const LEGACY_OVERVIEW = new RegExp(
  `(?<![\\w-])(?<!\\b(?:id|htmlFor)=["'{])(${[String.raw`section-title|section-subtitle|form-sub-header|form-section-title|fullpage-board-header|fullpage-title-wrap|fullpage-subtitle|fleet-board-header|fleet-title-wrap|fleet-subtitle|trip-tile(?:-label|-value|-unit)?|admin-stat|finance-[a-z][a-z-]*|soil-legend-item|soil-legend-swatch|trip-timesplit-item|trip-timesplit-swatch|fmc-row|fmc-crop|fw-[a-z][a-z0-9-]*`, ...RETIRED_4C, ...RETIRED_4D, ...RETIRED_4E, ...RETIRED_4F, ...RETIRED_4G].join('|')})(?![\\w-])`,
  'g',
);
const CSS_RULE = /([^{}]+)\{([^{}]*)\}/g;
const CARD_LOOK_DECL = /(?:^|[;\s])(background(?:-color)?|border|border-radius|box-shadow|(?:-webkit-)?backdrop-filter)\s*:\s*([^;}]*)/g;

export function legacyCardRules(css: string): string[] {
  const out: string[] = [];
  for (const [, selector, body] of css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(CSS_RULE)) {
    const bare = selector
      .split(',')
      .map((s) => s.trim())
      .filter((s) => /^\.[\w-]+$/.test(s) && LEGACY_CARD_CLASSES.has(s.slice(1)));
    if (bare.length > 0 && [...body.matchAll(CARD_LOOK_DECL)].some((d) => !d[2].includes('!important'))) out.push(...bare);
  }
  return out;
}
const INLINE_FONT_SIZE = /fontSize\s*:\s*(?:(\d+(?:\.\d+)?)|['"](\d+(?:\.\d+)?(?:px|rem))['"])/g;

const values = (css: string, re: RegExp) => [...css.matchAll(re)].map((m) => m[1].trim());
const uniqueSorted = (list: string[]) => [...new Set(list)].sort();
const withoutImportant = (v: string) => v.replace(/!important/g, '').trim();
const isNonZeroNumber = (t: string, unit: RegExp) => unit.test(t) && parseFloat(t) !== 0;
const LENGTH_PCT = /^-?\d*\.?\d+(px|rem|em|%)$/;
const LENGTH = /^-?\d*\.?\d+(px|rem|em)$/;
// Kirjasuurus ja nurk: lühendist (nt "6px 6px 0 0") jäävad alles ainult arvulised väärtused; muutujad, inherit, 0 välja.
const lengthTokens = (css: string, prop: RegExp) =>
  values(css, prop)
    .flatMap((v) => withoutImportant(v).split(/\s+/))
    .filter((t) => isNonZeroNumber(t, LENGTH_PCT));

const colors = (src: string) =>
  (src.match(COLOR) ?? []).filter((c) => !/var\(/i.test(c)).map((c) => c.toLowerCase().replace(/\s+/g, ''));

export function auditCss(css: string) {
  const spacing = values(css, SPACING_DECL)
    .flatMap((v) => withoutImportant(v).split(/\s+/))
    .filter((t) => isNonZeroNumber(t, LENGTH));
  return {
    fontSizes: lengthTokens(css, /font-size\s*:\s*([^;}]+)/g),
    radii: lengthTokens(css, /border-radius\s*:\s*([^;}]+)/g),
    spacing,
    colors: colors(css),
    componentClasses: [...new Set([...css.matchAll(LEGACY_COMPONENT)].map((m) => `.${m[1]}`))],
    cardRules: legacyCardRules(css),
  };
}

export function auditTsx(src: string) {
  return {
    inlineStyles: (src.match(/style=\{\{/g) ?? []).length,
    colors: colors(src).length,
    arbitrary: src.match(ARBITRARY) ?? [],
    offScaleSpacing: [...src.matchAll(SPACING_CLASS)].filter((m) => !SPACING_SCALE.has(m[2])).map((m) => m[1]),
    inlineFontSizes: [...src.matchAll(INLINE_FONT_SIZE)].map((m) => (m[1] ? `${m[1]}px` : m[2])),
    legacyButtons: [...src.matchAll(LEGACY_BUTTON)].map((m) => m[1]),
    legacyModals: [...src.matchAll(LEGACY_MODAL)].map((m) => m[1]),
    legacyTables: [...src.matchAll(LEGACY_TABLE)].map((m) => (m[1] ? `<${m[1]}>` : m[2])),
    legacyBadgeTabs: [...src.matchAll(LEGACY_BADGE_TAB)].map((m) => m[1]),
    legacyFormFields: [...src.matchAll(LEGACY_FORM_FIELD)].map((m) => (m[1] ? `<${m[1]}>` : m[2])),
    legacyMenuPopups: [...src.matchAll(LEGACY_MENU_POPUP)].map((m) => m[1] ?? m[2] ?? 'aria-haspopup'),
    legacyCards: src.match(LEGACY_CARD_TSX) ?? [],
    legacyOverview: stripComments(src).match(LEGACY_OVERVIEW) ?? [],
    rawButtons: (stripComments(src).match(RAW_BUTTON) ?? []).length,
    roleButtons: (stripComments(src).match(ROLE_BUTTON) ?? []).length,
  };
}

export function summarize(files: { path: string; content: string }[]): AuditReport {
  const css = files.filter((f) => f.path.endsWith('.css')).map((f) => ({ path: f.path, ...auditCss(f.content) }));
  const tsx = files.filter((f) => f.path.endsWith('.tsx')).map((f) => ({ path: f.path, ...auditTsx(f.content) }));
  return {
    fontSizes: uniqueSorted(css.flatMap((c) => c.fontSizes)),
    radii: uniqueSorted(css.flatMap((c) => c.radii)),
    spacing: uniqueSorted(css.flatMap((c) => c.spacing)),
    cssColors: uniqueSorted(css.flatMap((c) => c.colors.map((x) => x.toLowerCase()))),
    inlineStyles: tsx.reduce((s, t) => s + t.inlineStyles, 0),
    tsxColors: tsx.reduce((s, t) => s + t.colors, 0),
    arbitrary: tsx.flatMap((t) => t.arbitrary.map((cls) => ({ path: t.path, cls }))),
    offScaleSpacing: tsx.flatMap((t) => [...new Set(t.offScaleSpacing)].map((cls) => ({ path: t.path, cls }))),
    inlineFontSizes: uniqueSorted(tsx.flatMap((t) => t.inlineFontSizes)),
    tsxColorFiles: tsx.filter((t) => t.colors > 0).map((t) => ({ path: t.path, count: t.colors })),
    legacyComponentClasses: uniqueSorted(css.flatMap((c) => c.componentClasses)),
    legacyButtonFiles: tsx.filter((t) => t.legacyButtons.length > 0).map((t) => ({ path: t.path, count: t.legacyButtons.length })),
    legacyModalFiles: tsx.filter((t) => t.legacyModals.length > 0).map((t) => ({ path: t.path, count: t.legacyModals.length })),
    legacyTableFiles: tsx
      .filter((t) => t.legacyTables.length > 0 && !t.path.includes('components/ui/'))
      .map((t) => ({ path: t.path, count: t.legacyTables.length })),
    legacyBadgeTabFiles: tsx
      .filter((t) => t.legacyBadgeTabs.length > 0 && !t.path.includes('components/ui/'))
      .map((t) => ({ path: t.path, count: t.legacyBadgeTabs.length })),
    legacyFormFieldFiles: tsx
      .filter((t) => t.legacyFormFields.length > 0 && !t.path.includes('components/ui/'))
      .map((t) => ({ path: t.path, count: t.legacyFormFields.length })),
    legacyMenuPopupFiles: tsx
      .filter((t) => t.legacyMenuPopups.length > 0 && !t.path.includes('components/ui/'))
      .map((t) => ({ path: t.path, count: t.legacyMenuPopups.length })),
    legacyCardFiles: [
      ...tsx
        .filter((t) => t.legacyCards.length > 0 && !t.path.includes('components/ui/'))
        .map((t) => ({ path: t.path, count: t.legacyCards.length })),
      ...css.filter((c) => c.cardRules.length > 0).map((c) => ({ path: c.path, count: c.cardRules.length })),
    ],
    legacyOverviewFiles: tsx
      .filter((t) => t.legacyOverview.length > 0 && !t.path.includes('components/ui/'))
      .map((t) => ({ path: t.path, count: t.legacyOverview.length })),
    rawButtonFiles: tsx
      .filter((t) => !t.path.includes('components/ui/'))
      .map((t) => ({ path: t.path, count: rawButtonsOverAllowed(t.path, t.rawButtons) }))
      .filter((f) => f.count > 0),
    roleButtonFiles: tsx
      .filter((t) => !t.path.includes('components/ui/'))
      .map((t) => ({ path: t.path, count: roleButtonsOverAllowed(t.path, t.roleButtons) }))
      .filter((f) => f.count > 0),
  };
}

// Defineerimata CSS-muutuja: var(--x) on kasutusel, aga --x: pole ühelgi CSS-reeglil ega tsx-i style-võtmena.
// Brauser ignoreerib siis kogu deklaratsiooni (ääris = currentColor, taust läbipaistev). Radixi ja Tailwindi
// käitusaja muutujad (--radix-*, --tw-*) ei loe. Varuväärtusega var(--x, y) loeb samuti (varuväärtus peidab vea).
const VAR_USE = /var\(\s*(--[\w-]+)/g;
const VAR_DEF_CSS = /(--[\w-]+)\s*:/g;
const VAR_DEF_TSX = /['"](--[\w-]+)['"]\s*:/g;

export function undefinedCssVars(css: string[], tsx: string[]): string[] {
  const defined = new Set<string>();
  for (const c of css) for (const m of c.replace(/var\([^)]*\)/g, '').matchAll(VAR_DEF_CSS)) defined.add(m[1]);
  for (const t of tsx) for (const m of t.matchAll(VAR_DEF_TSX)) defined.add(m[1]);
  const used = new Set<string>();
  for (const c of css) for (const m of c.matchAll(VAR_USE)) used.add(m[1]);
  return [...used].filter((v) => !defined.has(v) && !/^--(radix|tw)-/.test(v)).sort();
}

// Kasutuseta CSS-klass: klassinime pole ühegi lähtefaili tekstis (kommentaarid välja). Klass, mille algus vastab
// lähtekoodis koostatavale eesliitele (`prefix-${…}` või 'prefix-' + …), on "dünaamiline" — kontrolli käsitsi.
// leaflet-* klassid loob Leaflet ise.
const DYNAMIC_PREFIX = /[\s'"`]([a-z][\w-]*-)(?:\$\{|['"]\s*\+)/g;

export function unusedCssClasses(css: string, sources: string[]): { unused: string[]; dynamic: string[] } {
  const clean = css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/url\([^)]*\)/g, '')
    .replace(/"[^"\n]*"|'[^'\n]*'/g, '""');
  const classes = new Set(
    [...clean.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map((m) => m[1]).filter((c) => !c.startsWith('leaflet-'))
  );
  const text = sources.map((s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')).join('\n');
  const tokens = new Set(text.match(/[A-Za-z][\w-]*/g) ?? []);
  const prefixes = [...new Set([...text.matchAll(DYNAMIC_PREFIX)].map((m) => m[1]))];
  const unused: string[] = [];
  const dynamic: string[] = [];
  for (const c of [...classes].sort()) {
    if (tokens.has(c)) continue;
    (prefixes.some((p) => c.startsWith(p)) ? dynamic : unused).push(c);
  }
  return { unused, dynamic };
}

const FONT_SCALE = new Set(['11px', '12px', '13px', '14px', '16px', '20px']);
const SPACING_SCALE_ABS = new Set(['2px', '4px', '6px', '8px', '10px', '12px', '16px', '24px', '32px']);

const DISALLOWED_FONT_WEIGHT_CSS = /(?:^|[;\s{])font-weight\s*:\s*(800|900|bolder)/g;
const DISALLOWED_FONT_WEIGHT_TSX = /(?<![\w-])font-(?:extrabold|black)(?![\w-])/g;

/** Lubatud 800+ kirjapaksused failide kaupa (kaubamärk: Outfit brändisõna; landing on eraldi avalik leht oma tüpograafiaga). */
export const FONT_WEIGHT_ALLOWED: Readonly<Record<string, number>> = {
  'src/styles/login.css': 1, // .login-brand-word (kasutab ka admin)
  'src/landing/landing.css': 3, // h1, .lp-brand-word, sammu number
};

/** Keelatud kirjapaksused: 800+ (ExtraBold, Black) teeb teksti liiga raskeks; erandid FONT_WEIGHT_ALLOWED. */
export function disallowedFontWeights(files: { path: string; content: string }[]): { path: string; count: number }[] {
  return files.flatMap(({ path, content }) => {
    const clean = stripComments(content);
    const isCss = path.endsWith('.css');
    const matches = isCss ? clean.match(DISALLOWED_FONT_WEIGHT_CSS) ?? [] : clean.match(DISALLOWED_FONT_WEIGHT_TSX) ?? [];
    const count = matches.length;
    const allowed = Object.entries(FONT_WEIGHT_ALLOWED).find(([k]) => path.endsWith(k))?.[1] ?? 0;
    const excess = Math.max(0, count - allowed);
    return excess > 0 ? [{ path, count: excess }] : [];
  });
}

/** Skaalavälised kirjasuurused ja vahed (spec: kirjasuurusi ≤ 6, vahed ainult skaalast). */
export function offScaleCss(css: string): { fontSizes: string[]; spacing: string[] } {
  const a = auditCss(css);
  return {
    fontSizes: uniqueSorted(a.fontSizes.filter((f) => !FONT_SCALE.has(f))),
    spacing: uniqueSorted(a.spacing.filter((s) => !SPACING_SCALE_ABS.has(s.replace(/^-/, '')))),
  };
}

// @source valvur (etapp 4b): vaatefail, kus stringides on Tailwindi utiliidi tokeneid, aga mida pole app.css `@source`-is,
// ei saa neile stiili (surnud klass). Tokenite loend on teadlikult kitsas (arvu/nimega kujud): ühesõnalised nimed
// (flex, hidden, border) kattuvad vana CSS-iga ja jäävad välja.
const UTILITY_TOKEN =
  /(?<![\w-])(?:gap(?:-[xy])?-\d+(?:\.\d+)?|p[xytrbl]?-\d+(?:\.\d+)?|m[xytrbl]?-\d+(?:\.\d+)?|text-(?:2xs|xs|sm|base|lg|xl)|font-(?:medium|semibold)|items-(?:center|start|end|baseline)|justify-(?:between|center|end)|rounded-(?:sm|md|lg|full)|bg-(?:card|muted|popover|primary|background)|text-(?:muted-foreground|subtle|foreground|destructive)|border-border|min-w-0|shrink-0|size-\d+|flex-(?:col|wrap)|grid-cols-\d+|leading-natural|whitespace-nowrap|tabular-nums)(?![\w-])/g;
const STRING_LITERAL = /"([^"\n]*)"|'([^'\n]*)'|`([^`]*)`/g;

/** Lubatud erandid: fail → põhjus. Nähtavat muutust vältiv ajutine loend; kustub, kui fail läheb @source-i. */
export const SOURCE_GUARD_ALLOWED: Readonly<Record<string, string>> = {
  'src/components/FieldContextMenu.tsx': 'DropdownMenuItem items-start; 4.6 etapp',
};

/** `@source '<tee>'` read (kommentaarid ja `@source not` välja) kujul src/-suhteline tee. */
export function sourcedPaths(appCss: string): string[] {
  const clean = appCss.replace(/\/\*[\s\S]*?\*\//g, '');
  return [...clean.matchAll(/@source\s+(?!not\b)'([^']+)'/g)].map((m) => m[1].replace(/^\.\.\//, 'src/'));
}

const isViewPath = (p: string): boolean =>
  p.endsWith('.tsx') &&
  ((p.startsWith('src/components/') && !p.startsWith('src/components/ui/')) ||
    p.startsWith('src/admin/') ||
    p === 'src/App.tsx' ||
    p === 'src/AuthGate.tsx');

export function unsourcedUtilityFiles(
  files: { path: string; content: string }[],
  appCss: string
): { path: string; tokens: string[] }[] {
  const sourced = sourcedPaths(appCss);
  const covered = (p: string) => sourced.some((s) => p === s || p.startsWith(`${s}/`));
  return files
    .filter((f) => isViewPath(f.path) && !covered(f.path) && !(f.path in SOURCE_GUARD_ALLOWED))
    .map((f) => {
      const tokens = new Set<string>();
      for (const m of f.content.matchAll(STRING_LITERAL)) {
        for (const t of (m[1] ?? m[2] ?? m[3] ?? '').match(UTILITY_TOKEN) ?? []) tokens.add(t);
      }
      return { path: f.path, tokens: [...tokens].sort() };
    })
    .filter((f) => f.tokens.length > 0);
}
