import { render, screen } from "@testing-library/react";
import { useTranslation } from "react-i18next";
import { beforeEach, describe, expect, it, vi } from "vitest";
import VaultDashboard from "@/components/vault/VaultDashboard";
import { fetchItems, hasVaultPermission } from "@/lib/vault-client";

vi.mock("react-i18next", () => ({
  useTranslation: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("@/lib/vault-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/vault-client")>();
  return {
    ...actual,
    fetchItems: vi.fn().mockResolvedValue({ items: [] }),
    fetchAccessKeys: vi.fn().mockResolvedValue({ keys: [] }),
    fetchActivity: vi.fn().mockResolvedValue({
      lastLoginAt: null,
      downloads: 0,
      uploads: 0,
      failedVerifies: 0,
    }),
    hasVaultPermission: vi.fn(),
    clearVaultKey: vi.fn(),
    flushOfflineQueue: vi.fn().mockResolvedValue({ sent: 0, failed: 0 }),
    exportCourtPackage: vi.fn(),
  };
});

vi.mock("@/components/vault/RecordCard", () => ({ default: () => null }));
vi.mock("@/components/vault/InstallPrompt", () => ({ default: () => null }));
vi.mock("@/components/vault/SecureContextBanner", () => ({ default: () => null }));
vi.mock("@/components/vault/CreateAccessKeyDialog", () => ({ default: () => null }));
vi.mock("@/components/vault/KeyRevealDialog", () => ({ default: () => null }));

const hasVaultPermissionMock = vi.mocked(hasVaultPermission);
const fetchItemsMock = vi.mocked(fetchItems);

describe("VaultDashboard scopes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchItemsMock.mockResolvedValue({ items: [] });
    (useTranslation as ReturnType<typeof vi.fn>).mockReturnValue({
      t: (key: string) => key,
      i18n: { language: "en" },
    });
  });

  it("shows the guest-code action only for the master", async () => {
    hasVaultPermissionMock.mockImplementation((permission) =>
      ["read", "download", "upload", "manage"].includes(permission)
    );

    render(<VaultDashboard onLogout={() => {}} />);

    expect(await screen.findByText("accessKeys.create")).toBeInTheDocument();
    expect(screen.getByText("vault.tabUpload")).toBeInTheDocument();
    expect(screen.getByText(/vault.savedItems/)).toBeInTheDocument();
    expect(screen.getByText("vault.exportCourt")).toBeInTheDocument();
  });

  it("hides uploads for a read-only guest code", async () => {
    hasVaultPermissionMock.mockImplementation((permission) =>
      ["read", "download"].includes(permission)
    );

    render(<VaultDashboard onLogout={() => {}} />);

    expect(await screen.findByText("vault.subtitleReadOnly")).toBeInTheDocument();
    expect(screen.queryByText("accessKeys.create")).not.toBeInTheDocument();
    expect(screen.queryByText("vault.tabUpload")).not.toBeInTheDocument();
    expect(screen.getByText(/vault.savedItems/)).toBeInTheDocument();
    expect(screen.getByText("vault.exportCourt")).toBeInTheDocument();
  });

  it("hides the materials list for an upload-only code", async () => {
    hasVaultPermissionMock.mockImplementation((permission) => permission === "upload");

    render(<VaultDashboard onLogout={() => {}} />);

    expect(await screen.findByText("vault.subtitleUploadOnly")).toBeInTheDocument();
    expect(screen.getByText("vault.tabUpload")).toBeInTheDocument();
    expect(screen.queryByText(/vault.savedItems/)).not.toBeInTheDocument();
    expect(screen.queryByText("accessKeys.create")).not.toBeInTheDocument();
    expect(screen.queryByText("vault.exportCourt")).not.toBeInTheDocument();
  });

  it("shows type, size, and date when the filename is not decrypted", async () => {
    hasVaultPermissionMock.mockImplementation((permission) =>
      ["read", "download"].includes(permission)
    );
    fetchItemsMock.mockResolvedValue({
      items: [
        {
          id: "item-1",
          vaultId: "vault",
          type: "video",
          name: "",
          mimeType: null,
          size: 2048,
          textContent: null,
          storagePath: null,
          contentNonce: "nonce",
          encryptedMeta: "meta",
          createdAt: "2026-01-15T12:00:00.000Z",
        },
      ],
    });

    render(<VaultDashboard onLogout={() => {}} />);

    expect((await screen.findAllByText("vault.types.video")).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("2.0 KB")).toBeInTheDocument();
    expect(screen.getByText(/2026/)).toBeInTheDocument();
    expect(screen.queryByText("passport.jpg")).not.toBeInTheDocument();
  });
});
