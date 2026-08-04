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

  // const fetchOrders = async () => {
  //   const token = localStorage.getItem("token");
  //   if (!token) return;

  //   try {
  //     const res = await axios.get(`${API_BASE_URL}/api/v1/cart/orders`, {
  //       headers: { Authorization: `Bearer ${token}` },
  //     });

  //     if (res.data.success) {
  //       setOrders(res.data.orders || []);
  //     }
  //   } catch (error) {
  //     toast.error(error);
  //     console.error("Failed to load user orders", error);
  //   }
  // };

  // useEffect(() => {
  //   fetchOrders();
  // }, [displayUser]);

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
      <Tabs defaultValue="profile" className="mx-auto w-full max-w-5xl">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger
            className="cursor-pointer text-sm sm:text-base"
            value="profile"
          >
            Profile
          </TabsTrigger>
          <TabsTrigger
            className="cursor-pointer text-sm sm:text-base"
            value="order"
          >
            Orders
          </TabsTrigger>
        </TabsList>
        <TabsContent value="profile">
          <div className="mt-4 rounded-2xl bg-white p-4 shadow-sm sm:p-6">
            <div className="flex flex-col items-center justify-center">
              <h2 className="mb-6 text-xl font-bold text-gray-800">
                Update Profile
              </h2>
              <div className="flex w-full max-w-2xl flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex flex-col items-center justify-center lg:min-w-[180px]">
                  <img
                    src={updateUser?.profilePic || userLogo}
                    alt="pfp"
                    className="h-24 w-24 rounded-full border-4 border-emerald-400 object-cover p-[2px] sm:h-28 sm:w-28"
                  />
                  <label className="mt-4 w-full cursor-pointer rounded-lg bg-emerald-600 px-4 py-2 text-center text-sm text-white hover:bg-emerald-700 sm:w-auto">
                    Change Picture
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
                        First Name
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
                        Last Name
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
                      Phone Number
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
                    <label className="text-sm font-medium text-gray-700">
                      Address
                    </label>
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
                        Place
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
                        Gender
                      </label>
                      <select
                        className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                        value={updateUser.gender || ""}
                        onChange={handleChange}
                        name="gender"
                      >
                        <option value="">Select</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="mt-2 w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                  >
                    Update Profile
                  </button>
                </form>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
      {updateLoading && (
        <div className="absolute w-full h-full bg-black/70 flex items-center justify-center">
          <div className="w-[80%] text-black h-[40%] bg-red-50 flex flex-col items-center justify-center">
            <Loader2 className="animate-spin h-10 w-10" />
            <p className="text-[15px] font-semibold">प्रोफ़ाइल सेव हो रही है</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;
