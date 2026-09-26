/**
 * Phase 1 dev tool. Runs the real review engine over real stored pilot calls and
 * reports, per line, whether the review layer actually catches each known
 * ground-truth problem.
 *
 * This is the step that decides whether the review screen is trustworthy: if a
 * wrong line grades as `ok`, the father's only safety net is missing.
 *
 *   node pilot-evals/reviewRealCalls.mjs
 */
import { connect, disconnect } from "./_bootstrap.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  seedReviewLines,
  reviewDraft,
  getReviewCatalog,
  confirmReviewDraft,
  LINE_STATUS,
} from "../services/pilotDraftReviewService.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const db = await connect();
const catalog = await getReviewCatalog({ maxAgeMs: 0 });

const docs = await db
  .collection("phonecallpilots")
  .find({ "extraction.draft": { $exists: true } })
  .sort({ createdAt: -1 })
  .toArray();

const out = [];
const say = (...a) => out.push(a.join(" "));

say(`catalog=${catalog.length} products  callsWithDraft=${docs.length}`);

let anyWouldBeConfirmed = 0;

for (const doc of docs) {
  const draft = doc.extraction.draft;
  say("\n" + "=".repeat(78));
  say(`call ${doc._id}  stage=${doc.pipeline?.stage}  createdAt=${doc.createdAt?.toISOString?.()}`);

  const rawItems = draft.items || [];
  say(`\n-- AI DRAFT (raw, pre-review) --`);
  for (const it of rawItems) {
    say(
      `   ${String(it.quantity).padStart(3)} ${(it.unit || "-").padEnd(7)} ${(it.productName || "?").padEnd(14)}` +
        ` var=${String(it.variantMeasurement || "-").padEnd(12)} co=${String(it.company || "-").padEnd(12)}` +
        ` conf=${it.confidence} mentions=${it.mentions} phrase="${it.matchedPhrase || ""}"`,
    );
  }
  for (const u of draft.unresolved || []) {
    say(`   ? UNRESOLVED "${u.spokenName}" (${u.reason})`);
  }
  say(
    `   validationErrors=${JSON.stringify(doc.extraction.validationErrors || [])}`,
  );
  say(
    `   needsClarification=${draft.needsClarification} question="${draft.clarificationQuestion || ""}"`,
  );

  // Run the exact path the GET /review endpoint runs.
  const fakeDoc = {
    extraction: { draft },
    review: { status: "not_started", lines: [] },
  };
  const seeded = seedReviewLines({ draft });
  const report = reviewDraft({ lines: seeded, catalog });

  say(`\n-- REVIEW SEED (what the father sees) --`);
  for (const l of report.lines) {
    say(
      `   [${String(l.status).padEnd(17)}] ${String(l.quantity).padStart(3)} ${(l.unit || "-").padEnd(7)}` +
        ` ${(l.productName || l.spokenName || "?").padEnd(14)} var=${String(l.variantMeasurement || "-").padEnd(12)}` +
        ` co=${String(l.company || "-").padEnd(12)} heard="${l.spokenName || ""}" blocking=${l.blocking}`,
    );
    for (const issue of l.issues || []) say(`        ! ${issue}`);
  }
  say(`\n   counts=${JSON.stringify(report.counts)}`);
  say(`   confirmable=${report.confirmable}  blockers=${report.blockers.length}`);
  for (const b of report.blockers) say(`     BLOCKER [${b.status}] ${b.productName}: ${b.messages.join(" | ")}`);

  // Would a careless father be able to confirm this as-is?
  const res = confirmReviewDraft({ doc: fakeDoc, catalog, userId: null });
  say(`   confirmReviewDraft -> ok=${res.ok} ${res.ok ? `itemCount=${res.confirmed.itemCount}` : `code=${res.code}`}`);
  say(`   orderCreated=${res.ok ? res.confirmed.orderCreated : "n/a"} orderId=${res.ok ? res.confirmed.orderId : "n/a"}`);
  if (res.ok) {
    anyWouldBeConfirmed += 1;
    say(`   !! CONFIRMABLE WITHOUT CHANGES: these ${res.confirmed.itemCount} line(s) would be "confirmed" as-is.`);
  }

  // How many AI lines carry a frozen problem flag?
  const flagged = report.lines.filter((l) => (l.baseline?.flags || []).length);
  say(`   lines with frozen AI problem flags: ${flagged.length}/${report.lines.length}`);
  for (const l of flagged) {
    say(`     ${l.productName || l.spokenName}: ${l.baseline.flags.join(", ")}`);
  }
  say(
    `   confidences seen: ${JSON.stringify(
      Array.from(new Set(report.lines.map((l) => l.confidence))),
    )}`,
  );
}

say(
  `\nSUMMARY: ${docs.length} call(s); ${anyWouldBeConfirmed} would confirm with zero supplier edits.`,
);

await disconnect();
fs.writeFileSync(path.join(here, "_review.txt"), out.join("\n"), "utf8");
console.log(`wrote ${out.length} lines to pilot-evals/_review.txt`);
