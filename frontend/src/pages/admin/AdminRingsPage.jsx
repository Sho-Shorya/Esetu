import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";
import { toast } from "sonner";
import { API_BASE_URL } from "@/lib/constants";
import {
  Phone,
  Loader2,
  ChevronLeft,
  Send,
  Sun,
  Moon,
  Users,
  UserRound,
  Clock,
  ChevronRight,
  Check,
  X,
  PhoneCall,
} from "lucide-react";

const AdminRingsPage = () => {
  const [tab, setTab] = useState("send");

  const [allUsers, setAllUsers] = useState([]);
  const [morningUsers, setMorningUsers] = useState([]);
  const [eveningUsers, setEveningUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  const [target, setTarget] = useState("all");
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [ringMessage, setRingMessage] = useState("अभी ऑर्डर करें!");
  const [sending, setSending] = useState(false);
  const [sentCount, setSentCount] = useState(0);

  const [history, setHistory] = useState([]);

  const [searchQuery, setSearchQuery] = useState("");

  const token = localStorage.getItem("token");

  /* =========================================================
     FETCH
  ========================================================= */

  const fetchAll = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const [usersRes, shiftsRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/v1/ring/users`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${API_BASE_URL}/api/v1/ring/shifts`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (usersRes.data.success) setAllUsers(usersRes.data.users || []);
      if (shiftsRes.data.success) {
        setMorningUsers(shiftsRes.data.morning || []);
        setEveningUsers(shiftsRes.data.evening || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    if (!token) return;
    try {
      const res = await axios.get(`${API_BASE_URL}/api/v1/ring/history`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data.success) setHistory(res.data.rings || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchAll();
    fetchHistory();
  }, []);

  /* =========================================================
     USERS NOT IN ANY SHIFT
  ========================================================= */

  const unassignedUsers = useMemo(() => {
    const assignedIds = new Set([
      ...morningUsers.map((u) => u._id),
      ...eveningUsers.map((u) => u._id),
    ]);
    return allUsers.filter((u) => !assignedIds.has(u._id));
  }, [allUsers, morningUsers, eveningUsers]);

  /* =========================================================
     SEARCH
  ========================================================= */

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return unassignedUsers;
    return unassignedUsers.filter(
      (u) =>
        u.firstName?.toLowerCase().includes(q) ||
        u.lastName?.toLowerCase().includes(q) ||
        String(u.phoneNumber).includes(q),
    );
  }, [unassignedUsers, searchQuery]);

  /* =========================================================
     SHIFT MANAGEMENT
  ========================================================= */

  const moveToMorning = (userId) => {
    setEveningUsers((prev) => prev.filter((u) => u._id !== userId));
    const user = allUsers.find((u) => u._id === userId);
    if (user) setMorningUsers((prev) => [...prev, user]);
  };

  const moveToEvening = (userId) => {
    setMorningUsers((prev) => prev.filter((u) => u._id !== userId));
    const user = allUsers.find((u) => u._id === userId);
    if (user) setEveningUsers((prev) => [...prev, user]);
  };

  const removeFromShift = (userId) => {
    setMorningUsers((prev) => prev.filter((u) => u._id !== userId));
    setEveningUsers((prev) => prev.filter((u) => u._id !== userId));
  };

  const saveShifts = async () => {
    try {
      const res = await axios.post(
        `${API_BASE_URL}/api/v1/ring/shifts`,
        {
          morning: morningUsers.map((u) => u._id),
          evening: eveningUsers.map((u) => u._id),
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (res.data.success) toast.success("शिफ्ट सेव हो गई।");
    } catch (e) {
      toast.error("शिफ्ट सेव नहीं हो सकी।");
    }
  };

  /* =========================================================
     SEND RING
  ========================================================= */

  const handleSendRing = async () => {
    if (target === "custom" && selectedUsers.length === 0) {
      toast.error("कम से कम एक उपयोगकर्ता चुनें।");
      return;
    }

    try {
      setSending(true);
      const res = await axios.post(
        `${API_BASE_URL}/api/v1/ring/send`,
        {
          recipientType: target,
          recipientUsers: selectedUsers,
          message: ringMessage.trim() || "अभी ऑर्डर करें!",
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );

      if (res.data.success) {
        setSentCount(res.data.sentTo || 0);
        toast.success(res.data.message);
        setSelectedUsers([]);
        fetchHistory();
        setTimeout(() => setSentCount(0), 3000);
      }
    } catch (e) {
      toast.error(e.response?.data?.message || "रिंग नहीं भेजी जा सकी।");
    } finally {
      setSending(false);
    }
  };

  const toggleSelectUser = (id) => {
    setSelectedUsers((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  /* =========================================================
     FORMAT
  ========================================================= */

  const formatTime = (dateStr) => {
    return new Date(dateStr).toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const shiftLabel = (type) => {
    const map = { all: "सभी", morning: "मॉर्निंग", evening: "इवनिंग", custom: "कस्टम" };
    return map[type] || type;
  };

  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <div className="min-h-screen bg-[#f5f7f6] pt-16">
      <main className="mx-auto max-w-5xl px-3 pb-32 pt-4 sm:px-5 sm:pt-6 lg:px-6">
        {/* BACK */}

        <div
          onClick={() => window.history.back()}
          className="mb-3 flex w-[80px] cursor-pointer items-center gap-1 rounded-full border border-emerald-300 px-3 py-2 text-xs font-bold text-emerald-700 transition hover:bg-emerald-50"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          पीछे
        </div>

        {/* =====================================================
            HEADER
        ====================================================== */}

        <section className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-rose-700 via-rose-600 to-orange-500 text-white shadow-xl">
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/10" />

          <div className="relative flex items-center justify-between px-5 py-5 sm:px-7 sm:py-6">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
                <PhoneCall className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
                  Order Ring
                </h1>
                <p className="text-xs font-medium text-rose-100">
                  यूज़र को ऑर्डर के लए अलर्ट करें
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* =====================================================
            TABS
        ====================================================== */}

        <div className="mt-3 flex gap-2">
          {[
            { id: "send", label: "रिंग भेजें", icon: Send },
            { id: "shifts", label: "शिफ्ट", icon: Clock },
            { id: "history", label: "हिस्ट्री", icon: Phone },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-2xl py-2.5 text-xs font-black transition ${
                tab === t.id
                  ? "bg-rose-600 text-white shadow-lg shadow-rose-500/25"
                  : "bg-white text-slate-600 border border-slate-200"
              }`}
            >
              <t.icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          ))}
        </div>

        {/* =====================================================
            SEND RING TAB
        ====================================================== */}

        {tab === "send" && (
          <div className="mt-3 space-y-3">
            {/* TARGET SELECT */}

            <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <h3 className="mb-3 text-sm font-black text-slate-900">
                किसे भेजना है?
              </h3>

              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: "all", label: "सभी को", icon: Users, color: "rose" },
                  { id: "morning", label: "मॉर्निंग", icon: Sun, color: "amber" },
                  { id: "evening", label: "इवनिंग", icon: Moon, color: "indigo" },
                  { id: "custom", label: "चुनें", icon: UserRound, color: "emerald" },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => {
                      setTarget(opt.id);
                      setSelectedUsers([]);
                    }}
                    className={`flex items-center justify-center gap-2 rounded-2xl border px-3 py-3 text-xs font-bold transition ${
                      target === opt.id
                        ? "border-rose-400 bg-rose-50 text-rose-700 ring-4 ring-rose-500/10"
                        : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                    }`}
                  >
                    <opt.icon className="h-4 w-4" />
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* SHIFT COUNTS */}

              <div className="mt-3 flex gap-2">
                <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-700">
                  <Sun className="h-3 w-3" />
                  मॉर्निंग: {morningUsers.length}
                </span>
                <span className="flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-[10px] font-bold text-indigo-700">
                  <Moon className="h-3 w-3" />
                  इवनिंग: {eveningUsers.length}
                </span>
                <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">
                  <Users className="h-3 w-3" />
                  कुल: {allUsers.length}
                </span>
              </div>

              {/* CUSTOM USER SELECT */}

              {target === "custom" && (
                <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="नाम या मोबाइल खोजें..."
                    className="mb-2 h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium outline-none focus:border-rose-400"
                  />

                  <div className="max-h-40 space-y-1 overflow-y-auto">
                    {allUsers.map((u) => {
                      const sel = selectedUsers.includes(u._id);
                      const name = [u.firstName, u.lastName].filter(Boolean).join(" ");
                      return (
                        <label
                          key={u._id}
                          className={`flex cursor-pointer items-center gap-2 rounded-xl px-2 py-1.5 text-xs transition ${sel ? "bg-rose-50" : "hover:bg-white"}`}
                        >
                          <input
                            type="checkbox"
                            checked={sel}
                            onChange={() => toggleSelectUser(u._id)}
                            className="accent-rose-600"
                          />
                          <span className="font-semibold text-slate-800">{name}</span>
                          <span className="ml-auto text-[10px] text-slate-400">{u.phoneNumber}</span>
                        </label>
                      );
                    })}
                  </div>

                  {selectedUsers.length > 0 && (
                    <p className="mt-2 text-center text-[10px] font-bold text-rose-600">
                      {selectedUsers.length} चुने गए
                    </p>
                  )}
                </div>
              )}
            </section>

            {/* MESSAGE + SEND */}

            <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <label className="mb-1 block text-[11px] font-bold text-slate-500">
                मैसेज
              </label>

              <input
                type="text"
                value={ringMessage}
                onChange={(e) => setRingMessage(e.target.value)}
                placeholder="अभी ऑर्डर करें!"
                maxLength={80}
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-rose-400 focus:bg-white focus:ring-4 focus:ring-rose-500/10"
              />

              <button
                type="button"
                onClick={handleSendRing}
                disabled={sending}
                className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-rose-600 to-orange-500 text-sm font-black text-white shadow-lg shadow-rose-500/30 transition hover:from-rose-700 hover:to-orange-600 active:scale-[0.97] disabled:opacity-50"
              >
                {sending ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <Phone className="h-5 w-5" />
                    रिंग भेजें
                  </>
                )}
              </button>

              {sentCount > 0 && (
                <p className="mt-2 text-center text-xs font-bold text-emerald-600">
                  {sentCount} उपयोगकर्ताओं को रिंग भेजी गई
                </p>
              )}
            </section>
          </div>
        )}

        {/* =====================================================
            SHIFTS TAB
        ====================================================== */}

        {tab === "shifts" && (
          <div className="mt-3 space-y-3">
            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-7 w-7 animate-spin text-rose-500" />
              </div>
            ) : (
              <>
                {/* MORNING */}

                <section className="rounded-[24px] border border-amber-200 bg-white p-4 shadow-sm">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="flex items-center gap-2 text-sm font-black text-amber-700">
                      <Sun className="h-4 w-4" />
                      मॉर्निंग शिफ्ट
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px]">
                        {morningUsers.length}
                      </span>
                    </h3>
                  </div>

                  {morningUsers.length === 0 ? (
                    <p className="py-3 text-center text-xs text-slate-400">
                      कोई उपयोगकर्ता नहीं
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {morningUsers.map((u) => (
                        <div
                          key={u._id}
                          className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2"
                        >
                          <span className="text-xs font-bold text-slate-800">
                            {[u.firstName, u.lastName].filter(Boolean).join(" ")}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {u.phoneNumber}
                          </span>
                          <div className="ml-auto flex gap-1">
                            <button
                              onClick={() => moveToEvening(u._id)}
                              className="rounded-lg bg-indigo-100 p-1 text-indigo-600 transition hover:bg-indigo-200"
                              title="इवनिंग में भेजें"
                            >
                              <Moon className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => removeFromShift(u._id)}
                              className="rounded-lg bg-red-100 p-1 text-red-500 transition hover:bg-red-200"
                              title="हटाएँ"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* EVENING */}

                <section className="rounded-[24px] border border-indigo-200 bg-white p-4 shadow-sm">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="flex items-center gap-2 text-sm font-black text-indigo-700">
                      <Moon className="h-4 w-4" />
                      इवनिंग शिफ्ट
                      <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px]">
                        {eveningUsers.length}
                      </span>
                    </h3>
                  </div>

                  {eveningUsers.length === 0 ? (
                    <p className="py-3 text-center text-xs text-slate-400">
                      कोई उपयोगकर्ता नहीं
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {eveningUsers.map((u) => (
                        <div
                          key={u._id}
                          className="flex items-center gap-2 rounded-xl bg-indigo-50 px-3 py-2"
                        >
                          <span className="text-xs font-bold text-slate-800">
                            {[u.firstName, u.lastName].filter(Boolean).join(" ")}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {u.phoneNumber}
                          </span>
                          <div className="ml-auto flex gap-1">
                            <button
                              onClick={() => moveToMorning(u._id)}
                              className="rounded-lg bg-amber-100 p-1 text-amber-600 transition hover:bg-amber-200"
                              title="मॉर्निंग में भेजें"
                            >
                              <Sun className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => removeFromShift(u._id)}
                              className="rounded-lg bg-red-100 p-1 text-red-500 transition hover:bg-red-200"
                              title="हटाएँ"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* UNASSIGNED */}

                {filteredUsers.length > 0 && (
                  <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                    <h3 className="mb-2 flex items-center gap-2 text-sm font-black text-slate-600">
                      <Users className="h-4 w-4" />
                      बिना शिफ्ट
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px]">
                        {filteredUsers.length}
                      </span>
                    </h3>

                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="खोजें..."
                      className="mb-2 h-9 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-medium outline-none focus:border-rose-400"
                    />

                    <div className="max-h-48 space-y-1 overflow-y-auto">
                      {filteredUsers.map((u) => (
                        <div
                          key={u._id}
                          className="flex items-center gap-2 rounded-xl px-2 py-1.5 transition hover:bg-slate-50"
                        >
                          <span className="text-xs font-bold text-slate-800">
                            {[u.firstName, u.lastName].filter(Boolean).join(" ")}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {u.phoneNumber}
                          </span>
                          <div className="ml-auto flex gap-1">
                            <button
                              onClick={() => moveToMorning(u._id)}
                              className="rounded-lg bg-amber-100 p-1 text-amber-600 transition hover:bg-amber-200"
                              title="मॉर्निंग"
                            >
                              <Sun className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => moveToEvening(u._id)}
                              className="rounded-lg bg-indigo-100 p-1 text-indigo-600 transition hover:bg-indigo-200"
                              title="इवनिंग"
                            >
                              <Moon className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* SAVE */}

                <button
                  type="button"
                  onClick={saveShifts}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-sm font-black text-white shadow-lg transition hover:bg-emerald-700 active:scale-[0.97]"
                >
                  <Check className="h-4 w-4" />
                  शिफ्ट सेव करें
                </button>
              </>
            )}
          </div>
        )}

        {/* =====================================================
            HISTORY TAB
        ====================================================== */}

        {tab === "history" && (
          <div className="mt-3">
            {history.length === 0 ? (
              <div className="flex min-h-[200px] flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white">
                <Phone className="h-10 w-10 text-slate-300" />
                <p className="mt-3 text-sm font-bold text-slate-500">
                  कोई रिंग हिस्ट्री नहीं
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {history.map((r) => (
                  <div
                    key={r._id}
                    className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
                      <Phone className="h-4 w-4" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold text-slate-900">
                        {r.message}
                      </p>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                          {shiftLabel(r.recipientType)}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {r.recipientCount} यूज़र
                        </span>
                      </div>
                    </div>

                    <span className="shrink-0 text-[10px] font-medium text-slate-400">
                      {formatTime(r.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminRingsPage;
