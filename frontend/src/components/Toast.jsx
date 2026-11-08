import { useEffect, useState } from "react";
import { CheckIcon } from "./icons";

// "Added", "Saved", "Deleted". Rises in above the phone nav, leaves after ~2s.
// `id` changes for every new message, so the same text twice still shows twice
export default function Toast({ message, id, onDone }) {
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    setLeaving(false);
    const out = setTimeout(() => setLeaving(true), 2000);
    const done = setTimeout(onDone, 2220);
    return () => { clearTimeout(out); clearTimeout(done); };
  }, [id, onDone]);

  return (
    <div
      role="status"
      className={`fixed bottom-[calc(84px+env(safe-area-inset-bottom))] left-1/2 z-[70] flex -translate-x-1/2 items-center gap-2 rounded-control bg-ink px-4 py-2.5 text-sm font-semibold text-canvas shadow-pop md:bottom-6 ${
        leaving ? "animate-fade-out" : "animate-toast-in"
      }`}
    >
      <CheckIcon size={18} />
      {message}
    </div>
  );
}
