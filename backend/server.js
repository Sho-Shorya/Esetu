import express from "express";
import "dotenv/config";
import cors from "cors";
import dns from "dns";

import { connectDb } from "./database/db.js";

import userRoute from "./routes/userRoute.js";
import productRoute from "./routes/productRoute.js";
import cartRoute from "./routes/cartRoute.js";
import debugRoute from "./routes/debugRoute.js";
import catRouter from "./routes/categoryRoute.js";
import comRouter from "./routes/companyRoutes.js";
import orderRouter from "./routes/orderRoutes.js";
import settingsRouter from "./routes/settingsRoute.js";
import offerRoute from "./routes/offerRoute.js";
import { syncTodayOrderFlags } from "./controllers/orderController.js";
import { startReminderCron } from "./services/reminderCron.js";
import trackingRoute from "./routes/trackingRoute.js";
import routeRoute from "./routes/routeRoute.js";

dns.setServers(["1.1.1.1", "8.8.8.8"]);
const app = express();
const PORT = process.env.PORT || 5000;

process.env.TZ = process.env.TZ || "Asia/Kolkata";

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  syncTodayOrderFlags().catch(console.error);
  next();
});

app.get("/", (req, res) => {
  res.json({
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
app.use("/api/v1/tracking", trackingRoute);
app.use("/api/v1/route", routeRoute);

const scheduleMidnightSync = () => {
  const now = new Date();
  const nextMidnight = new Date(now);
  nextMidnight.setHours(24, 0, 0, 0);

  const delay = nextMidnight.getTime() - now.getTime();

  setTimeout(async () => {
    try {
      await syncTodayOrderFlags();
    } catch (err) {
      console.error(err);
    }

    scheduleMidnightSync();
  }, delay);
};

app.listen(PORT, async () => {
  try {
    await connectDb();

    await syncTodayOrderFlags();

    scheduleMidnightSync();

    // ✅ Start reminder cron
    startReminderCron();

    console.log(`🚀 Server running on port ${PORT}`);
  } catch (err) {
    console.error("Server startup failed:", err);
  }
});
