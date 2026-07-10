"use client";

import { useCallback, useEffect, useState } from "react";
import {
  type BeforeInstallPromptEvent,
  dismissInstallPrompt,
  isIOS,
  shouldShowInstallPrompt,
} from "@/lib/pwa-install";

export function usePwaInstall() {
  const [visible, setVisible] = useState(false);
  const [iosDialogOpen, setIosDialogOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (!shouldShowInstallPrompt()) return;

    if (isIOS()) {
      setVisible(true);
      return;
    }

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  const install = useCallback(async () => {
    if (isIOS()) {
      setIosDialogOpen(true);
      return;
    }

    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);

    if (outcome === "accepted") {
      setVisible(false);
    }
  }, [deferredPrompt]);

  const dismiss = useCallback(() => {
    dismissInstallPrompt();
    setVisible(false);
    setIosDialogOpen(false);
  }, []);

  return {
    visible,
    iosDialogOpen,
    setIosDialogOpen,
    install,
    dismiss,
    isIOS: isIOS(),
  };
}
