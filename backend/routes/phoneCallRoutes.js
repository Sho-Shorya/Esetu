import { Router } from "express";
import { isAuthenticated, isSupp } from "../middleware/isAuthenticated.js";
import {
  createOrderFromCall,
  identifyCustomer,
  listIdentifyCandidates,
} from "../controllers/phoneCallController.js";

/**
 * e-Setu phone-order routes that sit beside the pipeline.
 *
 * Recording upload lives at /api/v1/phone-orders/recording and the pipeline
 * itself at /api/v1/pilot/phone-call. This router keeps only the customer
 * picker/fix and the one controlled bridge that turns a confirmed draft into a
 * real Order.
 *
 * Every route is supplier-only.
 */

const router = Router();

/* ------------------------- customer selection / fix ------------------------ */

router.get("/supplier/candidates", isAuthenticated, isSupp, listIdentifyCandidates);
router.post(
  "/supplier/calls/:id/customer",
  isAuthenticated,
  isSupp,
  identifyCustomer,
);

/* --------------------------- confirmed -> order --------------------------- */

/*
 * The controlled bridge. Supplier-only, and the service behind it is the only
 * code in the repository allowed to create an Order from a phone call.
 */
router.post("/drafts/:id/order", isAuthenticated, isSupp, createOrderFromCall);

export default router;
