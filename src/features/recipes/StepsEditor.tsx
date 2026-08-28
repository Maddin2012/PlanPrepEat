import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { NO_SWIPE } from '../../lib/gesture.ts'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  restrictToParentElement,
  restrictToVerticalAxis,
} from '@dnd-kit/modifiers'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Button, IconButton, cx } from '../../components/ui.tsx'
import { CloseIcon, GripIcon, PlusIcon } from '../../components/Icons.tsx'
import { MicButton } from '../../components/MicButton.tsx'
import { splitSpokenSteps } from '../../domain/dictation.ts'
import { newId } from '../../data/ids.ts'

/**
 * Ein Schritt im Formular.
 *
 * Der Schlüssel ist reine Formularsache — gespeichert wird weiterhin nur Text
 * mit Zeilenumbrüchen. Er wird gebraucht, damit React und `dnd-kit` einen
 * Schritt über das Verschieben hinweg wiedererkennen. Mit der Position als
 * Kennung hinge der Cursor beim Umsortieren am falschen Feld — dasselbe Muster
 * wie bei den Zutatenzeilen in `ingredientDraft.ts`.
 */
export interface StepDraft {
  key: string
  text: string
}

export function emptyStep(text = ''): StepDraft {
  return { key: newId(), text }
}

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
  steps: StepDraft[]
  onChange: (steps: StepDraft[]) => void
}) {
  const fields = useRef(new Map<string, HTMLTextAreaElement>())
  // Wohin der Cursor nach dem nächsten Rendern springen soll. Beim Teilen und
  // Verschmelzen existiert das Zielfeld im Moment des Tastendrucks noch nicht.
  const [pendingFocus, setPendingFocus] = useState<{
    key: string
    caret: number
  } | null>(null)

  const sensors = useSensors(
    // Erst nach ein paar Pixeln Bewegung greifen — sonst zählte schon das
    // Antippen des Griffs als Ziehen.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  useEffect(() => {
    if (!pendingFocus) return
    const field = fields.current.get(pendingFocus.key)
    if (field) {
      field.focus()
      field.setSelectionRange(pendingFocus.caret, pendingFocus.caret)
    }
    setPendingFocus(null)
  }, [pendingFocus])

  function replace(next: StepDraft[], focus?: { key: string; caret: number }) {
    // Ganz ohne Schritt stünde man vor einem Formular ohne Eingabefeld.
    onChange(next.length > 0 ? next : [emptyStep()])
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
      // Der obere Teil behält den Schlüssel, der neue untere bekommt einen
      // eigenen — so bleibt oben stehen, was vorher da war.
      const created = emptyStep(value.slice(selectionEnd))
      const next = [...steps]
      next.splice(index, 1, { ...steps[index], text: value.slice(0, selectionStart) }, created)
      replace(next, { key: created.key, caret: 0 })
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
      next.splice(index - 1, 2, { ...previous, text: previous.text + value })
      replace(next, { key: previous.key, caret: previous.text.length })
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
    // Mindestens zwei Teile, sonst wären wir oben schon ausgestiegen.
    const parts = text.split(/\r?\n/)
    const last = emptyStep((parts.at(-1) ?? '') + after)

    const inserted: StepDraft[] = [
      { ...steps[index], text: before + parts[0] },
      ...parts.slice(1, -1).map((part) => emptyStep(part)),
      last,
    ]
    const next = [...steps]
    next.splice(index, 1, ...inserted)
    replace(next, { key: last.key, caret: (parts.at(-1) ?? '').length })
  }

  /**
   * Ein diktierter Abschnitt wird ein Schritt — bei mehreren Sätzen am Stück
   * entsprechend mehrere. Ein noch leerer letzter Schritt wird dabei aufgefüllt
   * statt übersprungen.
   */
  function addSpoken(text: string) {
    const spoken = splitSpokenSteps(text)
    if (spoken.length === 0) return
    const base = steps.at(-1)?.text.trim() ? steps : steps.slice(0, -1)
    onChange([...base, ...spoken.map((part) => emptyStep(part))])
  }

  function move(fromKey: string, toKey: string) {
    const from = steps.findIndex((step) => step.key === fromKey)
    const to = steps.findIndex((step) => step.key === toKey)
    if (from === -1 || to === -1 || from === to) return
    onChange(arrayMove(steps, from, to))
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

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis, restrictToParentElement]}
        onDragEnd={({ active, over }) => {
          if (over && active.id !== over.id) {
            move(String(active.id), String(over.id))
          }
        }}
      >
        <SortableContext
          items={steps.map((step) => step.key)}
          strategy={verticalListSortingStrategy}
        >
          <ol className="space-y-2">
            {steps.map((step, index) => (
              <SortableStep
                key={step.key}
                step={step}
                index={index}
                canMove={steps.length > 1}
                register={(element) => {
                  if (element) fields.current.set(step.key, element)
                  else fields.current.delete(step.key)
                }}
                onChangeText={(text) => {
                  const next = [...steps]
                  next[index] = { ...step, text }
                  onChange(next)
                }}
                onKeyDown={(event) => handleKeyDown(event, index)}
                onPaste={(event) => handlePaste(event, index)}
                onSpoken={(text) => {
                  // Anhängen statt ersetzen: Wer einen Schritt ergänzt, will
                  // das schon Getippte nicht verlieren.
                  const next = [...steps]
                  const vorhanden = step.text.trim()
                  next[index] = {
                    ...step,
                    text: vorhanden ? `${vorhanden} ${text}` : text,
                  }
                  onChange(next)
                }}
                onRemove={() =>
                  replace(steps.filter((entry) => entry.key !== step.key))
                }
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>

      <Button
        variant="secondary"
        block
        className="mt-2"
        onClick={() => {
          const created = emptyStep()
          replace([...steps, created], { key: created.key, caret: 0 })
        }}
      >
        <PlusIcon className="size-5" />
        Schritt hinzufügen
      </Button>
    </section>
  )
}

function SortableStep({
  step,
  index,
  canMove,
  register,
  onChangeText,
  onKeyDown,
  onPaste,
  onSpoken,
  onRemove,
}: {
  step: StepDraft
  index: number
  /** Bei einem einzigen Schritt gibt es nichts zu verschieben. */
  canMove: boolean
  register: (element: HTMLTextAreaElement | null) => void
  onChangeText: (text: string) => void
  onKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void
  onPaste: (event: React.ClipboardEvent<HTMLTextAreaElement>) => void
  onSpoken: (text: string) => void
  onRemove: () => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: step.key })

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cx(
        'flex items-start gap-1 rounded-xl bg-surface p-2 ring-1 ring-clay-200',
        // Die gezogene Zeile über die anderen legen, sonst verschwindet sie
        // beim Vorbeiziehen unter der Nachbarzeile.
        isDragging && 'relative z-10 shadow-lg ring-accent',
      )}
    >
      {canMove && (
        <button
          type="button"
          ref={setActivatorNodeRef}
          aria-label={`Schritt ${index + 1} verschieben`}
          // Hier wird gezogen, nicht gewischt.
          {...{ [NO_SWIPE]: true }}
          // touch-none verhindert, dass der Browser die Geste als Scrollen
          // beansprucht, bevor dnd-kit sie überhaupt zu sehen bekommt.
          className="mt-1.5 flex size-7 shrink-0 touch-none items-center justify-center text-clay-300 transition-colors active:text-ink-500"
          {...attributes}
          {...listeners}
        >
          <GripIcon className="size-5" />
        </button>
      )}

      <span className="mt-2 flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent-text">
        {index + 1}
      </span>

      <StepField
        value={step.text}
        register={register}
        onChange={onChangeText}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        label={`Schritt ${index + 1}`}
        placeholder={index === 0 ? 'Zwiebeln würfeln und anbraten.' : ''}
      />

      {/* Füllt genau diesen Schritt und hört nach einem Satz von selbst auf —
          anders als der Knopf oben, der neue Schritte anlegt. */}
      <MicButton
        small
        once
        label={`Schritt ${index + 1}`}
        hint="Ein Satz für diesen Schritt."
        className="mt-1"
        onChunk={onSpoken}
      />

      <IconButton
        label={`Schritt ${index + 1} entfernen`}
        className="mt-0.5 size-9 shrink-0 text-ink-400"
        onClick={onRemove}
      >
        <CloseIcon className="size-4.5" />
      </IconButton>
    </li>
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
export function stepsFromText(text: string): StepDraft[] {
  const parts = text.split('\n')
  return parts.length > 0 ? parts.map((part) => emptyStep(part)) : [emptyStep()]
}

/** Schritte → Text mit Zeilenumbrüchen, wie er gespeichert wird. */
export function stepsToText(steps: StepDraft[]): string {
  return steps
    .map((step) => step.text.trim())
    .filter(Boolean)
    .join('\n')
}
