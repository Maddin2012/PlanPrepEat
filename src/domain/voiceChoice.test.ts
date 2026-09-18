import { describe, expect, it } from 'vitest'
import {
  DEFAULT_VOICE_CHOICE,
  PITCH,
  TEMPO,
  pickVoiceName,
  toPitch,
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

describe('toPitch', () => {
  it('nimmt die drei gültigen Stufen an', () => {
    expect(toPitch('tief')).toBe('tief')
    expect(toPitch('normal')).toBe('normal')
    expect(toPitch('hoch')).toBe('hoch')
  })

  it('macht aus allem anderen „normal"', () => {
    expect(toPitch('dunkel')).toBe('normal')
    expect(toPitch('')).toBe('normal')
    expect(toPitch(0.8)).toBe('normal')
    expect(toPitch(undefined)).toBe('normal')
    expect(toPitch(null)).toBe('normal')
  })
})

describe('PITCH', () => {
  it('lässt „normal" auf der Vorgabe des Browsers', () => {
    // Wer nichts umstellt, muss genau dasselbe hören wie vorher.
    expect(PITCH.normal).toBe(1)
  })

  it('steigt von tief nach hoch', () => {
    expect(PITCH.tief).toBeLessThan(PITCH.normal)
    expect(PITCH.normal).toBeLessThan(PITCH.hoch)
  })

  it('bleibt im Bereich, den die Sprachausgabe annimmt', () => {
    // Außerhalb von 0 bis 2 wirft der Browser; und ganz unten scheppert es.
    for (const wert of Object.values(PITCH)) {
      expect(wert).toBeGreaterThanOrEqual(0.5)
      expect(wert).toBeLessThanOrEqual(2)
    }
  })
})

describe('toVoiceChoice', () => {
  it('liest einen gespeicherten Stand', () => {
    expect(toVoiceChoice({ name: 'Markus', tempo: 'zuegig', pitch: 'tief' })).toEqual({
      name: 'Markus',
      tempo: 'zuegig',
      pitch: 'tief',
    })
  })

  it('verkraftet einen Stand aus der Fassung ohne Tonhöhe', () => {
    // Der Fall beim Update: gespeichert wurde, als es `pitch` noch nicht gab.
    // Stimme und Tempo müssen stehen bleiben.
    expect(toVoiceChoice({ name: 'Markus', tempo: 'zuegig' })).toEqual({
      name: 'Markus',
      tempo: 'zuegig',
      pitch: 'normal',
    })
  })

  it('liest wieder ein, was es selbst weggeschrieben hat', () => {
    const wahl = { name: 'Anna', tempo: 'langsam', pitch: 'hoch' } as const
    expect(toVoiceChoice(JSON.parse(JSON.stringify(wahl)))).toEqual(wahl)
  })

  it('verkraftet einen kaputten Stand', () => {
    expect(toVoiceChoice(null)).toEqual(DEFAULT_VOICE_CHOICE)
    expect(toVoiceChoice('Markus')).toEqual(DEFAULT_VOICE_CHOICE)
    expect(toVoiceChoice({})).toEqual(DEFAULT_VOICE_CHOICE)
    expect(toVoiceChoice({ name: 42, tempo: 'egal' })).toEqual(DEFAULT_VOICE_CHOICE)
  })

  it('nimmt einen leeren Namen als „nichts gewählt"', () => {
    expect(toVoiceChoice({ name: '  ', tempo: 'langsam', pitch: 'tief' })).toEqual({
      name: null,
      tempo: 'langsam',
      pitch: 'tief',
    })
  })
})
