/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_STENCIL_API_URL: string
  readonly VITE_STENCIL_BASE_PATH: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
