import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useTranslation } from "react-i18next";
import { vi, describe, it, expect, beforeEach } from "vitest";
import LanguageSwitcher from "@/components/ui/LanguageSwitcher";

vi.mock("react-i18next", () => ({
  useTranslation: vi.fn(),
}));

describe("LanguageSwitcher", () => {
  const mockChangeLanguage = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useTranslation as ReturnType<typeof vi.fn>).mockReturnValue({
      t: (key: string) => (key === "lang.switch" ? "Language" : key),
      i18n: {
        language: "ru",
        changeLanguage: mockChangeLanguage,
      },
    });
  });

  it("renders current locale", () => {
    render(<LanguageSwitcher />);
    expect(screen.getByRole("button", { name: "Language" })).toBeInTheDocument();
    expect(screen.getByText("ru")).toBeInTheDocument();
  });

  it("toggles locale on click", async () => {
    localStorage.clear();
    render(<LanguageSwitcher />);
    await userEvent.click(screen.getByRole("button", { name: "Language" }));
    expect(mockChangeLanguage).toHaveBeenCalledWith("en");
    expect(localStorage.getItem("i18nextLng")).toBe("en");
  });
});
