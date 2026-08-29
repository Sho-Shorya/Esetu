import { Router } from "express";
import { isAuthenticated, isSupp } from "../middleware/isAuthenticated.js";
import { notifyAllUsers } from "../controllers/notificationController.js";

const router = Router();

router.post("/all", isAuthenticated, isSupp, notifyAllUsers);

export default router;