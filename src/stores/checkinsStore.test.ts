import { beforeEach, describe, expect, it, vi } from "vitest";

import { deleteCheckin, upsertCheckin } from "../db/checkins";
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
    note: null,
    updatedAt: "2026-11-02T00:00:00.000Z",
  })),
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
});
