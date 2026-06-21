/**
 * useHistory — простой стек снимков состояния для кнопки «Отменить».
 * Ограничивает историю MAX_HISTORY записями, чтобы не раздувать память.
 */
import { useState, useCallback, useRef } from 'react';

const MAX_HISTORY = 30;

export function useHistory() {
  const historyRef = useRef([]);
  const [canUndo, setCanUndo] = useState(false);

  const pushSnapshot = useCallback((snapshot) => {
    const next = [...historyRef.current, snapshot];
    if (next.length > MAX_HISTORY) next.shift();
    historyRef.current = next;
    setCanUndo(next.length > 0);
  }, []);

  const undo = useCallback(() => {
    if (historyRef.current.length === 0) return null;
    const restored = historyRef.current.pop();
    setCanUndo(historyRef.current.length > 0);
    return restored;
  }, []);

  return { pushSnapshot, undo, canUndo };
}