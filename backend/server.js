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
import { startScheduledNotificationCron } from "./services/scheduledNotificationCron.js";
import trackingRoute from "./routes/trackingRoute.js";
import routeRoute from "./routes/routeRoute.js";
import paymentRouter from "./routes/paymentRouter.js";
import notificationRouter from "./routes/notificationRoutes.js";
import ringRouter from "./routes/ringRoutes.js";
import phoneCallPilotRoute from "./routes/phoneCallPilotRoutes.js";
import phoneCallRoute from "./routes/phoneCallRoutes.js";
import phoneOrderRoute from "./routes/phoneOrderRoutes.js";
import pilotAnalyticsRoutes from "./routes/pilotAnalyticsRoutes.js";
import { startPilotAudioRetention } from "./services/pilotAudioRetentionService.js";
import { startPilotPipelineRecovery } from "./controllers/phoneCallPilotController.js";

dns.setServers(["1.1.1.1", "8.8.8.8"]);
const app = express();
const PORT = process.env.PORT || 5000;

process.env.TZ = process.env.TZ || "Asia/Kolkata";

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "e-Setu Backend is running 🚀",
  });
});

// Lightweight health check — no DB, no auth, no logic.
// Used by external keep-alive pinger (e.g. cron-job.org every 14 min).
app.get("/api/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
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
app.use("/api/v1/payment", paymentRouter);
app.use("/api/v1/notify", notificationRouter);
app.use("/api/v1/ring", ringRouter);

/*
 * e-Setu phone orders: the supplier uploads a recording of a call they made on
 * their own phone, the pipeline turns it into a draft, and the controlled bridge
 * below turns a confirmed draft into a real Order.
 */
/* Recording upload + the orders it produced (supplier-only). */
app.use("/api/v1/phone-orders", phoneOrderRoute);
/* Customer fix + the bridge from a confirmed draft to a real Order. */
app.use("/api/v1/phone-call", phoneCallRoute);
/* Recording -> STT -> AI draft -> supplier review. */
app.use("/api/v1/pilot/phone-call", phoneCallPilotRoute);
/* Pilot accuracy analytics. */
app.use("/api/v1/pilot", pilotAnalyticsRoutes);

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

    // ✅ Start scheduled notification cron
    startScheduledNotificationCron();

    startPilotAudioRetention();
    startPilotPipelineRecovery();

    console.log(`🚀 Server running on port ${PORT}`);
  } catch (err) {
    console.error("Server startup failed:", err);
  }
});
