import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  normalizeSessionLog,
  normalizeStdout,
  runScenario,
  scrubRequestHeaders,
  type AgentUnderTest,
  type InputScript,
  type NormalizeContext,
} from '@deepseek-ai/dsh-acp-snapshot'
import type { SessionEvent } from '@deepseek-ai/dsh-session'
import { describe, expect, it } from 'vitest'

// The port-allocation scenario owns one snapshot root: the assembled app runs
// the real ports registry against a JSON store, and the transcript pins the
// tool guidance, the fresh allocation, and the stable reuse of one purpose.
const scenarioDir = join(dirname(fileURLToPath(import.meta.url)), 'ports-snapshots/allocate')
const fixtureFile = join(scenarioDir, 'session.jsonl')
const overrideFile = join(scenarioDir, 'replay.override.json')
const stdoutExpected = join(scenarioDir, 'stdout.expected.jsonl')
const sessionExpected = join(scenarioDir, 'session.expected.jsonl')
const refreshing = process.env.DSH_SNAPSHOT === 'refresh'

const agent: AgentUnderTest = {
  binScript: fileURLToPath(new URL('../../../packages/examples/acp-demo/src/bin.ts', import.meta.url)),
  configPath: fileURLToPath(new URL('../ports.cordis.yml', import.meta.url)),
  tsconfigPath: fileURLToPath(new URL('../../../tsconfig.json', import.meta.url)),
}

interface JsonObject {
  [key: string]: unknown
}

/** Parse non-empty records from one JSONL artifact. */
function parseJsonl(content: string): JsonObject[] {
  return content.split('\n').filter(line => line.trim().length > 0)
    .map(line => JSON.parse(line) as JsonObject)
}

/** Zero allocated port numbers so replay stays host-independent (the OS decides the first free port). */
function normalizePorts(content: string): string {
  return content.replace(/\bport \d+\b/g, 'port 0')
}

describe('port allocation snapshot through the ACP automation driver', () => {
  it('allocates one purpose, then reuses the same port for it, in the shipped app', async () => {
    const input = JSON.parse(await readFile(join(scenarioDir, 'input.json'), 'utf8')) as InputScript
    const result = await runScenario(input, {
      agent,
      mode: 'replay',
      fixtureFile,
      overrideFile,
      configPath: agent.configPath,
    })

    // Node 22 emits an ExperimentalWarning for node:sqlite when the demo's
    // session-query engine starts; Node 24+ is quiet. Filter exactly those two
    // known lines so the scenario replays on both families; anything else in
    // stderr still fails (the repo pins the quiet boot in the built-CLI smoke).
    const stderr = result.stderr
      .split('\n')
      .filter(line => !line.includes('ExperimentalWarning: SQLite') && !line.includes('node --trace-warnings'))
      .join('\n')
    expect(stderr).toBe('')
    expect(result.sessionLogs).toHaveLength(1)
    const log = result.sessionLogs[0]
    if (log === undefined) throw new Error('ports snapshot did not persist its session')
    const records = parseJsonl(log.content)
    const events = records.slice(1) as unknown as SessionEvent[]

    // Both model turns called the tool with the same purpose, then the second
    // allocation must have reused the first one's port (stable across calls).
    const calls = events.filter(event => event.type === 'tool/call').map(event => event.data.name)
    expect(calls).toEqual(['allocate_port', 'allocate_port'])
    const callIds = events
      .flatMap(event => event.type === 'tool/call' && event.data.name === 'allocate_port' ? [event.data] : [])
      .map(data => data.callId)
    const resultTexts = events
      .flatMap(event => event.type === 'tool/result' ? [event.data.message] : [])
      .map(message => message.content[0])
      .filter(block => callIds.includes(block.toolCallId))
      .map(block => block.content.map(item => item.type === 'text' ? item.text : '').join(''))
    expect(resultTexts[0]).toContain('Allocated port')
    expect(resultTexts[1]).toContain('Reusing port')
    expect(resultTexts[1]).toContain('call release_port when the server stops')
    const firstPort = /port (\d+)/.exec(resultTexts[0] ?? '')?.[1]
    const secondPort = /port (\d+)/.exec(resultTexts[1] ?? '')?.[1]
    expect(firstPort).toBeDefined()
    expect(secondPort).toBe(firstPort)

    const context: NormalizeContext = {
      sessionIds: [result.sessionId, log.id].filter((id): id is string => id !== undefined),
      cwd: result.cwd,
    }
    const stdout = normalizePorts(normalizeStdout(result.rawStdout, context))
    const session = normalizePorts(scrubRequestHeaders(normalizeSessionLog(log.content, context)))
    if (refreshing) {
      await Promise.all([
        writeFile(stdoutExpected, stdout),
        writeFile(sessionExpected, session),
      ])
    }
    expect(stdout).toBe(await readFile(stdoutExpected, 'utf8'))
    expect(session).toBe(await readFile(sessionExpected, 'utf8'))
  })
})
