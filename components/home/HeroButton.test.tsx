import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import HeroButton from "@/components/home/HeroButton";

describe("HeroButton", () => {
  it("renders label and calls onClick", async () => {
    const onClick = vi.fn();
    render(<HeroButton onClick={onClick} label="Create vault" ariaLabel="Create secure vault" />);

    expect(screen.getByRole("button", { name: "Create secure vault" })).toBeInTheDocument();
    expect(screen.getByText(/Create/)).toBeInTheDocument();
    expect(screen.getByText(/vault/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("shows spinner when loading", () => {
    render(<HeroButton onClick={() => {}} loading label="Create vault" ariaLabel="Create" />);
    expect(screen.queryByText("Create")).not.toBeInTheDocument();
  });
});
