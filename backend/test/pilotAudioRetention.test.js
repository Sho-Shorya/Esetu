import test from "node:test";
import assert from "node:assert/strict";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { cleanupExpiredAudioFiles } from "../services/pilotAudioStorage.js";

test("audio retention deletes only expired regular files", async () => {
  const dir = await fsp.mkdtemp(
    path.join(os.tmpdir(), "esetu-audio-retention-"),
  );
  const nestedDir = path.join(dir, "nested");
  const expiredPath = path.join(dir, "old-call.wav");
  const recentPath = path.join(dir, "recent-call.wav");
  const now = new Date("2026-09-26T00:00:00.000Z");

  try {
    await fsp.mkdir(nestedDir);
    await fsp.writeFile(expiredPath, "expired");
    await fsp.writeFile(recentPath, "recent");
    await fsp.writeFile(path.join(nestedDir, "nested-call.wav"), "nested");
    await fsp.utimes(
      expiredPath,
      new Date("2026-08-01T00:00:00.000Z"),
      new Date("2026-08-01T00:00:00.000Z"),
    );

    const removed = await cleanupExpiredAudioFiles({
      now,
      retentionDays: 30,
      dir,
    });

    assert.deepEqual(removed, ["old-call.wav"]);
    await assert.rejects(fsp.access(expiredPath));
    await fsp.access(recentPath);
    await fsp.access(path.join(nestedDir, "nested-call.wav"));
  } finally {
    await fsp.rm(dir, { recursive: true, force: true });
  }
});
