import { Router } from "express";
import { isAuthenticated, isSupp } from "../middleware/isAuthenticated.js";
import { sendRing } from "../controllers/ringController.js";
import { getShifts, saveShifts, getRegularUsers } from "../controllers/shiftController.js";

const router = Router();

router.post("/send", isAuthenticated, isSupp, sendRing);

router.get("/shifts", isAuthenticated, isSupp, getShifts);
router.post("/shifts", isAuthenticated, isSupp, saveShifts);
router.get("/users", isAuthenticated, isSupp, getRegularUsers);

export default router;
