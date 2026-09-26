import express, { Router } from "express";
import multer from "multer";
import { isAuthenticated, isSupp } from "../middleware/isAuthenticated.js";
import {
  addPilotReviewItem,
  confirmPilotDraft,
  getPilotCall,
  getPilotCapability,
  getPilotReview,
  getPilotReviewCatalog,
  handleAnswerWebhook,
  handleRecordingWebhook,
  handleStatusWebhook,
  listPilotCalls,
  reopenPilotDraft,
  savePilotReview,
  streamPilotAudio,
  uploadTestAudio,
} from "../controllers/phoneCallPilotController.js";
import { getMaxAudioBytes } from "../services/pilotAudioStorage.js";

/**
 * Phase 1 pilot routes.
 *
 * Webhooks are form-urlencoded, so the URL-encoded parser is mounted on this
 * router only. The global express.json() in server.js is left untouched.
 */

const router = Router();

router.use(express.urlencoded({ extended: false, limit: "256kb" }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: getMaxAudioBytes(), files: 1 },
});

const handleUpload = (req, res, next) =>
  upload.single("audio")(req, res, (error) => {
    if (!error) return next();
    return res.status(400).json({
      success: false,
      message:
        error.code === "LIMIT_FILE_SIZE"
          ? `Audio exceeds the ${getMaxAudioBytes()} byte pilot limit.`
          : `Upload failed: ${error.message}`,
    });
  });

/* Provider callbacks: authenticated by provider signature, not by JWT. */
router.post("/answer", handleAnswerWebhook);
router.post("/status", handleStatusWebhook);
router.post("/recording-ready", handleRecordingWebhook);

/* Supplier-only pilot console. */
router.get("/capability", isAuthenticated, isSupp, getPilotCapability);
router.get("/", isAuthenticated, isSupp, listPilotCalls);
router.post("/test-audio", isAuthenticated, isSupp, handleUpload, uploadTestAudio);

/*
 * Supplier review of the AI draft.
 *
 * These routes write only to PhoneCallPilot. The one place a phone call becomes
 * a real Order is the bridge at /api/v1/phone-call/drafts/:id/order, so a draft
 * can be saved and confirmed here without any risk of an order appearing.
 */
router.get("/review/catalog", isAuthenticated, isSupp, getPilotReviewCatalog);
router.post("/:id/review/confirm", isAuthenticated, isSupp, confirmPilotDraft);
router.post("/:id/review/reopen", isAuthenticated, isSupp, reopenPilotDraft);

router.get("/:id", isAuthenticated, isSupp, getPilotCall);
router.get("/:id/audio", isAuthenticated, isSupp, streamPilotAudio);
router.get("/:id/review", isAuthenticated, isSupp, getPilotReview);
router.put("/:id/review", isAuthenticated, isSupp, savePilotReview);
router.post("/:id/review/items", isAuthenticated, isSupp, addPilotReviewItem);

export default router;
