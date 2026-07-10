import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  INSTALL_DISMISS_KEY,
  dismissInstallPrompt,
  isIOS,
  isInstallDismissed,
  isMobileDevice,
  isStandalone,
  shouldShowInstallPrompt,
} from "@/lib/pwa-install";

describe("pwa-install", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal("navigator", {
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
    });
    vi.stubGlobal("window", {
      matchMedia: vi.fn().mockReturnValue({ matches: false }),
      navigator: { standalone: false },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("detects iOS mobile", () => {
    expect(isIOS()).toBe(true);
    expect(isMobileDevice()).toBe(true);
  });

  it("detects standalone mode", () => {
    vi.stubGlobal("window", {
      matchMedia: vi.fn().mockReturnValue({ matches: true }),
      navigator: { standalone: false },
    });
    expect(isStandalone()).toBe(true);
  });

  it("respects dismiss flag", () => {
    expect(isInstallDismissed()).toBe(false);
    dismissInstallPrompt();
    expect(isInstallDismissed()).toBe(true);
    expect(localStorage.getItem(INSTALL_DISMISS_KEY)).toBe("1");
  });

  it("shows prompt on mobile when not standalone or dismissed", () => {
    expect(shouldShowInstallPrompt()).toBe(true);
    dismissInstallPrompt();
    expect(shouldShowInstallPrompt()).toBe(false);
  });

  it("hides prompt on desktop", () => {
    vi.stubGlobal("navigator", {
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    });
    expect(shouldShowInstallPrompt()).toBe(false);
  });
});
