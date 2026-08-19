import axios from "axios";
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { API_BASE_URL } from "@/lib/constants";
import {
  ArrowRight,
  Users,
  UserPlus,
  Phone,
  LocateIcon,
  MapPin,
  House,
  CircleUser,
  Check,
  X,
  ChevronLeft,
} from "lucide-react";

const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUsers = async () => {
      const token = localStorage.getItem("token");
      if (!token) return;

      try {
        setLoading(true);
        const res = await axios.get(`${API_BASE_URL}/api/v1/user/all-user`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.data.success) {
          setUsers(res.data.users || []);
        }
      } catch (error) {
        toast.error("उपयोगकर्ताओं को लोड करने में समस्या हुई।");
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-white px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl rounded-3xl bg-white p-6 shadow-lg border border-emerald-100">
        <div
          onClick={() => navigate("/admin-dashboard")}
          className="px-2 py-2 w-[80px] flex mb-2 border-t-1 border-r-1 rounded-full border-emerald-400 items-center gap-1"
        >
          <ChevronLeft className="h-4 w-4 " />
          पीछे
        </div>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">खरीदार प्रबंधन</h1>
            <p className="mt-2 text-gray-600">
              यहाँ आप सभी खरीददारों को देख सकते हैं और उनके order प्रोफ़ाइल खोल
              सकते हैं।
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-2xl bg-emerald-100 px-4 py-2 text-emerald-800">
            <Users className="h-5 w-5" />
            {users.length} खरीदार
          </div>
        </div>

        {loading ? (
          <div className="mt-10 rounded-3xl bg-gray-50 p-8 text-center text-gray-600">
            लोड हो रहा है...
          </div>
        ) : users.length === 0 ? (
          <div className="mt-10 rounded-3xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center text-gray-600">
            कोई उपयोगकर्ता उपलब्ध नहीं है।
          </div>
        ) : (
          <div className="mt-6 grid gap-3">
            {users.map((user) => (
              <button
                key={user._id}
                onClick={() => navigate(`/admin/user/${user._id}`)}
                className="group w-full rounded-3xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:border-emerald-300 hover:shadow-lg"
              >
                <div className="flex items-center justify-between">
                  {/* Left */}
                  <div className="flex items-center overflow-hidden gap-4">
                    {/* Profile */}
                    {user.profilePic ? (
                      <img
                        src={user.profilePic}
                        alt={user.firstName}
                        className="h-16 w-16 rounded-full border-2 border-emerald-200 object-cover"
                      />
                    ) : (
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-2xl font-bold text-emerald-700">
                        {user.firstName?.charAt(0)}
                      </div>
                    )}

                    {/* User Info */}
                    <div className="text-left">
                      <h2 className="text-lg font-bold text-gray-900">
                        {user.firstName.toUpperCase()}{" "}
                        {user.lastName.toUpperCase()}
                      </h2>

                      <p className="flex text-sm text-gray-500">
                        <Phone className="h-4 text-green-500" />{" "}
                        {user.phoneNumber}
                      </p>

                      <p className="text-sm flex text-gray-500">
                        <MapPin className="h-4 text-blue-600" />{" "}
                        {user.place || "स्थान उपलब्ध नहीं"}
                      </p>
                    </div>
                  </div>

                  {/* View Button */}
                  <div className="rounded-full bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white">
                    Open →
                  </div>
                </div>

                {/* Bottom Info */}
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="flex items-center rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-700">
                    <House className="h-4" /> {user.address || "No Address"}
                  </span>

                  <span className="flex items-center rounded-full bg-orange-100 px-3 py-1 text-sm font-semibold text-orange-700">
                    <MapPin className="h-4" /> {user.zipCode || "N/A"}
                  </span>

                  <span className="flex items-center rounded-full bg-purple-100 px-3 py-1 text-sm font-semibold text-purple-700">
                    <CircleUser className="h-4" /> {user.gender || "Unknown"}
                  </span>

                  <span
                    className={`rounded-full px-3 py-1 text-sm font-semibold ${
                      user.isVerified
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {user.isVerified ? (
                      <div className="flex items-center">
                        <Check className="h-4" />
                        Verified
                      </div>
                    ) : (
                      <div className="flex items-center">
                        <X className="h-4" />
                        Not Verified
                      </div>
                    )}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminUsers;
