import { beforeEach, describe, expect, it, vi } from "vitest";

const updater = vi.hoisted(() => ({ check: vi.fn() }));
const process = vi.hoisted(() => ({ relaunch: vi.fn(async () => undefined) }));
const backup = vi.hoisted(() => ({ snapshotBeforeUpdate: vi.fn() }));

vi.mock("@tauri-apps/plugin-updater", () => updater);
vi.mock("@tauri-apps/plugin-process", () => process);
vi.mock("../db/backup", () => backup);

import { useUpdateStore } from "./updateStore";

function fakeUpdate(version: string) {
  return {
    version,
    body: `release ${version}`,
    downloadAndInstall: vi.fn(async () => undefined),
  };
}

describe("updateStore", () => {
  beforeEach(() => {
    updater.check.mockReset();
    process.relaunch.mockReset();
    backup.snapshotBeforeUpdate.mockReset();
    useUpdateStore.setState({
      available: null,
      checking: false,
      installing: false,
      checked: false,
      error: null,
      pending: null,
    });
  });

  it("records no update after a successful check", async () => {
    updater.check.mockResolvedValue(null);

    await useUpdateStore.getState().checkForUpdate();

    expect(useUpdateStore.getState()).toMatchObject({
      available: null,
      checked: true,
      checking: false,
      error: null,
    });
  });

  it("exposes the announced version and notes", async () => {
    updater.check.mockResolvedValue(fakeUpdate("0.1.1"));

    await useUpdateStore.getState().checkForUpdate();

    expect(useUpdateStore.getState().available).toEqual({
      version: "0.1.1",
      notes: "release 0.1.1",
    });
  });

  it("reports a failed check without throwing", async () => {
    updater.check.mockRejectedValue(new Error("offline"));
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    await useUpdateStore.getState().checkForUpdate();

    expect(useUpdateStore.getState()).toMatchObject({
      error: "check",
      checking: false,
      checked: false,
    });
    consoleError.mockRestore();
  });

  it("snapshots the database, installs and relaunches", async () => {
    const update = fakeUpdate("0.1.1");
    useUpdateStore.setState({ pending: update as never });
    backup.snapshotBeforeUpdate.mockResolvedValue("pre-update-0.1.1.db");

    await useUpdateStore.getState().install();

    expect(backup.snapshotBeforeUpdate).toHaveBeenCalledWith("0.1.1");
    expect(update.downloadAndInstall).toHaveBeenCalled();
    expect(process.relaunch).toHaveBeenCalled();
    expect(useUpdateStore.getState().installing).toBe(true);
  });

  it("aborts the install when the snapshot fails", async () => {
    const update = fakeUpdate("0.1.1");
    useUpdateStore.setState({ pending: update as never });
    backup.snapshotBeforeUpdate.mockRejectedValue(new Error("disk full"));
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    await useUpdateStore.getState().install();

    expect(update.downloadAndInstall).not.toHaveBeenCalled();
    expect(process.relaunch).not.toHaveBeenCalled();
    expect(useUpdateStore.getState()).toMatchObject({
      error: "install",
      installing: false,
    });
    consoleError.mockRestore();
  });

  it("ignores install without a checked update", async () => {
    await useUpdateStore.getState().install();

    expect(backup.snapshotBeforeUpdate).not.toHaveBeenCalled();
  });
});
