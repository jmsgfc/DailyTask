import { beforeEach, describe, expect, it, vi } from "vitest";

const dialog = vi.hoisted(() => ({ save: vi.fn() }));
const files = vi.hoisted(() => ({ writeTextFile: vi.fn() }));
const transfer = vi.hoisted(() => ({ exportData: vi.fn() }));

vi.mock("@tauri-apps/plugin-dialog", () => dialog);
vi.mock("@tauri-apps/plugin-fs", () => files);
vi.mock("@tauri-apps/api/path", () => ({
  downloadDir: vi.fn(async () => "C:/Users/me/Downloads"),
  join: vi.fn(async (folder: string, name: string) => `${folder}/${name}`),
}));
vi.mock("../db/client", () => ({ getDb: vi.fn(async () => ({})) }));
vi.mock("../db/transfer", () => transfer);

import { useTransferStore } from "./transferStore";

describe("transferStore", () => {
  beforeEach(() => {
    dialog.save.mockReset();
    files.writeTextFile.mockReset();
    transfer.exportData.mockReset();
    useTransferStore.setState({ exporting: false });
  });

  it("does nothing when the save dialog is cancelled", async () => {
    dialog.save.mockResolvedValue(null);

    await expect(useTransferStore.getState().exportToFile()).resolves.toBeNull();

    expect(transfer.exportData).not.toHaveBeenCalled();
    expect(files.writeTextFile).not.toHaveBeenCalled();
  });

  it("writes the JSON v1 bundle to the chosen path", async () => {
    dialog.save.mockResolvedValue("C:/Users/me/dailytask.json");
    transfer.exportData.mockResolvedValue({ version: 1, tasks: [] });

    const path = await useTransferStore.getState().exportToFile();

    expect(path).toBe("C:/Users/me/dailytask.json");
    expect(files.writeTextFile).toHaveBeenCalledWith(
      "C:/Users/me/dailytask.json",
      expect.stringContaining('"version": 1'),
    );
    expect(useTransferStore.getState().exporting).toBe(false);
  });

  it("resets the exporting flag when the write fails", async () => {
    dialog.save.mockResolvedValue("C:/Users/me/dailytask.json");
    transfer.exportData.mockResolvedValue({ version: 1 });
    files.writeTextFile.mockRejectedValueOnce(new Error("disk full"));

    await expect(useTransferStore.getState().exportToFile()).rejects.toThrow(
      "disk full",
    );
    expect(useTransferStore.getState().exporting).toBe(false);
  });
});
