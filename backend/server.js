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
dns.setServers(["1.1.1.1", "8.8.8.8"]);
const app = express();
const PORT = process.env.PORT || 5000;

//middleware
app.use(express.json());
app.use(cors());

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
app.use("/api/v1/offer", offerRoute);

app.listen(PORT, () => {
  connectDb();
  console.log("Server started successfully");
  console.log(`Server running on port ${PORT}`);
});
