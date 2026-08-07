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
import axios from "axios";
import { Eye, EyeOff, Loader2, LogIn } from "lucide-react";

import React, { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { API_BASE_URL } from "@/lib/constants";
import { BiLeftArrow } from "react-icons/bi";

const Signup = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    phoneNumber: "",
    shopKey: "",
    password: "",
  });
  const navigate = useNavigate();

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
        `${API_BASE_URL}/api/v1/user/register`,
        formData,
      );
      if (res.data.success) {
        navigate("/login");
        toast.success(res.data.message, { duration: 2000 });
      } else console.log("Registration failed");
    } catch (error) {
      toast.error(error.response?.data?.message);
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-100">
      <Card className="w-full max-w-sm relative">
        <BiLeftArrow
          onClick={() => navigate("/")}
          className=" absolute top-7 -left-13 h-[18px] cursor-pointer "
        />
        <CardHeader>
          <CardTitle className={"text-2xl"}>
            Create a Shopkepper Account
          </CardTitle>
          <CardDescription>Enter given details below.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="firstName">First name</Label>
                <Input
                  id="firstName"
                  name="firstName"
                  type="text"
                  placeholder="john"
                  required
                  value={formData.firstName}
                  onChange={handleChange}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="lastName">Last name</Label>
                <Input
                  id="lastName"
                  name="lastName"
                  type="text"
                  placeholder="doe"
                  required
                  value={formData.lastName}
                  onChange={handleChange}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="number">Phone Number</Label>
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
            <div className="grid  text-red-600 gap-2">
              <Label htmlFor="place">Shopkeeper Secret Key*</Label>
              <Input
                id="shopKey"
                type="text"
                name="shopKey"
                placeholder="Enter Shopkepper Secret Key here"
                required
                value={formData.shopKey}
                onChange={handleChange}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative flex items-center">
                <Input
                  id="password"
                  name="password"
                  placeholder="Enter a password"
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
              "Sign up"
            )}
          </Button>
          <p className="text-gray-700 text-sm">
            Already have an account?{" "}
            <Link
              to={"/login"}
              className="hover:underline cursor-pointer text-red-800 "
            >
              login
            </Link>
          </p>
        </CardFooter>
      </Card>
      <div
        onClick={() => navigate("/admin-signup")}
        className=" flex items-cneter gap-[10px] bg-emerald-500 py-2 px-3 rounded-full text-white font-bold absolute bottom-10 right-5"
      >
        <LogIn />
        Signup as supplier
      </div>
    </div>
  );
};

export default Signup;
