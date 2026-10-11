"use client";
import { useEffect, useRef } from "react";

// Açılır pencereler için klavye erişimi: Esc ile kapanır, açılınca ilk alana bir kez odaklanılır.
// (Tıklama taramasında Esc'nin pencereleri kapatmadığı ve açık kalan pencerenin diğer düğmeleri örttüğü görüldü.)
export function useModalKeys(close: () => void, selector = ".entry-modal") {
  const closeRef = useRef(close);
  useEffect(() => { closeRef.current = close; });
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); closeRef.current(); } };
    document.addEventListener("keydown", onKey);
    document.querySelector<HTMLElement>(`${selector} input:not([type=hidden]), ${selector} select, ${selector} textarea`)?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [selector]);
}
