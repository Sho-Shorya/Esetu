import express from "express";

import {
  saveLocation,
  getCurrentLocation,
} from "../controllers/trackingController.js";

const trackerRoute = express.Router();

// Android tracker
trackerRoute.post("/location", saveLocation);

// User app
trackerRoute.get("/supplier/:supplierId", getCurrentLocation);

export default trackerRoute;
