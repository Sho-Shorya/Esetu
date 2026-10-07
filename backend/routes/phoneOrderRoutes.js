import { Router } from "express";
import multer from "multer";
import { isAuthenticated, isSupp } from "../middleware/isAuthenticated.js";
import {
  getUploadConfig,
  listCreatedOrders,
  uploadRecording,
} from "../controllers/phoneOrderController.js";
import { getMaxAudioBytes } from "../services/pilotAudioStorage.js";

/**
 * Phone-order routes: recording upload and the orders it produced.
 *
 * Supplier-only (isAuthenticated + isSupp) on every route — a shopkeeper can
 * never upload a recording or read this supplier's order list.
 *
 * The multer limit is the server's hard size cap; every other check (type,
 * readability, the 10 minute limit, the chosen customer) happens in the
 * controller so each refusal carries its own simple Hindi message.
 */

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: getMaxAudioBytes(), files: 1 },
});

const handleUpload = (req, res, next) =>
  upload.single("audio")(req, res, (error) => {
    if (!error) return next();
    const tooLarge = error.code === "LIMIT_FILE_SIZE";
    return res.status(tooLarge ? 413 : 400).json({
      success: false,
      code: tooLarge ? "AUDIO_TOO_LARGE" : "AUDIO_UPLOAD_FAILED",
      message: tooLarge
        ? `ऑडियो फ़ाइल बहुत बड़ी है। अधिकतम ${Math.round(
            getMaxAudioBytes() / (1024 * 1024),
          )} MB तक की रिकॉर्डिंग चुनें।`
        : "रिकॉर्डिंग अपलोड नहीं हो पाई। फिर कोशिश करें।",
    });
  });

/* Upload form limits: size, duration, accepted formats. */
router.get("/config", isAuthenticated, isSupp, getUploadConfig);

/* The single entry point of the phone-order pipeline. */
router.post("/recording", isAuthenticated, isSupp, handleUpload, uploadRecording);

/* Orders created from this supplier's recordings. */
router.get("/orders", isAuthenticated, isSupp, listCreatedOrders);

export default router;
