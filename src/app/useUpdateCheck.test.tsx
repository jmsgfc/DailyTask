import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  UPDATE_CHECK_INTERVAL_MS,
  UPDATE_CHECK_KEY,
  useUpdateCheck,
} from "./useUpdateCheck";
import { useUpdateStore } from "../stores/updateStore";

vi.mock("../shared/env", () => ({ isDevBuild: false }));

describe("useUpdateCheck", () => {
  const checkForUpdate = vi.fn(async () => undefined);

  beforeEach(() => {
    localStorage.clear();
    checkForUpdate.mockClear();
    useUpdateStore.setState({ checkForUpdate });
  });

  it("checks when it has never checked before", () => {
    renderHook(() => useUpdateCheck());

    expect(checkForUpdate).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(UPDATE_CHECK_KEY)).not.toBeNull();
  });

  it("skips when the last check is inside the interval", () => {
    localStorage.setItem(UPDATE_CHECK_KEY, String(Date.now()));

    renderHook(() => useUpdateCheck());

    expect(checkForUpdate).not.toHaveBeenCalled();
  });

  it("checks again once the interval has passed", () => {
    localStorage.setItem(
      UPDATE_CHECK_KEY,
      String(Date.now() - UPDATE_CHECK_INTERVAL_MS - 1000),
    );

    renderHook(() => useUpdateCheck());

    expect(checkForUpdate).toHaveBeenCalledTimes(1);
  });
});
