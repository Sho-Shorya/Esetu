import express from "express";
import "dotenv/config";
import { connectDb } from "./database/db.js";
import userRoute from "./routes/userRoute.js";
import productRoute from "./routes/productRoute.js";
import cartRoute from "./routes/cartRoute.js";
import debugRoute from "./routes/debugRoute.js";
import categoryRoute from "./routes/categoryRoute.js";
import offerRoute from "./routes/offerRoute.js";
import cors from "cors";
import dns from "dns";
import catRouter from "./routes/categoryRoute.js";
import comRouter from "./routes/companyRoutes.js";
import orderRouter from "./routes/orderRoutes.js";
import settingsRouter from "./routes/settingsRoute.js";
import { syncTodayOrderFlags } from "./controllers/OrderController.js";
dns.setServers(["1.1.1.1", "8.8.8.8"]);
const app = express();
const PORT = process.env.PORT || 5000;

process.env.TZ = process.env.TZ || "Asia/Kolkata";

//middleware
app.use(express.json());

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((origin) => origin.trim())
  : [
      "https://esetu.vercel.app",
      "http://localhost:5173",
      "http://localhost:3000",
      "*",
    ];

app.use((req, res, next) => {
  const requestOrigin = req.headers.origin;
  const originAllowed =
    !requestOrigin ||
    allowedOrigins.includes("*") ||
    allowedOrigins.includes(requestOrigin);

  if (requestOrigin && originAllowed) {
    res.setHeader("Access-Control-Allow-Origin", requestOrigin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    );
    res.setHeader(
      "Access-Control-Allow-Headers",
      req.headers["access-control-request-headers"] ||
        "Content-Type,Authorization",
    );
    res.setHeader("Vary", "Origin");
  }

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

app.use((req, res, next) => {
  syncTodayOrderFlags().catch(() => {});
  next();
});

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "e-Setu Backend is running 🚀",
  });
});

app.use("/api/v1/user", userRoute);
app.use("/api/v1/product", productRoute);
app.use("/api/v1/cart", cartRoute);
app.use("/api/v1/debug", debugRoute);
app.use("/api/v1/category", catRouter);
app.use("/api/v1/company", comRouter);
app.use("/api/v1/order", orderRouter);
app.use("/api/v1/settings", settingsRouter);
app.use("/api/v1/offer", offerRoute);

const scheduleMidnightSync = () => {
  const now = new Date();
  const nextMidnight = new Date(now);
  nextMidnight.setHours(24, 0, 0, 0);

  const delay = nextMidnight.getTime() - now.getTime();

  setTimeout(async () => {
    try {
      await syncTodayOrderFlags();
    } catch (error) {
      console.error("[order-sync] Midnight sync failed:", error);
    }

    scheduleMidnightSync();
  }, delay);
};

app.listen(PORT, async () => {
  await connectDb();
  await syncTodayOrderFlags();
  scheduleMidnightSync();

  console.log("Server started successfully");
  console.log(`Server running on port ${PORT}`);
});
