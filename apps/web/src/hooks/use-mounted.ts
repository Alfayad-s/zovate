"use client";

import { useEffect, useState } from "react";

/** Avoids hydration mismatches for client-only state (e.g. localStorage). */
export function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  return mounted;
}
