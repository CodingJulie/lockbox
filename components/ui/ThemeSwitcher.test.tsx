import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useTheme } from "next-themes";
import { useTranslation } from "react-i18next";
import { vi, describe, it, expect, beforeEach } from "vitest";
import ThemeSwitcher from "@/components/ui/ThemeSwitcher";

vi.mock("next-themes", () => ({
  useTheme: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: vi.fn(),
}));

describe("ThemeSwitcher", () => {
  const mockSetTheme = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useTranslation as ReturnType<typeof vi.fn>).mockReturnValue({
      t: (key: string) => {
        const labels: Record<string, string> = {
          "theme.switch": "Switch theme",
          "theme.system": "System theme",
          "theme.light": "Light theme",
          "theme.dark": "Dark theme",
        };
        return labels[key] ?? key;
      },
    });
    (useTheme as ReturnType<typeof vi.fn>).mockReturnValue({
      theme: "system",
      setTheme: mockSetTheme,
    });
  });

  it("renders theme switch button", () => {
    render(<ThemeSwitcher />);
    expect(screen.getByRole("button", { name: "Switch theme" })).toBeInTheDocument();
  });

  it("cycles from system to light on click", async () => {
    render(<ThemeSwitcher />);
    await userEvent.click(screen.getByRole("button", { name: "Switch theme" }));
    expect(mockSetTheme).toHaveBeenCalledWith("light");
  });

  it("cycles from light to dark on click", async () => {
    (useTheme as ReturnType<typeof vi.fn>).mockReturnValue({
      theme: "light",
      setTheme: mockSetTheme,
    });
    render(<ThemeSwitcher />);
    await userEvent.click(screen.getByRole("button", { name: "Switch theme" }));
    expect(mockSetTheme).toHaveBeenCalledWith("dark");
  });
});
