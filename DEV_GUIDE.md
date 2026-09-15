# React Agent — Dev Guide (Copy-First)

How to extend this agent without rewriting OpenCode.

Research map: [`../react-agent.md`](../react-agent.md)

---

## Golden rule

**Copy before invent.** If OpenCode already has the logic (fuzzy replace, patch parser, tool descriptions, system prompts), copy that file into `src/agent/vendor/opencode/` and apply the smallest patch. Do not reimplement from memory.

---

## File classification

Before adding or changing agent code, label the work:

| Class | Meaning | Examples |
|-------|---------|----------|
| **COPY** | Verbatim (or near-verbatim) text/assets from OpenCode | `*.txt` prompts |
| **EXTRACT** | Keep pure algorithms; strip Effect / Node FS / LSP / locks | `edit-replace.ts` from `tool/edit.ts` |
| **ADAPT** | Thin wrapper: Zod + VirtualFS + call copied core | `tools/edit.ts`, `tools/read.ts` |
| **GREENFIELD** | No OpenCode equivalent for the browser host | Zustand store, Vite proxy, UI, `loop.ts` |

---

## Attribution & patches

1. Every vendored file starts with a source header, e.g.  
   `// Sourced from opencode/packages/opencode/src/tool/edit.ts`
2. Document each intentional change with `// PORT:` at the change site (one line why).
3. Prefer surgical edits over rewrites. If a patch grows large, stop and re-check whether you should EXTRACT a smaller pure slice instead.

---

## Phase 1 source map

| Action | OpenCode source | Local path |
|--------|-----------------|------------|
| COPY | `packages/opencode/src/session/prompt/gpt.txt` | `src/agent/vendor/opencode/prompts/gpt.txt` |
| COPY | `packages/opencode/src/tool/{edit,write,read,grep,glob}.txt` | `src/agent/vendor/opencode/tools/*.txt` |
| EXTRACT | Pure replacers + `replace()` in `tool/edit.ts` | `src/agent/vendor/opencode/edit-replace.ts` |
| ADAPT | Tool execute bodies | `src/agent/tools/*.ts` |
| GREENFIELD | Loop, FS, session, UI, proxy | `src/agent/{fs,session,loop,llm}.ts`, `src/ui/` |

---

## Forbidden in Phase 1

Do **not** port:

- `effect` / Effect-based `Tool.define`
- Node `fs`, ripgrep binary, `@parcel/watcher`
- LSP, bash/shell, MCP SDK
- Full `session/prompt.ts` Effect loop (inspire semantics only)

---

## Later phases (copy when ready)

| Phase | Copy from OpenCode | Local status |
|-------|--------------------|--------------|
| 2 | Doom-loop from `processor.ts`; `todowrite.txt` + `question.txt` | Done — see Phase 2 map below |
| 3 | `apply_patch`, web tools, MCP, FSA, `task` | Done — see Phase 3 map below |

---

## Phase 2 source map

| Action | Source / approach | Local path |
|--------|-------------------|------------|
| COPY | `tool/todowrite.txt`, `tool/question.txt` | `src/agent/vendor/opencode/tools/` |
| ADAPT | Thin todowrite / question tools | `src/agent/tools/todowrite.ts`, `question.ts` |
| GREENFIELD | Undo + lastDiff | `src/agent/session/store.ts`, `src/ui/DiffPanel.tsx` |
| GREENFIELD | IndexedDB hydrate/save | `src/agent/session/persist.ts` |
| INSPIRE | Doom loop (threshold 3) | `src/agent/loop.ts` |
| GREENFIELD | Max-steps note | `src/agent/prompts/max-steps.txt` |
| UI | Todos + question modal | `src/ui/TodoList.tsx`, `QuestionModal.tsx` |

---

## Phase 3 source map

| Action | Source / approach | Local path |
|--------|-------------------|------------|
| COPY | `tool/apply_patch.txt`, `webfetch.txt`, `websearch.txt`, `task.txt` | `src/agent/vendor/opencode/tools/` |
| COPY | `agent/prompt/explore.txt` | `src/agent/vendor/opencode/agent/explore.txt` |
| EXTRACT | `patch/index.ts` (no Effect/FS/Bom) | `src/agent/vendor/opencode/patch.ts` |
| ADAPT | `apply_patch` + model gating (`gpt-` ∩ ¬oss ∩ ¬gpt-4) | `tools/apply_patch.ts`, `model-tools.ts`, `registry.ts` |
| ADAPT | `webfetch` / `websearch` via Vite proxies | `tools/webfetch.ts`, `websearch.ts`, `vite.agent-api.ts` |
| GREENFIELD | FSA open-folder → memory FS + write-through | `fs/fsa-sync.ts`, `ui/FileList.tsx` |
| GREENFIELD | HTTP/SSE MCP → dynamic `mcp__server__tool` | `mcp/client.ts`, `ui/McpPanel.tsx` |
| ADAPT | Nested `task` subagent (no recursive `task`) | `tools/task.ts` |

---

## Adding a new tool

1. Find OpenCode’s `tool/<name>.ts` + `<name>.txt`.
2. **COPY** the `.txt` into `vendor/opencode/tools/`.
3. **EXTRACT** any pure helpers worth keeping.
4. **ADAPT** a thin `src/agent/tools/<name>.ts` that uses `VirtualFS` / browser APIs.
5. Register in `src/agent/tools/registry.ts`.
6. Do not invent a new tool description if OpenCode already has one.

---

## LLM boundary

Any **OpenAI-compatible** endpoint (DeepSeek, OpenAI, OpenRouter, Ollama, LiteLLM, custom proxies):

1. Browser always calls Vite `/api/llm` (alias `/api/openai` still works).
2. Vite forwards to `X-LLM-Base-URL` (from UI / `VITE_LLM_BASE_URL`) or server `LLM_BASE_URL`, default `https://api.openai.com/v1`.
3. Auth: UI API key if set; else server `LLM_API_KEY` / `OPENAI_API_KEY`.
4. Model: UI → `VITE_LLM_MODEL` / `VITE_OPENAI_MODEL` → `gpt-4o-mini`.

In-app **LLM** panel overrides are stored in `localStorage` (`react-agent-llm`). See `.env.example`.

Web tools use `/api/fetch` and `/api/search` proxies (CORS). All workspace reads/edits stay in the VirtualFS (optionally synced via File System Access).
