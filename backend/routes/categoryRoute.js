import express from "express";
import {
  listCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
} from "../controllers/categoryController.js";
import { isSupp, isAuthenticated } from "../middleware/isAuthenticated.js";
import { singleUpload } from "../middleware/multer.js";

const catRouter = express.Router();

catRouter.get("/get-cat", listCategories);
catRouter.get("/get-cat/:id", getCategory);
catRouter.post(
  "/add-cat",
  isAuthenticated,
  isSupp,
  singleUpload("image"),
  createCategory,
);
catRouter.put("/update-cat/:id", isAuthenticated, isSupp, updateCategory);
catRouter.delete("/delete-cat/:id", isAuthenticated, isSupp, deleteCategory);

export default catRouter;
