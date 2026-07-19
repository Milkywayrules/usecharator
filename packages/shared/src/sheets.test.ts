import { describe, expect, test } from "bun:test";
import {
  deriveSheetBatchStatus,
  SHEET_CONCURRENCY_PER_USER,
  sheetDispatchSlots,
} from "./sheets";

describe("deriveSheetBatchStatus", () => {
  test("running when any member is non-terminal", () => {
    expect(
      deriveSheetBatchStatus([{ status: "succeeded" }, { status: "running" }])
    ).toBe("running");
  });

  test("completed when all succeeded", () => {
    expect(
      deriveSheetBatchStatus([{ status: "succeeded" }, { status: "succeeded" }])
    ).toBe("completed");
  });

  test("failed when all failed", () => {
    expect(
      deriveSheetBatchStatus([{ status: "failed" }, { status: "failed" }])
    ).toBe("failed");
  });

  test("partial when mixed terminal outcomes", () => {
    expect(
      deriveSheetBatchStatus([{ status: "succeeded" }, { status: "failed" }])
    ).toBe("partial");
  });

  test("failed for empty member list", () => {
    expect(deriveSheetBatchStatus([])).toBe("failed");
  });
});

describe("sheetDispatchSlots", () => {
  test("returns zero when at cap", () => {
    expect(sheetDispatchSlots(SHEET_CONCURRENCY_PER_USER)).toBe(0);
  });

  test("returns remaining slots below cap", () => {
    expect(sheetDispatchSlots(1)).toBe(1);
    expect(sheetDispatchSlots(0)).toBe(SHEET_CONCURRENCY_PER_USER);
  });
});
