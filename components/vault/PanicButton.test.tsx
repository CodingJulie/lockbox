import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { useTranslation } from "react-i18next";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PanicButton from "@/components/vault/PanicButton";
import { panicExit } from "@/lib/panic-exit";

vi.mock("react-i18next", () => ({
  useTranslation: vi.fn(),
}));

vi.mock("@/lib/panic-exit", () => ({
  panicExit: vi.fn(),
}));

describe("PanicButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useTranslation as ReturnType<typeof vi.fn>).mockReturnValue({
      t: (key: string) => key,
      i18n: { language: "en" },
    });
  });

  it("calls panic exit on click", async () => {
    render(<PanicButton />);
    await userEvent.click(screen.getByRole("button", { name: "panic.aria" }));
    expect(panicExit).toHaveBeenCalledOnce();
  });

  it("calls panic exit after three Escape presses", async () => {
    render(<PanicButton />);
    await userEvent.keyboard("{Escape}{Escape}{Escape}");
    expect(panicExit).toHaveBeenCalledOnce();
  });

  it("SSR markup stays on the fallback layout even when Popover is available", () => {
    const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "showPopover");
    Object.defineProperty(HTMLElement.prototype, "showPopover", {
      configurable: true,
      value: vi.fn(),
    });

    try {
      const view = renderToString(<PanicButton />);
      expect(view).toContain("fixed top-4 left-4 z-[100]");
      expect(view).not.toContain("popover");
    } finally {
      if (original) {
        Object.defineProperty(HTMLElement.prototype, "showPopover", original);
      } else {
        delete (HTMLElement.prototype as { showPopover?: unknown }).showPopover;
      }
    }
  });
});
