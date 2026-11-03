import { beforeEach, describe, expect, it, vi } from "vitest";

import { deleteCheckin, setCheckinValue, upsertCheckin } from "../db/checkins";
import { emitCheckinsChanged } from "../shared/events";
import { useCheckinsStore } from "./checkinsStore";
import type { Checkin } from "../domain/types";

vi.mock("../db/client", () => ({
  getDb: vi.fn(async () => ({})),
}));

vi.mock("../db/checkins", () => ({
  upsertCheckin: vi.fn(async (_db: unknown, input: Checkin) => ({
    id: "c1",
    taskId: input.taskId,
    date: input.date,
    status: input.status,
    value: null,
    note: null,
    updatedAt: "2026-11-02T00:00:00.000Z",
  })),
  setCheckinValue: vi.fn(
    async (_db: unknown, taskId: string, date: string, value: string | null) => ({
      id: "c1",
      taskId,
      date,
      status: "recorded",
      value,
      note: null,
      updatedAt: "2026-11-02T00:00:00.000Z",
    }),
  ),
  deleteCheckin: vi.fn(async () => undefined),
}));

vi.mock("../shared/events", () => ({
  currentSource: () => "main",
  emitCheckinsChanged: vi.fn(async () => undefined),
}));

const checkin: Checkin = {
  id: "c1",
  taskId: "t1",
  date: "2026-11-02",
  status: "done",
  value: null,
  note: null,
  updatedAt: "2026-11-02T00:00:00.000Z",
};

describe("useCheckinsStore", () => {
  beforeEach(() => {
    vi.mocked(upsertCheckin).mockClear();
    vi.mocked(deleteCheckin).mockClear();
    vi.mocked(emitCheckinsChanged).mockClear();
    useCheckinsStore.setState({ byKey: new Map(), loaded: false });
  });

  it("hydrates checkins into taskId|date keys", () => {
    useCheckinsStore.getState().hydrate([checkin]);

    expect(useCheckinsStore.getState().byKey.get("t1|2026-11-02")).toEqual(
      checkin,
    );
  });

  it("writes a status, updates the map and emits changed", async () => {
    await useCheckinsStore.getState().setStatus("t1", "2026-11-02", "done");

    expect(upsertCheckin).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ taskId: "t1", date: "2026-11-02", status: "done" }),
    );
    expect(useCheckinsStore.getState().byKey.has("t1|2026-11-02")).toBe(true);
    expect(emitCheckinsChanged).toHaveBeenCalledWith({
      date: "2026-11-02",
      source: "main",
    });
  });

  it("deletes the row when status is null", async () => {
    useCheckinsStore.getState().hydrate([checkin]);

    await useCheckinsStore.getState().setStatus("t1", "2026-11-02", null);

    expect(deleteCheckin).toHaveBeenCalled();
    expect(useCheckinsStore.getState().byKey.has("t1|2026-11-02")).toBe(false);
  });

  it("rolls back the cell when the write fails", async () => {
    useCheckinsStore.getState().hydrate([checkin]);
    vi.mocked(upsertCheckin).mockRejectedValueOnce(new Error("disk full"));
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    await expect(
      useCheckinsStore.getState().setStatus("t1", "2026-11-02", "missed"),
    ).rejects.toThrow("disk full");

    expect(useCheckinsStore.getState().byKey.get("t1|2026-11-02")).toEqual(
      checkin,
    );
    expect(emitCheckinsChanged).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("writes a free-form value and marks the cell as recorded", async () => {
    await useCheckinsStore.getState().setValue("t1", "2026-11-02", "4");

    expect(setCheckinValue).toHaveBeenCalledWith(
      expect.anything(),
      "t1",
      "2026-11-02",
      "4",
    );
    expect(useCheckinsStore.getState().byKey.get("t1|2026-11-02")).toMatchObject({
      status: "recorded",
      value: "4",
    });
    expect(emitCheckinsChanged).toHaveBeenCalledWith({
      date: "2026-11-02",
      source: "main",
    });
  });

  it("keeps the judged status when only the value changes", async () => {
    useCheckinsStore.getState().hydrate([checkin]);
    vi.mocked(setCheckinValue).mockResolvedValueOnce({ ...checkin, value: "4" });

    await useCheckinsStore.getState().setValue("t1", "2026-11-02", "4");

    expect(useCheckinsStore.getState().byKey.get("t1|2026-11-02")).toMatchObject({
      status: "done",
      value: "4",
    });
  });

  it("drops the cell when a recorded value is cleared", async () => {
    useCheckinsStore.getState().hydrate([
      { ...checkin, status: "recorded", value: "4" },
    ]);
    vi.mocked(setCheckinValue).mockResolvedValueOnce(null);

    await useCheckinsStore.getState().setValue("t1", "2026-11-02", null);

    expect(useCheckinsStore.getState().byKey.has("t1|2026-11-02")).toBe(false);
  });
});
