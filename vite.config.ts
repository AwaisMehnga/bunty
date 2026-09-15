import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { agentApiPlugin } from './vite.agent-api.ts'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, rootDir, '')
  const llmApiKey = env.LLM_API_KEY || env.OPENAI_API_KEY || ''
  const llmBaseUrl = env.LLM_BASE_URL || 'https://api.openai.com/v1'

  return {
    plugins: [
      react(),
      tailwindcss(),
      // PORT: dynamic OpenAI-compatible forwarder; key stays server-side unless UI overrides
      agentApiPlugin({ llmApiKey, llmBaseUrl }),
    ],
    server: {
      port: 8002,
      host: true,
    },
  }
})
