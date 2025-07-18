/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_STENCIL_API_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
