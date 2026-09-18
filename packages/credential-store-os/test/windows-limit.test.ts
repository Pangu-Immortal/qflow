import assert from "node:assert/strict";
import test from "node:test";

import { assertWindowsLockerSecret, windowsLockerPasswordLimit } from "../src/windows.js";

test("Windows locker rejects OAuth-sized secrets before PasswordVault", () => {
  assertWindowsLockerSecret("x".repeat(windowsLockerPasswordLimit), "qflowhub.oauth");
  assert.throws(
    () => assertWindowsLockerSecret("x".repeat(windowsLockerPasswordLimit + 1), "qflowhub.oauth"),
    /513-character secret for qflowhub\.oauth.*PasswordVault limit is 512.*credential-store-file/u,
  );
});
