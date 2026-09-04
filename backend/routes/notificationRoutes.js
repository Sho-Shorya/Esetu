import { Router } from "express";
import { isAuthenticated, isSupp } from "../middleware/isAuthenticated.js";
import {
  notifyAllUsers,
  createScheduledNotification,
  getScheduledNotifications,
  editScheduledNotification,
  cancelScheduledNotification,
} from "../controllers/notificationController.js";

const router = Router();

router.post("/all", isAuthenticated, isSupp, notifyAllUsers);
router.post("/schedule", isAuthenticated, isSupp, createScheduledNotification);
router.get("/scheduled", isAuthenticated, isSupp, getScheduledNotifications);
router.put("/schedule/:id", isAuthenticated, isSupp, editScheduledNotification);
router.put("/schedule/:id/cancel", isAuthenticated, isSupp, cancelScheduledNotification);

export default router;