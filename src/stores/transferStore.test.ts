import { beforeEach, describe, expect, it, vi } from "vitest";

const dialog = vi.hoisted(() => ({ save: vi.fn(), open: vi.fn() }));
const files = vi.hoisted(() => ({
  writeTextFile: vi.fn(),
  readTextFile: vi.fn(),
}));
const transfer = vi.hoisted(() => ({
  exportData: vi.fn(),
  parseImportBundle: vi.fn(),
  importData: vi.fn(),
}));

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
    dialog.open.mockReset();
    files.writeTextFile.mockReset();
    files.readTextFile.mockReset();
    transfer.exportData.mockReset();
    transfer.parseImportBundle.mockReset();
    transfer.importData.mockReset();
    useTransferStore.setState({ exporting: false, importing: false });
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

  it("does nothing when the open dialog is cancelled", async () => {
    dialog.open.mockResolvedValue(null);

    await expect(
      useTransferStore.getState().importFromFile(),
    ).resolves.toBeNull();

    expect(files.readTextFile).not.toHaveBeenCalled();
    expect(transfer.importData).not.toHaveBeenCalled();
  });

  it("reads, parses and imports the selected file", async () => {
    dialog.open.mockResolvedValue("C:/Users/me/backup.json");
    files.readTextFile.mockResolvedValue('{"version":1}');
    const bundle = { version: 1 };
    transfer.parseImportBundle.mockReturnValue(bundle);
    transfer.importData.mockResolvedValue({
      tasks: 2,
      intervals: 3,
      checkins: 4,
      todos: 5,
    });

    const result = await useTransferStore.getState().importFromFile();

    expect(result).toEqual({
      path: "C:/Users/me/backup.json",
      counts: { tasks: 2, intervals: 3, checkins: 4, todos: 5 },
    });
    expect(transfer.parseImportBundle).toHaveBeenCalledWith('{"version":1}');
    expect(transfer.importData).toHaveBeenCalledWith({}, bundle);
    expect(useTransferStore.getState().importing).toBe(false);
  });

  it("resets the importing flag when the file is invalid", async () => {
    dialog.open.mockResolvedValue("C:/Users/me/broken.json");
    files.readTextFile.mockResolvedValue("not json");
    transfer.parseImportBundle.mockImplementation(() => {
      throw new Error("invalid-json");
    });

    await expect(
      useTransferStore.getState().importFromFile(),
    ).rejects.toThrow("invalid-json");
    expect(useTransferStore.getState().importing).toBe(false);
  });
});
