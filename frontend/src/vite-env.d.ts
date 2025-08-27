/// <reference types="vite/client" />

// Declare module for PNG imports
declare module '*.png' {
  const src: string;
  export default src;
}

// Extend ImportMeta interface if needed
interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_APP_TITLE?: string;
  readonly DEV: boolean;
  readonly PROD: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}