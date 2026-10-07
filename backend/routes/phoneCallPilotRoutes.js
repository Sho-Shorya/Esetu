import { Router } from "express";
import { isAuthenticated, isSupp } from "../middleware/isAuthenticated.js";
import {
  addPilotReviewItem,
  confirmPilotDraft,
  getPilotCall,
  getPilotReview,
  getPilotReviewCatalog,
  listPilotCalls,
  reopenPilotDraft,
  retryPilotProcessing,
  savePilotReview,
  streamPilotAudio,
} from "../controllers/phoneCallPilotController.js";

/**
 * Phone-order pipeline routes (STT -> AI draft -> supplier review).
 *
 * Supplier-only (isAuthenticated + isSupp) everywhere. The recording itself
 * arrives through /api/v1/phone-orders/recording; nothing here uploads audio.
 *
 * These routes write only to PhoneCallPilot. The one place a phone call becomes
 * a real Order is the bridge at /api/v1/phone-call/drafts/:id/order (and its
 * one-tap twin below), so a draft can be saved and confirmed without any risk
 * of an order appearing by accident.
 */

const router = Router();

/* ------------------------------ call list ------------------------------- */

router.get("/", isAuthenticated, isSupp, listPilotCalls);
router.get("/:id", isAuthenticated, isSupp, getPilotCall);
router.get("/:id/audio", isAuthenticated, isSupp, streamPilotAudio);

/* ------------------------- supplier review of the draft ------------------- */

router.get("/review/catalog", isAuthenticated, isSupp, getPilotReviewCatalog);
router.post("/:id/review/confirm", isAuthenticated, isSupp, confirmPilotDraft);
router.post("/:id/review/reopen", isAuthenticated, isSupp, reopenPilotDraft);
router.get("/:id/review", isAuthenticated, isSupp, getPilotReview);
router.put("/:id/review", isAuthenticated, isSupp, savePilotReview);
router.post("/:id/review/items", isAuthenticated, isSupp, addPilotReviewItem);

/*
 * Re-runs the failed STT -> draft pipeline from the recording already held.
 * Creates no Order and touches no draft, so it is safe to call at any time.
 */
router.post("/:id/retry", isAuthenticated, isSupp, retryPilotProcessing);

export default router;
