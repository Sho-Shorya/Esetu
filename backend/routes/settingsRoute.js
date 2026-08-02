import express from "express";
import { isAuthenticated, isSupp } from "../middleware/isAuthenticated.js";
import {
  getAppSettings,
  updateAppSetting,
  getPublicAppSettings,
} from "../controllers/settingsController.js";

const router = express.Router();

router.get("/app-settings", isAuthenticated, isSupp, getAppSettings);
router.put("/app-settings/:key", isAuthenticated, isSupp, updateAppSetting);

// public read-only endpoint for user-facing features (no auth)
router.get("/public/app-settings", getPublicAppSettings);

export default router;
