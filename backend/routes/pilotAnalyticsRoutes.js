import { Router } from "express";
import { isAuthenticated, isSupp } from "../middleware/isAuthenticated.js";
import { getPilotAnalytics } from "../controllers/phoneCallPilotController.js";

/**
 * Pilot analytics, mounted at /api/v1/pilot.
 *
 * Deliberately its own router: the phase 1 pilot router is mounted at
 * /api/v1/pilot/phone-call, so /analytics could not be expressed from there
 * without a path that misrepresents where the data lives.
 *
 * Read-only. Aggregates review.confirmed snapshots across pilot calls and
 * touches no order, cart, payment or customer code.
 */
const router = Router();

router.get("/analytics", isAuthenticated, isSupp, getPilotAnalytics);

export default router;
