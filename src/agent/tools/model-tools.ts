// GREENFIELD: model → edit strategy (OpenCode registry.ts gating)

import { currentModelId as resolveCurrentModelId } from '../llm-config'

export function useApplyPatchOnly(modelId: string): boolean {
  return modelId.includes('gpt-') && !modelId.includes('oss') && !modelId.includes('gpt-4')
}

export function currentModelId(): string {
  return resolveCurrentModelId()
}
