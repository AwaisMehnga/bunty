// GREENFIELD: OpenAI-compatible client via Vite /api/llm proxy (DeepSeek-style)

import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import {
  LLM_BASE_URL_HEADER,
  LLM_PROXY_PATH,
  PROXY_API_KEY_PLACEHOLDER,
  resolveLlmConfig,
  shouldSendBaseUrlHeader,
} from './llm-config'

/**
 * @ai-sdk/openai-compatible builds requests with `new URL(baseURL + path)`,
 * which rejects relative paths like `/api/llm`. Always pass an absolute origin URL.
 */
function absoluteProxyBaseUrl(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}${LLM_PROXY_PATH}`
  }
  return `http://127.0.0.1:8002${LLM_PROXY_PATH}`
}

export function createAgentModel(modelId?: string) {
  const cfg = resolveLlmConfig()
  const id = modelId ?? cfg.model

  const headers: Record<string, string> = {}
  if (shouldSendBaseUrlHeader(cfg)) {
    headers[LLM_BASE_URL_HEADER] = cfg.baseUrl
  }

  const llm = createOpenAICompatible({
    name: 'llm',
    // PORT: absolute URL required by SDK URL constructor; Vite proxies to upstream
    baseURL: absoluteProxyBaseUrl(),
    apiKey: cfg.apiKey || PROXY_API_KEY_PLACEHOLDER,
    headers,
  })

  return llm.chatModel(id)
}
