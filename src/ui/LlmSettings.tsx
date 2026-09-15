import { useMemo, useState } from 'react'
import {
  loadLlmSettings,
  resolveLlmConfig,
  saveLlmSettings,
  type LlmSettings,
} from '../agent/llm-config'

function sourceBadge(source: 'ui' | 'env' | 'default' | 'proxy'): string {
  if (source === 'ui') return 'UI'
  if (source === 'env') return 'env'
  if (source === 'proxy') return 'server'
  return 'default'
}

export function LlmSettings() {
  const [draft, setDraft] = useState<LlmSettings>(() => loadLlmSettings())
  const [savedAt, setSavedAt] = useState<number | null>(null)

  const effective = useMemo(() => resolveLlmConfig(draft), [draft])

  const save = () => {
    const next: LlmSettings = {
      baseUrl: draft.baseUrl.trim(),
      apiKey: draft.apiKey.trim(),
      model: draft.model.trim(),
    }
    saveLlmSettings(next)
    setDraft(next)
    setSavedAt(Date.now())
  }

  const clear = () => {
    const empty = { baseUrl: '', apiKey: '', model: '' }
    saveLlmSettings(empty)
    setDraft(empty)
    setSavedAt(Date.now())
  }

  return (
    <div className="border-t border-zinc-800 bg-zinc-950 px-3 py-2 text-zinc-100">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-xs font-medium tracking-wide text-zinc-400">LLM</div>
        <div className="truncate font-mono text-[10px] text-zinc-500">
          {sourceBadge(effective.source.baseUrl)}/{sourceBadge(effective.source.model)}/
          {sourceBadge(effective.source.apiKey)}
        </div>
      </div>
      <div className="mb-2 flex flex-col gap-1">
        <input
          value={draft.baseUrl}
          onChange={(e) => setDraft((s) => ({ ...s, baseUrl: e.target.value }))}
          placeholder="https://api.deepseek.com/v1"
          className="rounded border border-zinc-800 bg-zinc-900 px-2 py-1 font-mono text-[11px] text-zinc-200 outline-none focus:border-zinc-600"
          spellCheck={false}
        />
        <input
          type="password"
          value={draft.apiKey}
          onChange={(e) => setDraft((s) => ({ ...s, apiKey: e.target.value }))}
          placeholder="API key (empty = server .env)"
          className="rounded border border-zinc-800 bg-zinc-900 px-2 py-1 font-mono text-[11px] text-zinc-200 outline-none focus:border-zinc-600"
          spellCheck={false}
          autoComplete="off"
        />
        <input
          value={draft.model}
          onChange={(e) => setDraft((s) => ({ ...s, model: e.target.value }))}
          placeholder="deepseek-chat"
          className="rounded border border-zinc-800 bg-zinc-900 px-2 py-1 font-mono text-[11px] text-zinc-200 outline-none focus:border-zinc-600"
          spellCheck={false}
        />
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={save}
          className="rounded bg-zinc-800 px-2 py-1 text-[11px] text-zinc-200 hover:bg-zinc-700"
        >
          Save
        </button>
        <button
          type="button"
          onClick={clear}
          className="rounded px-2 py-1 text-[11px] text-zinc-500 hover:text-zinc-300"
        >
          Clear
        </button>
        {savedAt ? <span className="text-[10px] text-zinc-600">saved</span> : null}
      </div>
      <p className="mt-2 text-[10px] leading-snug text-zinc-600">
        Empty fields use .env (<code className="text-zinc-500">LLM_*</code>). OpenAI-compatible
        proxies welcome.
      </p>
    </div>
  )
}
