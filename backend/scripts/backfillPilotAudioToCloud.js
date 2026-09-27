import fsp from "fs/promises";
import process from "process";
import mongoose from "mongoose";
import { connectDb } from "../database/db.js";
import PhoneCall from "../models/phoneCallModel.js";
import PhoneCallPilot from "../models/phoneCallPilotModel.js";
import {
  describeAudioStorage,
  resolveAudioPath,
  storageColumns,
} from "../services/pilotAudioStorage.js";
import { uploadAudioToCloud } from "../services/pilotAudioCloud.js";

/**
 * Moves recordings taken before durable storage existed into durable storage.
 *
 * The phone-order flow does not need this to work: a call recorded before the
 * move keeps its local file and is read exactly as before. This exists so those
 * older recordings survive the next redeploy too, instead of being the one
 * category that quietly disappears.
 *
 * It is safe to run more than once. A pilot document that already has a
 * `publicId` is skipped, so a second run does not re-upload anything, and a
 * document is only updated after its upload succeeded, so an interrupted run
 * never leaves a document pointing at an asset that does not exist.
 *
 *   npm run backfill:audio            # report what would move, change nothing
 *   npm run backfill:audio -- --apply # do it
 *
 * Original files are left on disk. They are harmless, and keeping them means a
 * bad run can be recovered from without re-recording anything.
 */

const BATCH_SIZE = 25;

const apply = process.argv.includes("--apply");

const summarize = (counts) =>
  Object.entries(counts)
    .map(([key, value]) => `${key}=${value}`)
    .join(" ");

const migratePilot = async (doc) => {
  const fileName = doc.audio?.fileName;
  if (!fileName) return "skipped-no-file";

  let buffer;
  try {
    buffer = await fsp.readFile(resolveAudioPath(fileName));
  } catch {
    // The file is already gone, most likely because the ephemeral disk was
    // replaced. Nothing can be recovered, and it must not stop the rest.
    return "missing-file";
  }

  if (!apply) return "would-migrate";

  const saved = await uploadAudioToCloud({
    buffer,
    contentType: doc.audio?.contentType || "application/octet-stream",
  });

  const columns = storageColumns({
    ...saved,
    fileName: null,
    contentType: doc.audio?.contentType || saved.contentType,
    bytes: buffer.length,
    sha256: doc.audio?.sha256 || null,
    originalName: doc.audio?.originalName || null,
  });

  // Only the storage columns are touched: the local file name stays recorded so
  // a rollback, or a machine that still has the file, keeps working.
  //
  // `storedAt` is stamped only when the record has none, and it is stamped with
  // the time of the migration rather than the time of the call. Retention ages a
  // durable recording by `storedAt`, so without this a three month old recording
  // would be read as already expired and deleted by the very next sweep.
  const storedAt = doc.audio?.storedAt || new Date();
  const update = {
    $set: {
      "audio.storage": "cloud",
      "audio.publicId": columns.publicId,
      "audio.format": columns.format,
      "audio.storedAt": storedAt,
    },
  };
  await PhoneCallPilot.updateOne({ _id: doc._id }, update);

  if (doc.phoneCallId) {
    await PhoneCall.updateOne(
      { _id: doc.phoneCallId },
      {
        $set: {
          "recording.storage": "cloud",
          "recording.publicId": columns.publicId,
          "recording.format": columns.format,
          "recording.storedAt": storedAt,
        },
      },
    );
  }

  return "migrated";
};

const run = async () => {
  const counts = {
    scanned: 0,
    alreadyDurable: 0,
    migrated: 0,
    wouldMigrate: 0,
    missingFile: 0,
    noFile: 0,
    failed: 0,
  };

  const cursor = PhoneCallPilot.find(
    { "audio.fileName": { $exists: true, $ne: null } },
  )
    .select("_id audio phoneCallId")
    .lean()
    .cursor();

  for await (const doc of cursor) {
    if (doc.audio?.publicId) {
      counts.alreadyDurable += 1;
      continue;
    }

    counts.scanned += 1;

    try {
      const outcome = await migratePilot(doc);
      if (outcome === "migrated") counts.migrated += 1;
      else if (outcome === "would-migrate") counts.wouldMigrate += 1;
      else if (outcome === "missing-file") counts.missingFile += 1;
      else counts.noFile += 1;
    } catch (error) {
      counts.failed += 1;
      console.error(`  ${doc._id}: ${error.message}`);
    }

    if (counts.scanned % BATCH_SIZE === 0) {
      console.log(`  ...${summarize(counts)}`);
    }
  }

  console.log(describeAudioStorage());
  console.log(apply ? "backfill applied" : "dry run, nothing changed");
  console.log(summarize(counts));

  if (apply && counts.migrated > 0) {
    console.log(
      "Original files were left on disk. Once the new recordings are confirmed " +
        "in production, the old ones expire on their own retention schedule.",
    );
  }
  if (counts.missingFile > 0) {
    console.log(
      `${counts.missingFile} recording(s) were already missing from disk and ` +
        "cannot be recovered.",
    );
  }
};

const connected = await connectDb();
if (!connected) {
  console.error("Backfill aborted: no database connection.");
  process.exit(1);
}

try {
  await run();
} catch (error) {
  console.error("Backfill failed:", error.message);
  process.exitCode = 1;
} finally {
  await mongoose.connection.close();
}
