import { useEffect, useRef, useState } from 'react'
import { useSaveScratchpad, useScratchpad } from '../../api/client'
import { Bone, Card, Empty, ErrorBanner, Md, btnGhost } from '../../ui'

const SAVE_DELAY_MS = 1500
const MAX_FAILS = 3

/** Free form markdown pad; autosaves 1.5 s after typing stops, and on leaving the page. The local draft wins over refetches until it is saved. */
export function Scratchpad(): React.JSX.Element {
  const { data, error } = useScratchpad()
  const save = useSaveScratchpad()
  const [draft, setDraft] = useState<string | null>(null)
  const [fails, setFails] = useState(0)
  const [preview, setPreview] = useState(false)
  const saved = data?.markdown ?? ''
  const text = draft ?? saved
  const dirty = draft !== null && draft !== saved
  const { mutate, isPending } = save
  const unsaved = useRef<string | null>(null)
  unsaved.current = dirty ? draft : null

  // Once saved, drop the draft so later refetches (other tabs, agent edits) show through.
  useEffect(() => {
    if (draft !== null && draft === saved) {
      setDraft(null)
    }
  }, [draft, saved])

  useEffect(() => {
    if (draft === null || draft === saved || isPending || fails >= MAX_FAILS) {
      return
    }
    const t = setTimeout(
      () =>
        mutate(draft, {
          onSuccess: () => setFails(0),
          onError: () => setFails((f) => f + 1)
        }),
      SAVE_DELAY_MS
    )
    return () => clearTimeout(t)
  }, [draft, saved, isPending, fails, mutate])

  // Flush a pending edit when the page is left (route or Orca view change unmounts) or the window hides.
  useEffect(() => {
    const flush = (): void => {
      if (unsaved.current !== null) {
        mutate(unsaved.current)
      }
    }
    const onHide = (): void => {
      if (document.visibilityState === 'hidden') {
        flush()
      }
    }
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', flush)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', flush)
      flush()
    }
  }, [mutate])

  const status = isPending
    ? 'Saving…'
    : save.error
      ? fails >= MAX_FAILS
        ? 'Save failed, type to retry'
        : 'Save failed, retrying…'
      : dirty
        ? 'Unsaved'
        : data?.updated_at
          ? `Saved ${new Date(data.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
          : ''

  return (
    <Card
      title="Scratchpad"
      action={
        <div className="flex items-center gap-3">
          <span
            className={`text-xs ${save.error ? 'text-bad' : 'text-ink-muted'}`}
            aria-live="polite"
            data-testid="scratchpad-status"
          >
            {status}
          </span>
          <button type="button" className={btnGhost} onClick={() => setPreview(!preview)}>
            {preview ? 'Edit' : 'Preview'}
          </button>
        </div>
      }
    >
      <ErrorBanner error={error} />
      {!data && !error ? (
        <Bone className="h-60" />
      ) : preview ? (
        text ? (
          <Md>{text}</Md>
        ) : (
          <Empty>The scratchpad is empty.</Empty>
        )
      ) : (
        <textarea
          className="min-h-60 w-full resize-y rounded-md bg-transparent text-sm leading-7 text-ink outline-none placeholder:text-ink-muted"
          value={text}
          onChange={(e) => {
            setDraft(e.target.value)
            setFails(0)
          }}
          aria-label="Scratchpad markdown"
          placeholder="Jot anything: todos, observations, things to ask the agent. Markdown, autosaves."
        />
      )}
    </Card>
  )
}
