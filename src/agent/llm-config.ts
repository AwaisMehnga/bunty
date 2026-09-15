// GREENFIELD: OpenAI-compatible LLM config (DeepSeek-style: baseURL + apiKey + model)

export const LLM_STORAGE_KEY = 'react-agent-llm'
export const LLM_PROXY_PATH = '/api/llm'
export const LLM_BASE_URL_HEADER = 'X-LLM-Base-URL'
export const PROXY_API_KEY_PLACEHOLDER = 'proxy'

export const DEFAULT_LLM_BASE_URL = 'https://api.openai.com/v1'
export const DEFAULT_LLM_MODEL = 'gpt-4o-mini'

export type LlmSettings = {
  /** Upstream OpenAI-compatible base URL. Empty = inherit env/default. */
  baseUrl: string
  /** User API key. Empty = Vite injects server LLM_API_KEY / OPENAI_API_KEY. */
  apiKey: string
  /** Model id. Empty = inherit env/default. */
  model: string
}

export type LlmConfig = {
  baseUrl: string
  apiKey: string
  model: string
  /** Where each field came from after resolve. */
  source: {
    baseUrl: 'ui' | 'env' | 'default'
    apiKey: 'ui' | 'proxy'
    model: 'ui' | 'env' | 'default'
  }
}

export const EMPTY_LLM_SETTINGS: LlmSettings = {
  baseUrl: '',
  apiKey: '',
  model: '',
}

export function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, '')
}

export function loadLlmSettings(): LlmSettings {
  try {
    const raw = localStorage.getItem(LLM_STORAGE_KEY)
    if (!raw) return { ...EMPTY_LLM_SETTINGS }
    const parsed = JSON.parse(raw) as Partial<LlmSettings>
    return {
      baseUrl: typeof parsed.baseUrl === 'string' ? parsed.baseUrl : '',
      apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : '',
      model: typeof parsed.model === 'string' ? parsed.model : '',
    }
  } catch {
    return { ...EMPTY_LLM_SETTINGS }
  }
}

export function saveLlmSettings(settings: LlmSettings): void {
  localStorage.setItem(
    LLM_STORAGE_KEY,
    JSON.stringify({
      baseUrl: settings.baseUrl,
      apiKey: settings.apiKey,
      model: settings.model,
    }),
  )
}

function envModelDefault(): string {
  return import.meta.env.VITE_LLM_MODEL || import.meta.env.VITE_OPENAI_MODEL || DEFAULT_LLM_MODEL
}

export function resolveLlmConfig(settings?: LlmSettings): LlmConfig {
  const s = settings ?? (typeof localStorage !== 'undefined' ? loadLlmSettings() : EMPTY_LLM_SETTINGS)

  const uiBase = normalizeBaseUrl(s.baseUrl)
  const uiModel = s.model.trim()
  const uiKey = s.apiKey.trim()
  const viteBase = normalizeBaseUrl(import.meta.env.VITE_LLM_BASE_URL || '')
  const envModel = envModelDefault().trim() || DEFAULT_LLM_MODEL

  let baseUrl: string
  let baseSource: LlmConfig['source']['baseUrl']
  if (uiBase) {
    baseUrl = uiBase
    baseSource = 'ui'
  } else if (viteBase) {
    baseUrl = viteBase
    baseSource = 'env'
  } else {
    // Client does not send X-LLM-Base-URL; Vite proxy uses LLM_BASE_URL or default.
    baseUrl = DEFAULT_LLM_BASE_URL
    baseSource = 'default'
  }

  let model: string
  let modelSource: LlmConfig['source']['model']
  if (uiModel) {
    model = uiModel
    modelSource = 'ui'
  } else if (import.meta.env.VITE_LLM_MODEL || import.meta.env.VITE_OPENAI_MODEL) {
    model = envModel
    modelSource = 'env'
  } else {
    model = DEFAULT_LLM_MODEL
    modelSource = 'default'
  }

  return {
    baseUrl,
    apiKey: uiKey,
    model,
    source: {
      baseUrl: baseSource,
      apiKey: uiKey ? 'ui' : 'proxy',
      model: modelSource,
    },
  }
}

/** Whether the browser should tell the Vite proxy which upstream base URL to use. */
export function shouldSendBaseUrlHeader(cfg: LlmConfig): boolean {
  return cfg.source.baseUrl === 'ui' || cfg.source.baseUrl === 'env'
}

export function currentModelId(settings?: LlmSettings): string {
  return resolveLlmConfig(settings).model
}
