import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { useSelector } from "react-redux";
import { toast } from "sonner";
import { API_BASE_URL } from "@/lib/constants";
import {
  Bell,
  BellRing,
  Send,
  Clock,
  Users,
  Loader2,
  Plus,
  X,
  CalendarClock,
  Pencil,
  Ban,
  ChevronDown,
  Check,
  UserRound,
  CalendarPlus,
} from "lucide-react";

const AdminNotificationPanel = () => {
  const { supplierData } = useSelector((state) => state.user);

  const [notifications, setNotifications] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [usersLoading, setUsersLoading] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [recipientType, setRecipientType] = useState("all");
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [scheduledAt, setScheduledAt] = useState("");
  const [sending, setSending] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  const userDropdownRef = useRef(null);

  const token = localStorage.getItem("token");

  /* =========================================================
     FETCH SCHEDULED NOTIFICATIONS
  ========================================================= */

  const fetchNotifications = async () => {
    if (!token) return;

    try {
      setLoading(true);

      const res = await axios.get(
        `${API_BASE_URL}/api/v1/notify/scheduled`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (res.data.success) {
        setNotifications(res.data.notifications || []);
      }
    } catch (error) {
      console.error("Fetch scheduled notifications error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (supplierData) {
      fetchNotifications();
    }
  }, [supplierData]);

  /* =========================================================
     FETCH ALL USERS (for custom recipient picker)
  ========================================================= */

  useEffect(() => {
    if (!token) return;

    const fetchUsers = async () => {
      try {
        setUsersLoading(true);

        const res = await axios.get(`${API_BASE_URL}/api/v1/user/all-user`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (res.data.success) {
          const regularUsers = (res.data.users || []).filter(
            (u) => u.role !== "supplier",
          );

          setAllUsers(regularUsers);
        }
      } catch (error) {
        console.error("Fetch users for notification error:", error);
      } finally {
        setUsersLoading(false);
      }
    };

    fetchUsers();
  }, [token]);

  /* =========================================================
     CLOSE USER DROPDOWN ON OUTSIDE CLICK
  ========================================================= */

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        userDropdownRef.current &&
        !userDropdownRef.current.contains(e.target)
      ) {
        setShowUserDropdown(false);
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  /* =========================================================
     RESET FORM
  ========================================================= */

  const resetForm = () => {
    setTitle("");
    setMessage("");
    setRecipientType("all");
    setSelectedUsers([]);
    setScheduledAt("");
    setEditingId(null);
    setShowForm(false);
    setSearchQuery("");
  };

  /* =========================================================
     FILTER USERS
  ========================================================= */

  const filteredUsers = allUsers.filter((user) => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;

    const searchable = [
      user.firstName,
      user.lastName,
      user.phoneNumber,
      user.place,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return searchable.includes(query);
  });

  /* =========================================================
     TOGGLE USER SELECTION
  ========================================================= */

  const toggleUser = (userId) => {
    setSelectedUsers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId],
    );
  };

  const getFullName = (user) =>
    [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim();

  /* =========================================================
     GET CURRENT MIN DATETIME FOR SCHEDULING
  ========================================================= */

  const getMinDateTime = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 1);
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  };

  const minDateTime = getMinDateTime();

  /* =========================================================
     SUBMIT (CREATE / UPDATE / SEND NOW)
  ========================================================= */

  const handleSubmit = async (sendNow = false) => {
    if (!title.trim()) {
      toast.error("नोटिफिकेशन का टाइटल आवश्यक है।");
      return;
    }

    if (!message.trim()) {
      toast.error("नोटिफिकेशन का मैसेज आवश्यक है।");
      return;
    }

    if (recipientType === "custom" && selectedUsers.length === 0) {
      toast.error("कम से कम एक उपयोगकर्ता चुनें।");
      return;
    }

    if (!sendNow && !editingId && !scheduledAt) {
      toast.error("शेड्यूल समय चुनें।");
      return;
    }

    if (!supplierData) return;

    try {
      setSending(true);

      if (editingId) {
        const res = await axios.put(
          `${API_BASE_URL}/api/v1/notify/schedule/${editingId}`,
          {
            title: title.trim(),
            message: message.trim(),
            recipientType,
            recipientUsers: selectedUsers,
            scheduledAt,
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        if (res.data.success) {
          toast.success(res.data.message);
          resetForm();
          fetchNotifications();
        }
      } else {
        const res = await axios.post(
          `${API_BASE_URL}/api/v1/notify/schedule`,
          {
            title: title.trim(),
            message: message.trim(),
            recipientType,
            recipientUsers: selectedUsers,
            scheduledAt,
            sendNow,
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        if (res.data.success) {
          toast.success(res.data.message);
          resetForm();
          fetchNotifications();
        }
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "कुछ गलत हो गया।");
    } finally {
      setSending(false);
    }
  };

  /* =========================================================
     EDIT NOTIFICATION
  ========================================================= */

  const handleEdit = (notif) => {
    setEditingId(notif._id);
    setTitle(notif.title);
    setMessage(notif.message);
    setRecipientType(notif.recipientType);
    setSelectedUsers(
      (notif.recipientUsers || []).map((u) =>
        typeof u === "string" ? u : u._id,
      ),
    );

    const local = new Date(notif.scheduledAt);
    const localInput = new Date(
      local.getTime() - local.getTimezoneOffset() * 60000,
    );
    setScheduledAt(localInput.toISOString().slice(0, 16));

    setShowForm(true);

    window.scrollTo({
      top: document.getElementById("notification-panel")?.offsetTop || 0,
      behavior: "smooth",
    });
  };

  /* =========================================================
     CANCEL NOTIFICATION
  ========================================================= */

  const handleCancel = async (id) => {
    if (!window.confirm("क्या आप यह नोटिफिकेशन रद्द करना चाहते हैं?")) return;

    try {
      const res = await axios.put(
        `${API_BASE_URL}/api/v1/notify/schedule/${id}/cancel`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (res.data.success) {
        toast.success(res.data.message);
        fetchNotifications();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "रद्द नहीं हो सका।");
    }
  };

  /* =========================================================
     FORMAT SCHEDULE TIME
  ========================================================= */

  const formatScheduleTime = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <section
      id="notification-panel"
      className="
        mt-4
        overflow-hidden
        rounded-[30px]
        border
        border-slate-200
        bg-white
        shadow-[0_8px_28px_rgba(15,23,42,0.05)]
        scroll-mt-24
      "
    >
      {/* =====================================================
          HEADER
      ====================================================== */}

      <div
        className="
          flex
          flex-col
          gap-4
          bg-gradient-to-br
          from-emerald-700
          via-emerald-600
          to-emerald-500
          px-5
          py-5
          text-white
          sm:flex-row
          sm:items-center
          sm:justify-between
          sm:px-7
          sm:py-6
        "
      >
        <div className="flex items-center gap-4">
          <div
            className="
              flex
              h-12
              w-12
              items-center
              justify-center
              rounded-2xl
              bg-white/15
              backdrop-blur
            "
          >
            <BellRing className="h-6 w-6" />
          </div>

          <div>
            <h2 className="text-xl font-black tracking-tight sm:text-2xl">
              नोटिफिकेशन
            </h2>

            <p className="mt-0.5 text-sm font-medium text-emerald-100">
              सभी को या चुने हुए उपयोगकर्ताओं को भेजें
            </p>
          </div>
        </div>

        {/* STATS */}

        <div
          className="
            grid
            grid-cols-2
            gap-2
            sm:grid-cols-3
            sm:gap-3
          "
        >
          <div className="rounded-2xl bg-white/15 px-3 py-2 text-center backdrop-blur">
            <p className="text-xl font-black leading-none">
              {notifications.length}
            </p>
            <p className="mt-1 text-[10px] font-semibold text-emerald-100">
              शेड्यूल्ड
            </p>
          </div>

          <div className="rounded-2xl bg-white/15 px-3 py-2 text-center backdrop-blur">
            <p className="text-xl font-black leading-none">
              {allUsers.length}
            </p>
            <p className="mt-1 text-[10px] font-semibold text-emerald-100">
              उपयोगकर्ता
            </p>
          </div>

          <div
            className="
              col-span-2
              sm:col-span-1
            "
          >
            <button
              type="button"
              onClick={() => {
                if (editingId) resetForm();
                setShowForm((prev) => !prev);
              }}
              className="
                flex
                h-full
                w-full
                items-center
                justify-center
                gap-2
                rounded-2xl
                bg-white
                px-4
                py-2
                text-sm
                font-black
                text-emerald-700
                shadow-sm
                transition
                hover:bg-emerald-50
                active:scale-[0.97]
              "
            >
              {showForm ? (
                <>
                  <X className="h-4 w-4" />
                  बंद करें
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  नया भेजें
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* =====================================================
          COMPOSE / EDIT FORM
      ====================================================== */}

      {showForm && (
        <div className="border-b border-slate-100 bg-slate-50/70 px-5 py-5 sm:px-7">
          <div className="mb-4 flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
              {editingId ? (
                <Pencil className="h-4 w-4" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </span>

            <h3 className="text-base font-black text-slate-900">
              {editingId ? "नोटिफिकेशन एडिट करें" : "नया नोटिफिकेशन"}
            </h3>
          </div>

          {/* TITLE */}

          <label className="mb-1.5 block text-xs font-bold text-slate-500">
            टाइटल
          </label>

          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="जैसे: नया ऑफर आ गया 🎉"
            maxLength={80}
            className="
              h-12
              w-full
              rounded-2xl
              border
              border-slate-200
              bg-white
              px-4
              text-sm
              font-semibold
              text-slate-900
              outline-none
              transition
              focus:border-emerald-400
              focus:ring-4
              focus:ring-emerald-500/10
            "
          />

          {/* MESSAGE */}

          <label className="mb-1.5 mt-4 block text-xs font-bold text-slate-500">
            मैसेज
          </label>

          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="नोटिफिकेशन का मैसेज लिखें..."
            rows={3}
            maxLength={240}
            className="
              w-full
              resize-none
              rounded-2xl
              border
              border-slate-200
              bg-white
              px-4
              py-3
              text-sm
              font-medium
              text-slate-800
              outline-none
              transition
              placeholder:text-slate-300
              focus:border-emerald-400
              focus:ring-4
              focus:ring-emerald-500/10
            "
          />

          {/* RECIPIENT TYPE */}

          <label className="mb-1.5 mt-4 block text-xs font-bold text-slate-500">
            किसे भेजना है?
          </label>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setRecipientType("all")}
              className={`
                flex
                items-center
                justify-center
                gap-2
                rounded-2xl
                border
                px-4
                py-3
                text-sm
                font-bold
                transition
                ${
                  recipientType === "all"
                    ? "border-emerald-400 bg-emerald-50 text-emerald-700 ring-4 ring-emerald-500/10"
                    : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                }
              `}
            >
              <Users className="h-4 w-4" />
              सभी को
            </button>

            <button
              type="button"
              onClick={() => setRecipientType("custom")}
              className={`
                flex
                items-center
                justify-center
                gap-2
                rounded-2xl
                border
                px-4
                py-3
                text-sm
                font-bold
                transition
                ${
                  recipientType === "custom"
                    ? "border-emerald-400 bg-emerald-50 text-emerald-700 ring-4 ring-emerald-500/10"
                    : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                }
              `}
            >
              <UserRound className="h-4 w-4" />
              कस्टम चुनें
            </button>
          </div>

          {/* CUSTOM USER PICKER */}

          {recipientType === "custom" && (
            <div className="mt-4" ref={userDropdownRef}>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowUserDropdown((prev) => !prev)}
                  className="
                    flex
                    h-12
                    flex-1
                    items-center
                    gap-2
                    rounded-2xl
                    border
                    border-slate-200
                    bg-white
                    px-4
                    text-sm
                    font-semibold
                    text-slate-700
                    transition
                    hover:border-emerald-300
                  "
                >
                  <UserRound className="h-4 w-4 text-emerald-500" />

                  <span className="flex-1 truncate text-left">
                    {selectedUsers.length > 0
                      ? `${selectedUsers.length} उपयोगकर्ता चुने गए`
                      : "उपयोगकर्ता चुनें..."}
                  </span>

                  <ChevronDown
                    className={`
                      h-4
                      w-4
                      text-slate-400
                      transition-transform
                      ${showUserDropdown ? "rotate-180" : ""}
                    `}
                  />
                </button>
              </div>

              {showUserDropdown && (
                <div className="mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
                  {/* SEARCH */}

                  <div className="border-b border-slate-100 p-3">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="नाम या मोबाइल से खोजें..."
                      className="
                        h-10
                        w-full
                        rounded-xl
                        border
                        border-slate-200
                        bg-slate-50
                        px-3
                        text-sm
                        font-medium
                        text-slate-700
                        outline-none
                        transition
                        placeholder:text-slate-400
                        focus:border-emerald-400
                        focus:bg-white
                      "
                    />
                  </div>

                  {/* USER LIST */}

                  <div className="max-h-56 overflow-y-auto p-2">
                    {usersLoading ? (
                      <div className="flex justify-center py-6">
                        <Loader2 className="h-5 w-5 animate-spin text-emerald-500" />
                      </div>
                    ) : filteredUsers.length === 0 ? (
                      <p className="py-6 text-center text-sm text-slate-400">
                        कोई उपयोगकर्ता नहीं मिला
                      </p>
                    ) : (
                      filteredUsers.map((user) => {
                        const isSelected = selectedUsers.includes(user._id);
                        const name = getFullName(user) || "Unknown User";

                        return (
                          <label
                            key={user._id}
                            className={`
                              flex
                              cursor-pointer
                              items-center
                              gap-3
                              rounded-xl
                              px-3
                              py-2.5
                              transition
                              ${isSelected ? "bg-emerald-50" : "hover:bg-slate-50"}
                            `}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleUser(user._id)}
                              className="
                                h-4
                                w-4
                                accent-emerald-600
                              "
                            />

                            <div
                              className={`
                                flex
                                h-8
                                w-8
                                shrink-0
                                items-center
                                justify-center
                                rounded-full
                                text-xs
                                font-black
                                ${
                                  isSelected
                                    ? "bg-emerald-100 text-emerald-700"
                                    : "bg-slate-100 text-slate-600"
                                }
                              `}
                            >
                              {name.charAt(0).toUpperCase()}
                            </div>

                            <div className="min-w-0 flex-1">
                              <p
                                className={`
                                  truncate
                                  text-sm
                                  font-bold
                                  ${
                                    isSelected
                                      ? "text-emerald-800"
                                      : "text-slate-800"
                                  }
                                `}
                              >
                                {name}
                              </p>

                              <p className="text-xs font-medium text-slate-400">
                                {user.phoneNumber || "कोई नंबर नहीं"}
                              </p>
                            </div>

                            {isSelected && (
                              <Check className="h-4 w-4 text-emerald-600" />
                            )}
                          </label>
                        );
                      })
                    )}
                  </div>

                  {/* SELECTED COUNT */}

                  {selectedUsers.length > 0 && (
                    <div className="border-t border-slate-100 bg-slate-50 px-4 py-2.5 text-xs font-bold text-emerald-700">
                      {selectedUsers.length} उपयोगकर्ता चुने गए
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* SCHEDULE TIME */}

          <label className="mb-1.5 mt-4 block text-xs font-bold text-slate-500">
            शेड्यूल (समय पर भेजेगा)
          </label>

          <input
            type="datetime-local"
            value={scheduledAt}
            min={minDateTime}
            onChange={(e) => setScheduledAt(e.target.value)}
            disabled={editingId}
            className="
              h-12
              w-full
              rounded-2xl
              border
              border-slate-200
              bg-white
              px-4
              text-sm
              font-semibold
              text-slate-700
              outline-none
              transition
              focus:border-emerald-400
              focus:ring-4
              focus:ring-emerald-500/10
              disabled:cursor-not-allowed
              disabled:opacity-60
            "
          />

          {/* ACTIONS */}

          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            {!editingId && (
              <button
                type="button"
                onClick={() => handleSubmit(true)}
                disabled={sending}
                className="
                  flex
                  h-12
                  items-center
                  justify-center
                  gap-2
                  rounded-2xl
                  bg-emerald-500
                  px-5
                  text-xs
                  font-black
                  text-white
                  shadow-[0_8px_20px_rgba(16,185,129,0.25)]
                  transition
                  hover:bg-emerald-600
                  active:scale-[0.97]
                  disabled:cursor-not-allowed
                  disabled:opacity-50
                "
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    अभी भेजें
                  </>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={() => handleSubmit(false)}
              disabled={sending || Boolean(editingId)}
              className="
                flex
                h-12
                items-center
                justify-center
                gap-2
                rounded-2xl
                bg-slate-900
                px-5
                text-xs
                font-black
                text-white
                transition
                hover:bg-slate-800
                active:scale-[0.97]
                disabled:cursor-not-allowed
                disabled:opacity-50
              "
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : editingId ? (
                <>
                  <Pencil className="h-4 w-4" />
                  अपडेट करें
                </>
              ) : (
                <>
                  <CalendarPlus className="h-4 w-4" />
                  शेड्यूल करें
                </>
              )}
            </button>

            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                disabled={sending}
                className="
                  flex
                  h-12
                  items-center
                  justify-center
                  rounded-2xl
                  border
                  border-slate-200
                  bg-white
                  px-5
                  text-xs
                  font-black
                  text-slate-600
                  transition
                  hover:bg-slate-50
                  active:scale-[0.97]
                "
              >
                रद्द करें
              </button>
            )}
          </div>
        </div>
      )}

      {/* =====================================================
          SCHEDULED NOTIFICATIONS LIST
      ====================================================== */}

      <div className="px-5 py-5 sm:px-7">
        <div className="mb-3 flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-emerald-600" />
          <h3 className="text-sm font-black uppercase tracking-wide text-slate-700">
            शेड्यूल्ड नोटिफिकेशन
          </h3>

          {notifications.length > 0 && (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-700">
              {notifications.length}
            </span>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-7 w-7 animate-spin text-emerald-500" />
          </div>
        ) : notifications.length === 0 ? (
          /* EMPTY STATE */

          <div
            className="
              flex
              min-h-[180px]
              flex-col
              items-center
              justify-center
              rounded-3xl
              border
              border-dashed
              border-slate-300
              bg-slate-50
              px-6
              text-center
            "
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm">
              <Bell className="h-6 w-6 text-emerald-400" />
            </div>

            <p className="mt-4 text-sm font-bold text-slate-600">
              कोई शेड्यूल्ड नोटिफिकेशन नहीं
            </p>

            <p className="mt-1 max-w-xs text-xs text-slate-400">
              "नया भेजें" बटन पर क्लिक करके पहला नोटिफिकेशन शेड्यूल करें।
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {notifications.map((notif, index) => {
              const isPending = notif.status === "pending";
              const canEdit =
                isPending && new Date(notif.scheduledAt) > new Date();

              const recipientLabel =
                notif.recipientType === "all"
                  ? "सभी उपयोगकर्ता"
                  : `${(notif.recipientUsers || []).length} उपयोगकर्ता`;

              return (
                <div
                  key={notif._id}
                  className="
                    rounded-2xl
                    border
                    border-slate-200
                    bg-white
                    p-4
                    shadow-sm
                    transition
                    hover:border-emerald-200
                    sm:p-5
                  "
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`
                            flex
                            h-8
                            w-8
                            items-center
                            justify-center
                            rounded-lg
                            text-white
                            ${
                              index % 3 === 0
                                ? "bg-emerald-500"
                                : index % 3 === 1
                                  ? "bg-indigo-500"
                                  : "bg-orange-500"
                            }
                          `}
                        >
                          <BellRing className="h-4 w-4" />
                        </span>

                        <h4 className="truncate text-sm font-black text-slate-900">
                          {notif.title}
                        </h4>

                        <span
                          className={`
                            rounded-full
                            px-2
                            py-0.5
                            text-[10px]
                            font-black
                            ${
                              isPending
                                ? "bg-amber-100 text-amber-700"
                                : "bg-red-100 text-red-600"
                            }
                          `}
                        >
                          {isPending ? "पेंडिंग" : notif.status}
                        </span>
                      </div>

                      <p className="mt-2 text-xs font-medium leading-5 text-slate-500">
                        {notif.message}
                      </p>
                    </div>
                  </div>

                  {/* META */}

                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                    <span className="flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">
                      <Users className="h-3 w-3" />
                      {recipientLabel}
                    </span>

                    <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">
                      <Clock className="h-3 w-3" />
                      {formatScheduleTime(notif.scheduledAt)}
                    </span>

                    <span
                      className={`
                        ml-auto
                        flex
                        items-center
                        gap-1
                        rounded-xl
                        px-2.5
                        py-1
                        text-[10px]
                        font-black
                        ${
                          canEdit
                            ? "bg-emerald-600 text-white"
                            : "bg-slate-100 text-slate-400"
                        }
                      `}
                    >
                      <CalendarClock className="h-3 w-3" />
                      {canEdit ? "एडिट हो सकता है" : "एडिट खत्म"}
                    </span>
                  </div>

                  {/* ACTIONS */}

                  {canEdit && (
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleEdit(notif)}
                        className="
                          flex
                          items-center
                          gap-1.5
                          rounded-xl
                          bg-slate-100
                          px-3
                          py-2
                          text-xs
                          font-bold
                          text-slate-700
                          transition
                          hover:bg-slate-200
                          active:scale-[0.97]
                        "
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        एडिट करें
                      </button>

                      <button
                        type="button"
                        onClick={() => handleCancel(notif._id)}
                        className="
                          flex
                          items-center
                          gap-1.5
                          rounded-xl
                          bg-red-50
                          px-3
                          py-2
                          text-xs
                          font-bold
                          text-red-600
                          transition
                          hover:bg-red-100
                          active:scale-[0.97]
                        "
                      >
                        <Ban className="h-3.5 w-3.5" />
                        रद्द करें
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};

export default AdminNotificationPanel;