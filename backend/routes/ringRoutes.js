import { Router } from "express";
import { isAuthenticated, isSupp } from "../middleware/isAuthenticated.js";
import { sendRing, pollRings, ringHistory } from "../controllers/ringController.js";
import { getShifts, saveShifts, getRegularUsers } from "../controllers/shiftController.js";

const router = Router();

router.post("/send", isAuthenticated, isSupp, sendRing);
router.get("/poll", isAuthenticated, pollRings);
router.get("/history", isAuthenticated, isSupp, ringHistory);

router.get("/shifts", isAuthenticated, isSupp, getShifts);
router.post("/shifts", isAuthenticated, isSupp, saveShifts);
router.get("/users", isAuthenticated, isSupp, getRegularUsers);

export default router;
