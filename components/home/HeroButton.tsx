"use client";

import { Shield } from "lucide-react";

interface HeroButtonProps {
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  label: string;
  ariaLabel: string;
}

export default function HeroButton({
  onClick,
  disabled,
  loading,
  label,
  ariaLabel,
}: HeroButtonProps) {
  const lines = label.split("\n");

  return (
    <div className="hero-button-wrap">
      <div className="hero-button-glow" aria-hidden />
      <div className="hero-button-ring" aria-hidden />

      <button
        type="button"
        onClick={onClick}
        disabled={disabled || loading}
        className="hero-button"
        aria-label={ariaLabel}
      >
        <span className="hero-button-shine" aria-hidden />
        <span className="hero-button-inner">
          {loading ? (
            <span className="hero-button-spinner" />
          ) : (
            <>
              <Shield className="hero-button-icon" strokeWidth={1.75} />
              <span className="hero-button-label">
                {lines.length > 1 ? (
                  <>
                    {lines[0]}
                    <br />
                    {lines.slice(1).join(" ")}
                  </>
                ) : label.includes(" ") ? (
                  <>
                    {label.split(" ")[0]}
                    <br />
                    {label.split(" ").slice(1).join(" ")}
                  </>
                ) : (
                  label
                )}
              </span>
            </>
          )}
        </span>
      </button>
    </div>
  );
}
