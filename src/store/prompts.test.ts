import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  $approvalRequest,
  $secretRequest,
  $sudoRequest,
  clearAllPrompts,
  clearApprovalRequest,
  clearSecretRequest,
  clearSudoRequest,
  setApprovalRequest,
  setSecretRequest,
  setSudoRequest
} from './prompts'
import { $activeSessionId } from './session'

beforeEach(() => {
  $activeSessionId.set('s1')
})

afterEach(() => {
  clearAllPrompts()
  $activeSessionId.set(null)
})

describe('approval prompt store', () => {
  it('holds the active session-keyed approval request', () => {
    setApprovalRequest({ command: 'rm -rf /tmp/x', description: 'recursive delete', sessionId: 's1' })

    expect($approvalRequest.get()).toEqual({
      command: 'rm -rf /tmp/x',
      description: 'recursive delete',
      sessionId: 's1'
    })
  })

  it('parks a background session prompt out of the active view', () => {
    setApprovalRequest({ command: 'x', description: 'd', sessionId: 's2' })

    expect($approvalRequest.get()).toBeNull()

    $activeSessionId.set('s2')
    expect($approvalRequest.get()?.sessionId).toBe('s2')
  })

  it('clears the active session prompt', () => {
    setApprovalRequest({ command: 'x', description: 'd', sessionId: 's1' })
    clearApprovalRequest('s1')

    expect($approvalRequest.get()).toBeNull()
  })
})

describe('sudo prompt store', () => {
  it('clears only when the request id matches the in-flight prompt', () => {
    setSudoRequest({ requestId: 'abc', sessionId: 's1' })

    clearSudoRequest('s1', 'stale')
    expect($sudoRequest.get()).toEqual({ requestId: 'abc', sessionId: 's1' })

    clearSudoRequest('s1', 'abc')
    expect($sudoRequest.get()).toBeNull()
  })

  it('clears unconditionally when no request id is given', () => {
    setSudoRequest({ requestId: 'abc', sessionId: 's1' })
    clearSudoRequest('s1')

    expect($sudoRequest.get()).toBeNull()
  })
})

describe('secret prompt store', () => {
  it('carries env var and prompt, and clears on id match', () => {
    setSecretRequest({ requestId: 'r1', envVar: 'OPENAI_API_KEY', prompt: 'Paste your key', sessionId: 's1' })

    expect($secretRequest.get()).toEqual({
      requestId: 'r1',
      envVar: 'OPENAI_API_KEY',
      prompt: 'Paste your key',
      sessionId: 's1'
    })

    clearSecretRequest('s1', 'mismatch')
    expect($secretRequest.get()).not.toBeNull()

    clearSecretRequest('s1', 'r1')
    expect($secretRequest.get()).toBeNull()
  })
})

describe('clearAllPrompts', () => {
  it('drops every kind for one session at once', () => {
    setApprovalRequest({ command: 'x', description: 'd', sessionId: 's1' })
    setSudoRequest({ requestId: 'abc', sessionId: 's1' })
    setSecretRequest({ requestId: 'r1', envVar: 'E', prompt: 'p', sessionId: 's1' })

    clearAllPrompts('s1')

    expect($approvalRequest.get()).toBeNull()
    expect($sudoRequest.get()).toBeNull()
    expect($secretRequest.get()).toBeNull()
  })

  it('leaves other sessions parked prompts intact', () => {
    setApprovalRequest({ command: 'x', description: 'd', sessionId: 's1' })
    setApprovalRequest({ command: 'y', description: 'e', sessionId: 's2' })

    clearAllPrompts('s1')

    $activeSessionId.set('s2')
    expect($approvalRequest.get()?.command).toBe('y')
  })
})
