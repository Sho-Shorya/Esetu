import express from "express";
import { isAuthenticated, isSupp } from "../middleware/isAuthenticated.js";
import {
  getAppSettings,
  updateAppSetting,
} from "../controllers/settingsController.js";

const router = express.Router();

router.get("/app-settings", isAuthenticated, isSupp, getAppSettings);
router.put("/app-settings/:key", isAuthenticated, isSupp, updateAppSetting);

export default router;
