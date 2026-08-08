import { isAuthenticated, isSupp } from "../middleware/isAuthenticated.js";
import { singleUpload } from "../middleware/multer.js";
import express, { Router } from "express";
import {
  addProduct,
  getallproducts,
  deleteProduct,
  updateProduct,
  getProductById,
} from "../controllers/productController.js";
import { multipleUpload } from "../middleware/multer.js";

const productRoute = Router();

productRoute.get("/", isAuthenticated, getallproducts);
productRoute.get("/:id", getProductById);

productRoute.post(
  "/add",
  isAuthenticated,
  isSupp,
  singleUpload("media"),
  addProduct,
);
productRoute.delete(
  "/delete/:productId",
  isAuthenticated,
  isSupp,
  deleteProduct,
);
productRoute.put(
  "/edit-product/:productId",
  isAuthenticated,
  isSupp,
  singleUpload("media"),
  updateProduct,
);

export default productRoute;
