import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setSupplierData, setUserData } from "@/redux/userSlice";
import axios from "axios";
import { Eye, EyeOff, Loader2, LogIn } from "lucide-react";

import React, { useState } from "react";
import { useDispatch } from "react-redux";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { API_BASE_URL } from "@/lib/constants";

const Login = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    phoneNumber: "",
    password: "",
  });
  const navigate = useNavigate();

  const dispatch = useDispatch();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };
  const submitHander = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const res = await axios.post(
        `${API_BASE_URL}/api/v1/user/login`,
        formData,
      );
      if (res.data.success) {
        navigate("/");
        dispatch(setUserData(res.data.user));
        dispatch(setSupplierData(null));
        localStorage.setItem("token", res.data.token);
        toast.success(res.data.message, { duration: 1000 });
      }
    } catch (error) {
      toast.error(error.response?.data?.message);
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-100">
      <Card className="w-full max-w-sm relative">
        <CardHeader>
          <img
            src="arrow-left.png"
            onClick={() => navigate("/")}
            className=" absolute top-7 -left-13 h-[18px] cursor-pointer "
          />
          <CardTitle className={"text-2xl"}>Login as Shopkeeper</CardTitle>
          <CardDescription>Enter given details below.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3">
            <div className="grid gap-2">
              <Label htmlFor="phoneNumber">Phone Number</Label>
              <Input
                id="phoneNumber"
                type="number"
                name="phoneNumber"
                placeholder="98128XXXXX"
                required
                value={formData.phoneNumber}
                onChange={handleChange}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative flex items-center">
                <Input
                  id="password"
                  name="password"
                  placeholder="Enter your password"
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={handleChange}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      submitHander(e);
                    }
                  }}
                  required
                />
                {showPassword ? (
                  <EyeOff
                    onClick={() => setShowPassword(false)}
                    className="absolute right-[4%] cursor-pointer text-qray-700"
                  />
                ) : (
                  <Eye
                    onClick={() => setShowPassword(true)}
                    className="absolute right-[4%] cursor-pointer text-qray-700"
                  />
                )}
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex-col gap-2">
          <Button
            onClick={submitHander}
            type="submit"
            className="w-full cursor-pointer bg-red-800 hover:bg-red-600"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate:spin mr-2" />
                Please wait
              </>
            ) : (
              "login"
            )}
          </Button>
          <p className="text-gray-700 text-sm">
            Don't have an account?{" "}
            <Link
              to={"/signup"}
              className="hover:underline cursor-pointer text-red-800 "
            >
              Signup
            </Link>
          </p>
        </CardFooter>
      </Card>

      <div
        onClick={() => navigate("/admin-login")}
        className=" flex items-cneter gap-[10px] bg-emerald-500 py-2 px-3 rounded-full text-white font-bold absolute bottom-10 right-5"
      >
        <LogIn />
        Login as supplier
      </div>
    </div>
  );
};

export default Login;
