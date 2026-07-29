import express from "express";
import {
  listOffers,
  getOffer,
  createOffer,
  updateOffer,
  deleteOffer,
} from "../controllers/offerController.js";
import { isSupp, isAuthenticated } from "../middleware/isAuthenticated.js";

const router = express.Router();

router.get("/", listOffers);
router.get("/:id", getOffer);
router.post("/create-offer", isAuthenticated, isSupp, createOffer);
router.put("/update-offer/:id", isAuthenticated, isSupp, updateOffer);
router.delete("/delete-offer/:id", isAuthenticated, isSupp, deleteOffer);

export default router;
