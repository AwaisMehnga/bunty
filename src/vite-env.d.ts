/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_LLM_MODEL?: string
  readonly VITE_LLM_BASE_URL?: string
  /** @deprecated Prefer VITE_LLM_MODEL */
  readonly VITE_OPENAI_MODEL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.txt?raw' {
  const content: string
  export default content
}
