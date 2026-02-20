// Version is injected at build time by Vite (see vite.config.ts define)
// Format: YYYY.MM.DD.HHmm (e.g., 2026.02.20.1435)
declare const __BUILD_VERSION__: string;

export const APP_VERSION = typeof __BUILD_VERSION__ !== 'undefined' 
  ? __BUILD_VERSION__ 
  : 'dev';
