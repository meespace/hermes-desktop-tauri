import { beforeEach, describe, expect, it } from 'vitest'

import {
  $perSessionBrowse,
  browseBackward,
  browseForward,
  deriveUserHistory,
  isBrowsingHistory,
  resetBrowseState
} from './composer-input-history'

const SESSION_A = 'session-a'
const SESSION_B = 'session-b'
const HISTORY = ['third', 'second', 'first']
const MSG = (role: string, text: string) => ({ id: '', role, text })

beforeEach(() => {
  $perSessionBrowse.set({})
})

describe('deriveUserHistory', () => {
  it('returns user messages newest-first with empty and assistant rows skipped', () => {
    const messages = [MSG('user', '   '), MSG('assistant', 'hi'), MSG('user', 'first'), MSG('user', 'second')]

    expect(deriveUserHistory(messages, message => message.text)).toEqual(['second', 'first'])
  })
})

describe('browseBackward', () => {
  it('returns null when history is empty', () => {
    expect(browseBackward(SESSION_A, '', [])).toBeNull()
  })

  it('returns the most recent entry on first press and saves the draft', () => {
    expect(browseBackward(SESSION_A, 'unsent draft', HISTORY)).toBe('third')
    expect($perSessionBrowse.get()[SESSION_A]!.draftSnapshot).toBe('unsent draft')
  })

  it('moves to older entries on subsequent presses and stops at the oldest', () => {
    expect(browseBackward(SESSION_A, '', HISTORY)).toBe('third')
    expect(browseBackward(SESSION_A, '', HISTORY)).toBe('second')
    expect(browseBackward(SESSION_A, '', HISTORY)).toBe('first')
    expect(browseBackward(SESSION_A, '', HISTORY)).toBeNull()
  })
})

describe('browseForward', () => {
  it('returns null when not browsing', () => {
    expect(browseForward(SESSION_A, HISTORY)).toBeNull()
  })

  it('moves toward the present', () => {
    browseBackward(SESSION_A, 'draft', HISTORY)
    browseBackward(SESSION_A, '', HISTORY)

    expect(browseForward(SESSION_A, HISTORY)).toEqual({
      text: 'third',
      returnedToPresent: false
    })
  })

  it('restores the saved draft and resets when reaching the present', () => {
    browseBackward(SESSION_A, 'my original draft', HISTORY)

    expect(browseForward(SESSION_A, HISTORY)).toEqual({ text: 'my original draft', returnedToPresent: true })
    expect(isBrowsingHistory(SESSION_A)).toBe(false)
  })
})

describe('per-session isolation', () => {
  it('tracks cursor and draft independently per session', () => {
    browseBackward(SESSION_A, 'draft-a', HISTORY)
    browseBackward(SESSION_A, '', HISTORY)
    browseBackward(SESSION_B, 'draft-b', HISTORY)

    expect($perSessionBrowse.get()[SESSION_A]!.cursor).toBe(1)
    expect($perSessionBrowse.get()[SESSION_A]!.draftSnapshot).toBe('draft-a')
    expect($perSessionBrowse.get()[SESSION_B]!.cursor).toBe(0)
    expect($perSessionBrowse.get()[SESSION_B]!.draftSnapshot).toBe('draft-b')
  })
})

describe('resetBrowseState', () => {
  it('clears cursor and draft snapshot', () => {
    browseBackward(SESSION_A, 'draft', HISTORY)
    resetBrowseState(SESSION_A)

    expect($perSessionBrowse.get()[SESSION_A]).toEqual({ cursor: -1, draftSnapshot: '' })
  })
})
