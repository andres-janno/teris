// Vite'i virtuaalne moodul (src/tooling/uiUsagePlugin.ts): ühiste ui komponentide kasutussagedus.
declare module 'virtual:ui-usage' {
  const usage: import('./tooling/uiUsage').UiUsage;
  export default usage;
}
