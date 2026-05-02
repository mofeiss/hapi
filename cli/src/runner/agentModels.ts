import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

import { getDefaultClaudeCodePath } from '@/claude/sdk/utils'
import { fetchCodexModelCatalog } from '@/codex/utils/modelCatalog'
import type {
  AgentModel,
  AgentModelsResult,
  SpawnSessionOptions
} from '@/modules/common/rpcTypes'
import { logger } from '@/ui/logger'
import { withBunRuntimeEnv } from '@/utils/bunRuntime'

const execFileAsync = promisify(execFile)

export const FALLBACK_CODEX_MODELS: AgentModel[] = [
  {
    id: 'gpt-5.4',
    model: 'gpt-5.4',
    displayName: 'GPT-5.4',
    description: 'Fallback Codex model used when the local Codex app-server catalog is unavailable.',
    hidden: false,
    isDefault: true,
    defaultReasoningEffort: 'xhigh',
    supportedReasoningEfforts: [
      { reasoningEffort: 'xhigh', description: 'Extra high reasoning depth for complex problems' }
    ]
  }
]

export const FALLBACK_CLAUDE_MODELS: AgentModel[] = [
  {
    id: 'default',
    model: 'default',
    displayName: 'Default',
    description: 'Use the Claude Code default model selection; HAPI omits --model.',
    hidden: false,
    isDefault: true,
    defaultReasoningEffort: 'medium',
    supportedReasoningEfforts: []
  },
  {
    id: 'sonnet',
    model: 'sonnet',
    displayName: 'Sonnet',
    description: 'Claude Code alias for the latest Sonnet model.',
    hidden: false,
    isDefault: false,
    defaultReasoningEffort: 'medium',
    supportedReasoningEfforts: []
  },
  {
    id: 'opus',
    model: 'opus',
    displayName: 'Opus',
    description: 'Claude Code alias for the latest Opus model.',
    hidden: false,
    isDefault: false,
    defaultReasoningEffort: 'medium',
    supportedReasoningEfforts: []
  }
]

type ListRunnerAgentModelsDependencies = {
  fetchCodexModels?: typeof fetchCodexModelCatalog
  fetchClaudeHelp?: () => Promise<string>
}

function formatClaudeAliasLabel(alias: string): string {
  return alias
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function makeClaudeModel(alias: string, isDefault = false): AgentModel {
  return {
    id: alias,
    model: alias,
    displayName: isDefault ? 'Default' : formatClaudeAliasLabel(alias),
    description: isDefault
      ? 'Use the Claude Code default model selection; HAPI omits --model.'
      : `Claude Code public --model alias: ${alias}.`,
    hidden: false,
    isDefault,
    defaultReasoningEffort: 'medium',
    supportedReasoningEfforts: []
  }
}

export function parseClaudeCliModelAliases(helpText: string): string[] {
  const aliasSection = helpText.match(/alias[^()]*\(([^)]*)\)/i)?.[1] ?? ''
  const aliases = aliasSection.match(/'([^']+)'|"([^"]+)"/g) ?? []
  const unique = new Set<string>()

  for (const quoted of aliases) {
    const alias = quoted.slice(1, -1).trim()
    if (alias && !alias.startsWith('claude-')) {
      unique.add(alias)
    }
  }

  return [...unique]
}

async function fetchClaudeHelpFromCli(): Promise<string> {
  const command = getDefaultClaudeCodePath()
  const result = await execFileAsync(command, ['--help'], {
    encoding: 'utf8',
    env: withBunRuntimeEnv(process.env, { allowBunBeBun: false }),
    timeout: 5000,
    shell: false
  })
  return `${result.stdout ?? ''}\n${result.stderr ?? ''}`
}

export async function fetchClaudeCliModelCatalog(
  dependencies: Pick<ListRunnerAgentModelsDependencies, 'fetchClaudeHelp'> = {}
): Promise<AgentModel[]> {
  const helpText = await (dependencies.fetchClaudeHelp ?? fetchClaudeHelpFromCli)()
  const aliases = parseClaudeCliModelAliases(helpText)
  if (aliases.length === 0) {
    return FALLBACK_CLAUDE_MODELS
  }

  const models = [makeClaudeModel('default', true)]
  for (const alias of aliases) {
    models.push(makeClaudeModel(alias))
  }
  return models
}

export async function listRunnerAgentModels(
  agent: SpawnSessionOptions['agent'],
  dependencies: ListRunnerAgentModelsDependencies = {}
): Promise<AgentModelsResult> {
  const resolvedAgent = agent ?? 'codex'

  if (resolvedAgent === 'claude') {
    try {
      return {
        success: true,
        source: 'claude-cli',
        models: await fetchClaudeCliModelCatalog(dependencies)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      logger.debug(`[RUNNER RUN] Failed to fetch Claude models from CLI help: ${message}`)
      return {
        success: true,
        source: 'fallback-static',
        models: FALLBACK_CLAUDE_MODELS,
        error: `Failed to read Claude CLI model aliases dynamically: ${message}`
      }
    }
  }

  if (resolvedAgent !== 'codex') {
    return {
      success: false,
      error: `Model catalog is not supported for agent: ${resolvedAgent}`
    }
  }

  try {
    const fetchCodexModels = dependencies.fetchCodexModels ?? fetchCodexModelCatalog
    const models = await fetchCodexModels({
      includeHidden: false,
      limit: 100
    })

    if (models.length === 0) {
      return {
        success: true,
        source: 'fallback-static',
        models: FALLBACK_CODEX_MODELS,
        error: 'Codex app-server returned an empty model list; using fallback list'
      }
    }

    return {
      success: true,
      source: 'codex-app-server',
      models
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.debug(`[RUNNER RUN] Failed to fetch Codex models from app-server: ${message}`)
    return {
      success: true,
      source: 'fallback-static',
      models: FALLBACK_CODEX_MODELS,
      error: `Failed to fetch Codex model list dynamically: ${message}`
    }
  }
}
