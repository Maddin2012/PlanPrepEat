/**
 * Reicht dem Browser eine Datei zum Speichern.
 *
 * Warum nicht über `shareText` wie die Einkaufsliste? Der Teilen-Dialog ist für
 * ein paar Zeilen richtig, die in eine Notiz sollen. Eine Sicherung ist ein
 * Dokument von rund hundert Kilobyte, und manche Ziele — Google Notizen etwa —
 * nehmen so lange Texte gar nicht erst an. Eine Datei landet verlässlich in
 * „Downloads", von wo man sie in die Ablage der Wahl schieben kann.
 */
export function downloadText(filename: string, text: string): void {
  // BOM voran, damit Windows-Programme die Umlaute als UTF-8 erkennen und nicht
  // „Gemüse" daraus machen.
  const blob = new Blob(['﻿', text], {
    type: 'text/plain;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.style.display = 'none'
  document.body.append(link)
  link.click()
  link.remove()

  // Nicht sofort freigeben: Der Browser hat den Download in dem Moment erst
  // angestoßen, nicht abgeschlossen.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
