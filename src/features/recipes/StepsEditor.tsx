import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Button, IconButton } from '../../components/ui.tsx'
import { CloseIcon, PlusIcon } from '../../components/Icons.tsx'
import { MicButton } from '../../components/MicButton.tsx'
import { splitSpokenSteps } from '../../domain/dictation.ts'

/**
 * Die Zubereitung als nummerierte Schrittliste.
 *
 * Jeder Schritt ist ein eigenes, mitwachsendes Textfeld. Die Eingabetaste legt
 * einen neuen Schritt an, statt einen Zeilenumbruch zu setzen — genau das macht
 * beim Eintippen eines Rezepts den Unterschied zwischen „Liste" und „Textblock".
 *
 * Nach außen bleibt es ein Text mit Zeilenumbrüchen: Das Speicherformat ändert
 * sich nicht, und die Rezeptansicht trennt weiterhin selbst an `\n`.
 */
export function StepsEditor({
  steps,
  onChange,
}: {
  steps: string[]
  onChange: (steps: string[]) => void
}) {
  const fields = useRef(new Map<number, HTMLTextAreaElement>())
  // Wohin der Cursor nach dem nächsten Rendern springen soll. Beim Teilen und
  // Verschmelzen existiert das Zielfeld im Moment des Tastendrucks noch nicht.
  const [pendingFocus, setPendingFocus] = useState<{
    index: number
    caret: number
  } | null>(null)

  useEffect(() => {
    if (!pendingFocus) return
    const field = fields.current.get(pendingFocus.index)
    if (field) {
      field.focus()
      field.setSelectionRange(pendingFocus.caret, pendingFocus.caret)
    }
    setPendingFocus(null)
  }, [pendingFocus])

  function replace(next: string[], focus?: { index: number; caret: number }) {
    // Ganz ohne Schritt stünde man vor einem Formular ohne Eingabefeld.
    onChange(next.length > 0 ? next : [''])
    if (focus) setPendingFocus(focus)
  }

  function handleKeyDown(
    event: React.KeyboardEvent<HTMLTextAreaElement>,
    index: number,
  ) {
    const field = event.currentTarget
    const { selectionStart, selectionEnd, value } = field

    if (event.key === 'Enter') {
      event.preventDefault()
      const before = value.slice(0, selectionStart)
      const after = value.slice(selectionEnd)
      const next = [...steps]
      next.splice(index, 1, before, after)
      replace(next, { index: index + 1, caret: 0 })
      return
    }

    // Rücktaste ganz am Anfang: mit dem Schritt darüber verschmelzen. Fühlt
    // sich an wie in jeder Textverarbeitung und ist der Weg, einen versehentlich
    // angelegten Schritt wieder loszuwerden.
    if (
      event.key === 'Backspace' &&
      selectionStart === 0 &&
      selectionEnd === 0 &&
      index > 0
    ) {
      event.preventDefault()
      const previous = steps[index - 1]
      const next = [...steps]
      next.splice(index - 1, 2, previous + value)
      replace(next, { index: index - 1, caret: previous.length })
    }
  }

  function handlePaste(
    event: React.ClipboardEvent<HTMLTextAreaElement>,
    index: number,
  ) {
    const text = event.clipboardData.getData('text')
    if (!text.includes('\n')) return

    // Ein aus einer anderen Quelle kopiertes Rezept soll als mehrere Schritte
    // landen, nicht als ein Klumpen mit Zeilenumbrüchen darin.
    event.preventDefault()
    const field = event.currentTarget
    const before = field.value.slice(0, field.selectionStart)
    const after = field.value.slice(field.selectionEnd)
    const parts = text.split(/\r?\n/)

    const inserted = [
      before + parts[0],
      ...parts.slice(1, -1),
      (parts.at(-1) ?? '') + after,
    ]
    const next = [...steps]
    next.splice(index, 1, ...inserted)
    replace(next, {
      index: index + inserted.length - 1,
      caret: (parts.at(-1) ?? '').length,
    })
  }

  /**
   * Ein diktierter Abschnitt wird ein Schritt — bei mehreren Sätzen am Stück
   * entsprechend mehrere. Ein noch leerer letzter Schritt wird dabei aufgefüllt
   * statt übersprungen.
   */
  function addSpoken(text: string) {
    const spoken = splitSpokenSteps(text)
    if (spoken.length === 0) return
    const base = steps.at(-1)?.trim() ? steps : steps.slice(0, -1)
    onChange([...base, ...spoken])
  }

  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-ink-600">Zubereitung</h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-ink-400">
            Eingabetaste = nächster Schritt
          </span>
          <MicButton
            label="Zubereitung"
            hint="Ein Schritt nach dem anderen, mit kurzer Pause dazwischen."
            onChunk={addSpoken}
          />
        </div>
      </div>

      <ol className="space-y-2">
        {steps.map((step, index) => (
          <li
            key={index}
            className="flex items-start gap-2 rounded-xl bg-surface p-2 ring-1 ring-clay-200"
          >
            <span className="mt-2 flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent-text">
              {index + 1}
            </span>

            <StepField
              value={step}
              register={(element) => {
                if (element) fields.current.set(index, element)
                else fields.current.delete(index)
              }}
              onChange={(value) => {
                const next = [...steps]
                next[index] = value
                onChange(next)
              }}
              onKeyDown={(event) => handleKeyDown(event, index)}
              onPaste={(event) => handlePaste(event, index)}
              label={`Schritt ${index + 1}`}
              placeholder={index === 0 ? 'Zwiebeln würfeln und anbraten.' : ''}
            />

            <IconButton
              label={`Schritt ${index + 1} entfernen`}
              className="mt-0.5 size-9 shrink-0 text-ink-400"
              onClick={() =>
                replace(steps.filter((_, position) => position !== index))
              }
            >
              <CloseIcon className="size-4.5" />
            </IconButton>
          </li>
        ))}
      </ol>

      <Button
        variant="secondary"
        block
        className="mt-2"
        onClick={() => replace([...steps, ''], { index: steps.length, caret: 0 })}
      >
        <PlusIcon className="size-5" />
        Schritt hinzufügen
      </Button>
    </section>
  )
}

/** Ein Textfeld, das mit seinem Inhalt mitwächst statt zu scrollen. */
function StepField({
  value,
  register,
  onChange,
  onKeyDown,
  onPaste,
  label,
  placeholder,
}: {
  value: string
  register: (element: HTMLTextAreaElement | null) => void
  onChange: (value: string) => void
  onKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void
  onPaste: (event: React.ClipboardEvent<HTMLTextAreaElement>) => void
  label: string
  placeholder?: string
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null)

  // Vor dem Zeichnen messen, sonst blitzt bei jedem Tastendruck kurz die
  // alte Höhe auf.
  useLayoutEffect(() => {
    const field = ref.current
    if (!field) return
    field.style.height = 'auto'
    field.style.height = `${field.scrollHeight}px`
  }, [value])

  return (
    <textarea
      ref={(element) => {
        ref.current = element
        register(element)
      }}
      rows={1}
      value={value}
      aria-label={label}
      placeholder={placeholder}
      // Zeigt auf der Handytastatur einen Zeilenumbruch-Pfeil statt „Los".
      enterKeyHint="enter"
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={onKeyDown}
      onPaste={onPaste}
      className="min-w-0 flex-1 resize-none overflow-hidden rounded-lg bg-transparent px-2 py-2 leading-relaxed text-ink-900 outline-none placeholder:text-ink-400 focus:bg-accent-soft"
    />
  )
}

/** Text mit Zeilenumbrüchen → Schritte fürs Formular. */
export function stepsFromText(text: string): string[] {
  const steps = text.split('\n')
  return steps.length > 0 ? steps : ['']
}

/** Schritte → Text mit Zeilenumbrüchen, wie er gespeichert wird. */
export function stepsToText(steps: string[]): string {
  return steps
    .map((step) => step.trim())
    .filter(Boolean)
    .join('\n')
}
