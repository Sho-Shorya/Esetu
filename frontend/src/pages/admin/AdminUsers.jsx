import axios from "axios";
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { API_BASE_URL } from "@/lib/constants";
import { ArrowRight, Users, UserPlus } from "lucide-react";

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
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-white px-4 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl rounded-3xl bg-white p-6 shadow-lg border border-emerald-100">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              उपयोगकर्ता प्रबंधन
            </h1>
            <p className="mt-2 text-gray-600">
              यहाँ आप सभी उपयोगकर्ताओं को देख सकते हैं और उनके आदेश प्रोफ़ाइल
              खोल सकते हैं।
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-2xl bg-emerald-100 px-4 py-2 text-emerald-800">
            <Users className="h-5 w-5" />
            {users.length} उपयोगकर्ता
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
          <div className="mt-8 grid gap-4">
            {users.map((user) => (
              <button
                key={user._id}
                onClick={() => navigate(`/admin/user/${user._id}`)}
                className="group flex w-full flex-col gap-4 rounded-3xl border border-gray-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-1 hover:border-emerald-200"
              >
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">
                      {user.firstName} {user.lastName}
                    </h2>
                    <p className="text-sm text-gray-500">{user.phoneNumber}</p>
                  </div>
                  <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
                    प्रोफ़ाइल देखें <ArrowRight className="h-4 w-4" />
                  </span>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <div className="rounded-2xl bg-gray-50 p-3 text-sm text-gray-700">
                    पता: {user.address || "निरਧारित"}
                  </div>
                  <div className="rounded-2xl bg-gray-50 p-3 text-sm text-gray-700">
                    शहर: {user.place || "निर्धारित"}
                  </div>
                  <div className="rounded-2xl bg-gray-50 p-3 text-sm text-gray-700">
                    ज़िप: {user.zipCode || "N/A"}
                  </div>
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
