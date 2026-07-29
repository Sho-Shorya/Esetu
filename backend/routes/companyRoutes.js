import express from "express";
import { isSupp, isAuthenticated } from "../middleware/isAuthenticated.js";
import {
  addCompany,
  deleteCompany,
  getAllCompanies,
  getCompanyById,
  updateCompany,
} from "../controllers/companyController.js";
import { singleUpload, uploadAny } from "../middleware/multer.js";

const comRouter = express.Router();

comRouter.get("/get-com", getAllCompanies);
comRouter.get("/get-com/:id", getCompanyById);
comRouter.post(
  "/add-com",
  isAuthenticated,
  isSupp,
  singleUpload("logo"),
  addCompany,
);
comRouter.put(
  "/update-com/:id",
  isAuthenticated,
  isSupp,
  singleUpload("logo"),
  updateCompany,
);
comRouter.delete("/delete-com/:id", isAuthenticated, isSupp, deleteCompany);

export default comRouter;
