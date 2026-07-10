"use client";

import { useEffect } from "react";
import { clearVaultKey } from "@/lib/vault-client";

/** Clears vault session when user leaves the page — no persistent cache */
export default function SessionGuard() {
  useEffect(() => {
    const logout = () => clearVaultKey();

    window.addEventListener("pagehide", logout);
    window.addEventListener("beforeunload", logout);

    return () => {
      window.removeEventListener("pagehide", logout);
      window.removeEventListener("beforeunload", logout);
    };
  }, []);

  return null;
}
