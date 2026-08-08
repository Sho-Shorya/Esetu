import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import userLogo from "../assets/user.jpeg";
import { toast } from "sonner";
import axios, { Axios } from "axios";
import { setSupplierData, setUserData } from "@/redux/userSlice";
import { API_BASE_URL } from "@/lib/constants";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";

const Profile = () => {
  const { userData, supplierData } = useSelector((store) => store.user);
  const [displayUser, setDisplayUser] = useState(null);
  const [updateLoading, setUpdateLoading] = useState(false);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const [updateUser, setUpdateUser] = useState({
    firstName: "",
    lastName: "",
    phoneNumber: "",
    profilePic: "",
    address: "",
    role: "",
    place: "",
    zipCode: "",
    gender: "",
  });
  const [file, setFile] = useState(null);
  const [orders, setOrders] = useState([]);

  // Load user from Redux or localStorage on mount
  useEffect(() => {
    if ((userData || supplierData) && (userData?._id || supplierData?._id)) {
      setDisplayUser(userData || supplierData);
    } else toast.error("Failed to Load Profile", error);
  }, [userData, supplierData, dispatch]);

  // Update form when displayUser changes
  useEffect(() => {
    if (displayUser) {
      setUpdateUser({
        firstName: displayUser?.firstName || "",
        lastName: displayUser?.lastName || "",
        phoneNumber: displayUser?.phoneNumber || "",
        role: displayUser?.role || "",
        address: displayUser?.address || "",
        place: displayUser?.place || "",
        zipCode: displayUser?.zipCode || "",
        profilePic: displayUser?.profilePic || displayUser?.profilePicUrl || "",
        gender: displayUser?.gender || "",
      });
    }
  }, [displayUser]);
  const handleChange = (e) => {
    setUpdateUser((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    setFile(selectedFile);
    setUpdateUser({
      ...updateUser,
      profilePic: URL.createObjectURL(selectedFile),
    });
  };
  const handleSubmit = async (e) => {
    e.preventDefault();
    setUpdateLoading(true);

    if (!displayUser || !displayUser._id) {
      toast.error(
        "User profile not loaded. Please refresh the page and try again.",
      );
      userData && navigate("/");
      supplierData && navigate("/admin-dashboard");
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      toast.error("Authentication token missing. Please login again.");
      userData && navigate("/login");
      supplierData && navigate("/admin-login");
      return;
    }

    try {
      //use formData for text+file
      const formData = new FormData();
      formData.append("firstName", updateUser.firstName);
      formData.append("lastName", updateUser.lastName);
      formData.append("phoneNumber", updateUser.phoneNumber);
      formData.append("address", updateUser.address);
      formData.append("place", updateUser.place);
      formData.append("zipCode", updateUser.zipCode);
      formData.append("country", updateUser.country || "");
      formData.append("gender", updateUser.gender || "");

      if (file) {
        formData.append("profilePic", file); //image file for backend multer
      }

      const res = await axios.put(
        `${API_BASE_URL}/api/v1/user/update/${displayUser._id}`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        },
      );

      if (res.data.success) {
        const updatedUser = res.data.user || { ...displayUser, ...updateUser };
        setDisplayUser(updatedUser);
        userData && dispatch(setUserData(updatedUser));
        supplierData && dispatch(setSupplierData(updatedUser));

        toast.success(res.data.message || "प्रोफ़ाइल अपडेट हो गई है।");
      } else {
        toast.error(res.data.message || "प्रोफ़ाइल अपडेट करने में विफल");
      }
    } catch (error) {
      console.error("प्रोफ़ाइल अपडेट करने में विफल ", error);
      toast.error(
        error?.response?.data?.message || "प्रोफ़ाइल अपडेट करने में विफल",
      );
    } finally {
      setUpdateLoading(false);
    }
  };
  return (
    <div className=" relative min-h-screen bg-gray-100 px-3 py-20 sm:px-4 lg:px-6">
      <div className="mt-4 rounded-2xl bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col items-center justify-center">
          <h2 className="mb-6 text-xl font-bold text-gray-800">
            अपडेट प्रोफ़ाइल
          </h2>
          <div className="flex w-full max-w-2xl flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex flex-col items-center justify-center lg:min-w-[180px]">
              <img
                src={updateUser?.profilePic || userLogo}
                alt="pfp"
                className={`h-24 w-24 rounded-full ${supplierData ? "border-emerald-400" : "border-red-400"} border-4  object-cover p-[2px] sm:h-28 sm:w-28`}
              />
              <label
                className={`mt-4 w-full cursor-pointer rounded-lg ${supplierData ? "bg-emerald-600" : "bg-red-600"} px-4 py-2 text-center text-sm text-white hover:bg-emerald-700 sm:w-auto`}
              >
                चित्र बदलें
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </label>
            </div>
            <form
              onSubmit={handleSubmit}
              className="w-full space-y-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5 lg:max-w-xl"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    पहला नाम
                  </label>
                  <input
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                    type="text"
                    name="firstName"
                    value={updateUser.firstName || ""}
                    onChange={handleChange}
                    placeholder="john"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    सरनेम
                  </label>
                  <input
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                    value={updateUser.lastName || ""}
                    onChange={handleChange}
                    type="text"
                    name="lastName"
                    placeholder="doe"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">
                  फ़ोन नंबर
                </label>
                <input
                  className="mt-1 w-full rounded-lg border bg-gray-300 text-gray-500 px-3 py-2 text-sm"
                  value={updateUser.phoneNumber || ""}
                  onChange={handleChange}
                  type="text"
                  disabled
                  name="phoneNumber"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">
                  Role
                </label>
                <input
                  className="mt-1 w-full rounded-lg border bg-gray-300 text-gray-500 px-3 py-2 text-sm"
                  value={updateUser.role || ""}
                  onChange={handleChange}
                  type="text"
                  disabled
                  name="role"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">पता</label>
                <input
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  value={updateUser.address || ""}
                  onChange={handleChange}
                  type="text"
                  placeholder="Enter your address"
                  name="address"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    जगह
                  </label>
                  <input
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                    value={updateUser.place || ""}
                    onChange={handleChange}
                    type="text"
                    placeholder="Enter your place"
                    name="place"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Zipcode
                  </label>
                  <input
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                    value={updateUser.zipCode || ""}
                    onChange={handleChange}
                    type="text"
                    placeholder="Enter your zipcode"
                    name="zipCode"
                  />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    लिंग
                  </label>
                  <select
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                    value={updateUser.gender || ""}
                    onChange={handleChange}
                    name="gender"
                  >
                    <option value="">चुनें</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                className={`mt-2 w-full rounded-lg ${supplierData ? "bg-emerald-700 hover:bg-emerald-600" : "bg-red-700 hover:bg-red-600"} px-4 py-2 text-sm font-medium text-white `}
              >
                प्रोफ़ाइल अपडेट करें!
              </button>
            </form>
          </div>
        </div>
      </div>
      {updateLoading && (
        <div className="fixed top-0 left-0 w-full h-full bg-black/50 flex items-center justify-center">
          <div className="w-[80%] text-black h-[20%] bg-red-50  gap-3 flex flex-col rounded-2xl items-center justify-center">
            <Loader2 className="animate-spin text-red-600 h-10 w-10" />
            <p className="text-[15px] font-semibold">प्रोफ़ाइल सेव हो रही है</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;
