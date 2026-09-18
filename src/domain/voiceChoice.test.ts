import { describe, expect, it } from 'vitest'
import {
  DEFAULT_VOICE_CHOICE,
  TEMPO,
  pickVoiceName,
  toTempo,
  toVoiceChoice,
} from './voiceChoice.ts'

const STIMMEN = ['Anna', 'Markus', 'Google Deutsch']

describe('pickVoiceName', () => {
  it('nimmt die gewählte Stimme, wenn es sie auf dem Gerät gibt', () => {
    expect(pickVoiceName(STIMMEN, 'Markus')).toBe('Markus')
  })

  it('fällt auf die erste zurück, wenn die gewählte verschwunden ist', () => {
    // Der Fall nach einem Android-Update oder auf dem zweiten Gerät.
    expect(pickVoiceName(STIMMEN, 'Petra')).toBe('Anna')
  })

  it('nimmt die erste, solange nichts gewählt wurde', () => {
    expect(pickVoiceName(STIMMEN, null)).toBe('Anna')
  })

  it('gibt ohne Stimmen null zurück', () => {
    expect(pickVoiceName([], 'Markus')).toBeNull()
    expect(pickVoiceName([], null)).toBeNull()
  })
})

describe('toTempo', () => {
  it('nimmt die drei gültigen Stufen an', () => {
    expect(toTempo('langsam')).toBe('langsam')
    expect(toTempo('normal')).toBe('normal')
    expect(toTempo('zuegig')).toBe('zuegig')
  })

  it('macht aus allem anderen „normal"', () => {
    expect(toTempo('schnell')).toBe('normal')
    expect(toTempo('')).toBe('normal')
    expect(toTempo(1.15)).toBe('normal')
    expect(toTempo(undefined)).toBe('normal')
    expect(toTempo(null)).toBe('normal')
  })
})

describe('TEMPO', () => {
  it('lässt „normal" auf dem bisherigen Wert', () => {
    // Wer nichts umstellt, muss genau dasselbe hören wie vorher.
    expect(TEMPO.normal).toBe(0.95)
  })

  it('steigt von langsam nach zügig', () => {
    expect(TEMPO.langsam).toBeLessThan(TEMPO.normal)
    expect(TEMPO.normal).toBeLessThan(TEMPO.zuegig)
  })
})

describe('toVoiceChoice', () => {
  it('liest einen gespeicherten Stand', () => {
    expect(toVoiceChoice({ name: 'Markus', tempo: 'zuegig' })).toEqual({
      name: 'Markus',
      tempo: 'zuegig',
    })
  })

  it('verkraftet einen kaputten Stand', () => {
    expect(toVoiceChoice(null)).toEqual(DEFAULT_VOICE_CHOICE)
    expect(toVoiceChoice('Markus')).toEqual(DEFAULT_VOICE_CHOICE)
    expect(toVoiceChoice({})).toEqual(DEFAULT_VOICE_CHOICE)
    expect(toVoiceChoice({ name: 42, tempo: 'egal' })).toEqual(DEFAULT_VOICE_CHOICE)
  })

  it('nimmt einen leeren Namen als „nichts gewählt"', () => {
    expect(toVoiceChoice({ name: '  ', tempo: 'langsam' })).toEqual({
      name: null,
      tempo: 'langsam',
    })
  })
})
