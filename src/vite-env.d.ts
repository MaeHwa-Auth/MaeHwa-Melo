/// <reference types="vite/client" />

declare module "*.css" {
  const content: { [key: string]: string };
  export default content;
}

interface ImportMetaEnv {
  readonly VITE_SPOTIFY_CLIENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
