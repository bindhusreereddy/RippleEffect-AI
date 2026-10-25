import { useCallback, useState } from 'react';

export default function useEditHistory() {
  const [history, setHistory] = useState({ past: [], present: [], future: [] });
  const setEdits = useCallback(update => setHistory(previous => {
    const next = typeof update === 'function' ? update(previous.present) : update;
    if (JSON.stringify(next) === JSON.stringify(previous.present)) return previous;
    return { past: [...previous.past.slice(-29), previous.present], present: next, future: [] };
  }), []);
  const resetHistory = useCallback(edits => setHistory({ past: [], present: edits, future: [] }), []);
  const undo = useCallback(() => setHistory(previous => !previous.past.length ? previous : ({ past: previous.past.slice(0, -1), present: previous.past.at(-1), future: [previous.present, ...previous.future] })), []);
  const redo = useCallback(() => setHistory(previous => !previous.future.length ? previous : ({ past: [...previous.past, previous.present], present: previous.future[0], future: previous.future.slice(1) })), []);
  return { edits: history.present, setEdits, resetHistory, undo, redo, canUndo: !!history.past.length, canRedo: !!history.future.length };
}
