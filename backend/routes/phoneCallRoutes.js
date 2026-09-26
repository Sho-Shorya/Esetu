import express, { Router } from "express";
import multer from "multer";
import { isAuthenticated, isSupp } from "../middleware/isAuthenticated.js";
import {
  attachCallAudio,
  createOrderFromCall,
  getCallingCapability,
  getMyCalls,
  getSupplierCall,
  getSupplierPhoneSection,
  identifyCustomer,
  listCallSuppliers,
  listIdentifyCandidates,
  recordOutgoingCall,
  reportCallStatus,
  sendSupplierWait,
  startSupplierCall,
} from "../controllers/phoneCallController.js";
import { getMaxAudioBytes } from "../services/pilotAudioStorage.js";

/**
 * e-Setu calling routes.
 *
 * Two audiences, one router:
 *   - the shopkeeper's 📞 कॉल tab (isAuthenticated)
 *   - the supplier's 📞 फोन section (isAuthenticated + isSupp)
 *
 * The shopkeeper's call is placed by the device through a tel: link. Nothing here
 * fakes a connection, an answer, a duration or a recording.
 */

const router = Router();

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
          ? `ऑडियो फाइल बहुत बड़ी है।`
          : `ऑडियो अपलोड नहीं हुआ: ${error.message}`,
    });
  });

/* ------------------------------- capability ------------------------------- */

router.get("/capability", isAuthenticated, getCallingCapability);

/* ---------------------------- shopkeeper calling --------------------------- */

router.get("/suppliers", isAuthenticated, listCallSuppliers);
router.get("/my-calls", isAuthenticated, getMyCalls);
router.post("/calls", isAuthenticated, recordOutgoingCall);

/* ----------------------------- supplier phone ------------------------------ */

router.get(
  "/supplier/section",
  isAuthenticated,
  isSupp,
  getSupplierPhoneSection,
);
router.get(
  "/supplier/candidates",
  isAuthenticated,
  isSupp,
  listIdentifyCandidates,
);
router.post("/supplier/calls", isAuthenticated, isSupp, startSupplierCall);
router.post(
  "/supplier/calls/:id/wait",
  isAuthenticated,
  isSupp,
  sendSupplierWait,
);
router.get("/supplier/calls/:id", isAuthenticated, isSupp, getSupplierCall);
router.put(
  "/supplier/calls/:id/status",
  isAuthenticated,
  isSupp,
  reportCallStatus,
);
router.post(
  "/supplier/calls/:id/customer",
  isAuthenticated,
  isSupp,
  identifyCustomer,
);
router.post(
  "/supplier/calls/:id/audio",
  isAuthenticated,
  handleUpload,
  attachCallAudio,
);

/* --------------------------- confirmed -> order --------------------------- */

/*
 * The controlled bridge. Supplier-only, and the service behind it is the only
 * code in the repository allowed to create an Order from a phone call.
 */
router.post("/drafts/:id/order", isAuthenticated, isSupp, createOrderFromCall);

export default router;
