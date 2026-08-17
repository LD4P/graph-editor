import { useEffect, useState } from "react";
import { loadRdf } from "../lib/pyBridge";
import { AUTOSAVE_KEY } from "../lib/autosave";
import { useGraphStore } from "../state/graphStore";

const bannerStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  alignItems: "center",
  padding: "0.5rem 1rem",
  background: "#fff8e1",
  borderBottom: "1px solid #ddd",
  fontSize: 13,
};

export default function AutosaveBanner() {
  const setProjection = useGraphStore((state) => state.setProjection);
  const resetPositions = useGraphStore((state) => state.resetPositions);
  const selectNode = useGraphStore((state) => state.selectNode);
  const [pendingText, setPendingText] = useState<string | null>(null);

  useEffect(() => {
    try {
      setPendingText(localStorage.getItem(AUTOSAVE_KEY));
    } catch {
      // localStorage unavailable; nothing to restore
    }
  }, []);

  if (!pendingText) return null;

  async function handleRestore() {
    const text = pendingText!;
    setPendingText(null);
    resetPositions();
    selectNode(null);
    setProjection(await loadRdf(text, "turtle"));
  }

  function handleDiscard() {
    try {
      localStorage.removeItem(AUTOSAVE_KEY);
    } catch {
      // localStorage unavailable; nothing to clear
    }
    setPendingText(null);
  }

  return (
    <div style={bannerStyle}>
      <span>Restore your previous session?</span>
      <button onClick={handleRestore}>Restore</button>
      <button onClick={handleDiscard}>Discard</button>
    </div>
  );
}
