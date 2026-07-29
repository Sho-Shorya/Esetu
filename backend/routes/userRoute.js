import express, { Router } from "express";
import {
  register,
  login,
  logout,
  changePassword,
  allUser,
  getUserById,
  updateUser,
  getCurrentUser,
} from "../controllers/userController.js";
import { isAuthenticated, isSupp } from "../middleware/isAuthenticated.js";
import { singleUpload } from "../middleware/multer.js";
import {
  adminLogin,
  adminLogout,
  adminRegister,
} from "../controllers/AdminController.js";

const userRouter = Router();

userRouter.post("/register", register);
userRouter.post("/login", login);
userRouter.post("/logout", isAuthenticated, logout);
userRouter.get("/current", isAuthenticated, getCurrentUser);

userRouter.post("/admin-register", adminRegister);
userRouter.post("/admin-login", adminLogin);
userRouter.post("/admin-logout", isAuthenticated, isSupp, adminLogout);
// userRouter.post("/admin-forgot-password", isAuthenticated, isSupp);
// userRouter.post("/admin-verify-otp/:phoneNumber", isAuthenticated, isSupp);
userRouter.get("/all-user", isAuthenticated, isSupp, allUser);
userRouter.get("/get-user/:userId", isAuthenticated, isSupp, getUserById);
userRouter.put(
  "/update/:userId",
  isAuthenticated,
  singleUpload("profilePic"),
  updateUser,
);

export default userRouter;
