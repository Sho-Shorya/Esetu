import express from "express";

import { startRoute, endRoute } from "../controllers/routeController.js";

const routeRoute = express.Router();

routeRoute.post("/start", startRoute);

routeRoute.post("/end", endRoute);

export default routeRoute;
