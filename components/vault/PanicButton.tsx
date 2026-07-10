"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { DoorOpen } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { panicExit } from "@/lib/panic-exit";

const ESCAPE_COUNT = 3;
const ESCAPE_WINDOW_MS = 800;

function supportsPopover(): boolean {
  return typeof HTMLElement !== "undefined" && "showPopover" in HTMLElement.prototype;
}

const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

function ExitControl() {
  const { t } = useTranslation("common");
  return (
    <Button
      type="button"
      variant="destructive"
      size="sm"
      className="bg-red-700 text-white shadow-sm hover:bg-red-800"
      onClick={() => void panicExit()}
      aria-label={t("panic.aria")}
      title={t("panic.aria")}
    >
      <DoorOpen className="size-4" />
      {t("panic.exit")}
    </Button>
  );
}

export default function PanicButton() {
  const popoverRef = useRef<HTMLDivElement>(null);
  // Feature detection must wait until after hydration. SSR has no Popover API,
  // so branching on supportsPopover() during render mismatches the client HTML.
  const [popover, setPopover] = useState(false);

  useIsomorphicLayoutEffect(() => {
    setPopover(supportsPopover());
  }, []);

  useIsomorphicLayoutEffect(() => {
    const node = popoverRef.current;
    if (!popover || !node || !("showPopover" in node)) return;
    try {
      node.showPopover();
    } catch {
      // Already open.
    }
  }, [popover]);

  useEffect(() => {
    let count = 0;
    let timer = 0;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      count += 1;
      window.clearTimeout(timer);
      if (count >= ESCAPE_COUNT) {
        count = 0;
        event.preventDefault();
        event.stopPropagation();
        void panicExit();
        return;
      }
      timer = window.setTimeout(() => {
        count = 0;
      }, ESCAPE_WINDOW_MS);
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.clearTimeout(timer);
    };
  }, []);

  if (!popover) {
    return (
      <div className="fixed top-4 left-4 z-[100]">
        <ExitControl />
      </div>
    );
  }

  return (
    <div
      ref={popoverRef}
      popover="manual"
      className="m-0 border-0 bg-transparent p-0"
      style={{ position: "fixed", top: "1rem", left: "1rem" }}
    >
      <ExitControl />
    </div>
  );
}
