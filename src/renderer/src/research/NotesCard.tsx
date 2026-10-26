import { useState } from 'react'
import { Card, Empty, ErrorBanner, Md, btnGhost, btnPrimary, inputCls } from './ui'

/** Markdown notes: rendered with an Edit toggle; Save (or Cmd/Ctrl S) writes. A new `value` replaces the draft only while it is clean. */
export function NotesCard({
  value,
  onSave,
  saving,
  error,
  placeholder
}: {
  value: string
  onSave: (v: string) => void
  saving: boolean
  error: unknown
  placeholder: string
}): React.JSX.Element {
  const [draft, setDraft] = useState(value)
  const [base, setBase] = useState(value)
  const [editing, setEditing] = useState(!value)
  if (value !== base) {
    // Server value changed (our save landing, or a remote edit): follow it unless the user has unsaved typing.
    setBase(value)
    if (draft === base) {
      setDraft(value)
    }
  }
  const dirty = draft !== value
  return (
    <Card
      title="Notes"
      action={
        <div className="flex gap-2">
          <button type="button" className={btnGhost} onClick={() => setEditing(!editing)}>
            {editing ? 'Preview' : 'Edit'}
          </button>
          {(editing || dirty) && (
            <button
              type="button"
              className={btnPrimary}
              disabled={!dirty || saving}
              onClick={() => onSave(draft)}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          )}
        </div>
      }
    >
      {editing ? (
        <textarea
          className={`${inputCls} min-h-48 font-mono`}
          value={draft}
          onChange={(ev) => setDraft(ev.target.value)}
          onKeyDown={(ev) => {
            if ((ev.metaKey || ev.ctrlKey) && ev.key === 's') {
              ev.preventDefault()
              if (dirty) {
                onSave(draft)
              }
            }
          }}
          aria-label="Notes markdown"
          placeholder={placeholder}
        />
      ) : draft ? (
        <Md>{draft}</Md>
      ) : (
        <Empty hint="Choose Edit to write some.">No notes yet.</Empty>
      )}
      {dirty && <p className="mt-2 text-xs text-warn">Unsaved changes</p>}
      <div className="mt-2">
        <ErrorBanner error={error} />
      </div>
    </Card>
  )
}
