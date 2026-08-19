import axios from "axios";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { API_BASE_URL } from "@/lib/constants";
import {
  Search,
  X,
  Users,
  Phone,
  MapPin,
  House,
  CircleUser,
  Check,
  ChevronLeft,
  Mic,
  MicOff,
  ArrowRight,
  ShieldCheck,
  UserRound,
} from "lucide-react";

const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [isListening, setIsListening] = useState(false);

  const recognitionRef = useRef(null);

  const navigate = useNavigate();

  // =========================================================
  // FETCH USERS
  // =========================================================

  useEffect(() => {
    const fetchUsers = async () => {
      const token = localStorage.getItem("token");

      if (!token) {
        toast.error("कृपया पहले लॉगिन करें");
        return;
      }

      try {
        setLoading(true);

        const res = await axios.get(`${API_BASE_URL}/api/v1/user/all-user`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (res.data.success) {
          setUsers(res.data.users || []);
        }
      } catch (error) {
        console.error("Fetch users error:", error);

        toast.error(
          error.response?.data?.message ||
            "उपयोगकर्ताओं को लोड करने में समस्या हुई।",
        );
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  // =========================================================
  // VOICE SEARCH
  // =========================================================

  const startVoiceSearch = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      toast.error("आपके ब्राउज़र में Voice Search उपलब्ध नहीं है");
      return;
    }

    const recognition = new SpeechRecognition();

    recognition.lang = "hi-IN";
    recognition.continuous = false;
    recognition.interimResults = true;

    recognitionRef.current = recognition;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event) => {
      let transcript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }

      setSearch(transcript);
    };

    recognition.onerror = (event) => {
      console.error("Voice search error:", event.error);

      if (event.error === "not-allowed") {
        toast.error("माइक्रोफोन की अनुमति दें");
      } else if (event.error !== "aborted") {
        toast.error("Voice Search काम नहीं कर पाई");
      }

      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  // Stop recognition when component unmounts
  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  // =========================================================
  // SEARCH
  // =========================================================

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return users;
    }

    return users.filter((user) => {
      const searchableText = [
        user.firstName,
        user.lastName,
        user.phoneNumber,
        user.place,
        user.address,
        user.zipCode,
        user.gender,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(query);
    });
  }, [users, search]);

  // =========================================================
  // CLEAR SEARCH
  // =========================================================

  const clearSearch = () => {
    setSearch("");
  };

  // =========================================================
  // USER INITIAL
  // =========================================================

  const getInitial = (user) => {
    return (
      user?.firstName?.charAt(0)?.toUpperCase() ||
      user?.lastName?.charAt(0)?.toUpperCase() ||
      "U"
    );
  };

  // =========================================================
  // USER NAME
  // =========================================================

  const getFullName = (user) => {
    return [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim();
  };

  // =========================================================
  // LOADING SKELETON
  // =========================================================

  const LoadingCard = () => {
    return (
      <div className="animate-pulse rounded-3xl border border-gray-200 bg-white p-4">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 shrink-0 rounded-full bg-gray-200" />

          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-5 w-40 rounded-lg bg-gray-200" />
            <div className="h-4 w-32 rounded-lg bg-gray-100" />
            <div className="h-4 w-48 rounded-lg bg-gray-100" />
          </div>

          <div className="hidden h-10 w-20 rounded-xl bg-gray-200 sm:block" />
        </div>

        <div className="mt-4 flex gap-2">
          <div className="h-8 w-28 rounded-full bg-gray-100" />
          <div className="h-8 w-24 rounded-full bg-gray-100" />
          <div className="h-8 w-20 rounded-full bg-gray-100" />
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-white px-2 py-18 sm:px-4 lg:px-6">
      <div className="mx-auto w-full max-w-7xl rounded-3xl border border-emerald-100 bg-white p-3 shadow-lg sm:p-4 lg:p-5">
        {/* =====================================================
            TOP NAVIGATION
            KEPT SAME
        ====================================================== */}

        <div
          onClick={() => navigate("/admin-dashboard")}
          className="px-2 py-2 w-[80px] flex mb-3 border-t-1 border-r-1 rounded-full border-emerald-400 items-center gap-2 cursor-pointer"
        >
          <ChevronLeft className="h-4 w-4" />
          पीछे
        </div>

        {/* =====================================================
            HEADER
        ====================================================== */}

        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-700 via-emerald-600 to-emerald-500 text-white shadow-xl">
          {/* Decorative circles */}

          <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-white/10" />

          <div className="pointer-events-none absolute -bottom-24 left-1/3 h-48 w-48 rounded-full bg-white/5" />

          <div className="relative px-5 py-6 sm:px-7 sm:py-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
                    <Users size={23} />
                  </div>

                  <div>
                    <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
                      खरीदार
                    </h1>

                    <p className="text-sm font-medium text-emerald-100">
                      सभी खरीदारों को मैनेज करें
                    </p>
                  </div>
                </div>
              </div>

              <div className="shrink-0 rounded-2xl bg-white/15 px-4 py-2 text-center backdrop-blur">
                <p className="text-2xl font-black leading-none">
                  {users.length}
                </p>

                <p className="mt-1 text-[11px] font-semibold text-emerald-100">
                  कुल खरीदार
                </p>
              </div>
            </div>
          </div>

          {/* Bottom stats */}

          <div className="relative grid grid-cols-2 border-t border-white/15">
            <div className="px-5 py-3 sm:px-7">
              <p className="text-[11px] font-medium text-emerald-100">
                अभी दिख रहे हैं
              </p>

              <p className="mt-0.5 text-xl font-black">
                {filteredUsers.length}
              </p>
            </div>

            <div className="border-l border-white/15 px-5 py-3 sm:px-7">
              <p className="text-[11px] font-medium text-emerald-100">
                Verified
              </p>

              <p className="mt-0.5 text-xl font-black">
                {users.filter((user) => user.isVerified).length}
              </p>
            </div>
          </div>
        </div>

        {/* =====================================================
            SEARCH BAR
        ====================================================== */}

        <div className="sticky top-0 z-30 mt-5 bg-white/95 py-1 backdrop-blur-md">
          <div className="rounded-2xl border border-gray-200 bg-white p-2 shadow-sm">
            <div className="relative">
              {/* Search icon */}

              <Search
                size={19}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
              />

              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="नाम, मोबाइल, जगह या पता खोजें..."
                className="
                  h-12
                  w-full
                  rounded-xl
                  border
                  border-gray-200
                  bg-gray-50
                  pl-11
                  pr-24
                  text-[15px]
                  font-medium
                  text-gray-800
                  outline-none
                  transition
                  placeholder:text-gray-400
                  focus:border-emerald-400
                  focus:bg-white
                  focus:ring-4
                  focus:ring-emerald-50
                "
              />

              {/* Search controls */}

              <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
                {search && (
                  <button
                    type="button"
                    onClick={clearSearch}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
                    title="सर्च हटाएं"
                  >
                    <X size={17} />
                  </button>
                )}

                <button
                  type="button"
                  onClick={startVoiceSearch}
                  className={`flex h-9 w-9 items-center justify-center rounded-lg transition ${
                    isListening
                      ? "bg-red-100 text-red-600"
                      : "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                  }`}
                  title={isListening ? "Voice Search बंद करें" : "Voice Search"}
                >
                  {isListening ? <MicOff size={18} /> : <Mic size={18} />}
                </button>
              </div>
            </div>

            {/* Listening indicator */}

            {isListening && (
              <div className="mt-2 flex items-center gap-2 px-2 text-xs font-semibold text-red-600">
                <span className="flex h-2 w-2 animate-pulse rounded-full bg-red-500" />
                सुन रहा हूँ... नाम या मोबाइल बोलें
              </div>
            )}

            {/* Search result */}

            {search.trim() && !isListening && (
              <div className="mt-2 flex items-center justify-between px-2">
                <p className="text-xs font-medium text-gray-500">
                  <span className="font-bold text-gray-800">
                    {filteredUsers.length}
                  </span>{" "}
                  खरीदार मिले
                </p>

                <button
                  type="button"
                  onClick={clearSearch}
                  className="text-xs font-bold text-emerald-600 hover:text-emerald-700"
                >
                  सर्च हटाएं
                </button>
              </div>
            )}
          </div>
        </div>

        {/* =====================================================
            USERS
        ====================================================== */}

        {loading ? (
          <div className="mt-5 grid gap-3">
            <LoadingCard />
            <LoadingCard />
            <LoadingCard />
          </div>
        ) : filteredUsers.length === 0 ? (
          /* ===================================================
             EMPTY STATE
          ==================================================== */

          <div className="mt-5 flex min-h-[320px] flex-col items-center justify-center rounded-3xl border border-dashed border-gray-300 bg-gray-50 px-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm">
              <Search size={27} className="text-gray-400" />
            </div>

            <h2 className="mt-5 text-lg font-bold text-gray-800">
              {search.trim()
                ? "कोई खरीदार नहीं मिला"
                : "कोई खरीदार उपलब्ध नहीं है"}
            </h2>

            <p className="mt-1 max-w-sm text-sm text-gray-400">
              {search.trim()
                ? "नाम, मोबाइल नंबर, जगह या पता बदलकर फिर से खोजें।"
                : "अभी तक कोई खरीदार उपलब्ध नहीं है।"}
            </p>

            {search.trim() && (
              <button
                type="button"
                onClick={clearSearch}
                className="mt-5 rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800"
              >
                सभी खरीदार देखें
              </button>
            )}
          </div>
        ) : (
          <div className="mt-5 grid gap-3">
            {filteredUsers.map((user) => {
              const fullName = getFullName(user);

              return (
                <div
                  key={user._id}
                  onClick={() => navigate(`/admin/user/${user._id}`)}
                  className="
                    group
                    cursor-pointer
                    rounded-3xl
                    border
                    border-gray-200
                    bg-white
                    p-4
                    shadow-sm
                    transition-all
                    hover:-translate-y-[1px]
                    hover:border-emerald-300
                    hover:shadow-lg
                    active:scale-[0.995]
                    sm:p-5
                  "
                >
                  {/* =================================================
                      MAIN USER ROW
                  ================================================== */}

                  <div className="flex items-center gap-3 sm:gap-4">
                    {/* PROFILE */}

                    <div className="relative shrink-0">
                      {user.profilePic ? (
                        <img
                          src={user.profilePic}
                          alt={fullName || "User"}
                          className="
                            h-16
                            w-16
                            rounded-2xl
                            border
                            border-emerald-100
                            bg-gray-50
                            object-cover
                            sm:h-[72px]
                            sm:w-[72px]
                          "
                        />
                      ) : (
                        <div
                          className="
                            flex
                            h-16
                            w-16
                            items-center
                            justify-center
                            rounded-2xl
                            bg-emerald-50
                            text-2xl
                            font-black
                            text-emerald-700
                            sm:h-[72px]
                            sm:w-[72px]
                          "
                        >
                          {getInitial(user)}
                        </div>
                      )}

                      {/* Verified badge */}

                      {user.isVerified && (
                        <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-emerald-500 text-white shadow-sm">
                          <Check size={13} strokeWidth={3} />
                        </div>
                      )}
                    </div>

                    {/* USER INFO */}

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate text-base font-black text-gray-900 sm:text-lg">
                          {fullName || "Unknown User"}
                        </h2>

                        {user.isVerified && (
                          <span className="hidden items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 sm:flex">
                            <ShieldCheck size={12} />
                            Verified
                          </span>
                        )}
                      </div>

                      {/* Phone */}

                      <div className="mt-1.5 flex items-center gap-1.5 text-sm text-gray-500">
                        <Phone
                          size={15}
                          className="shrink-0 text-emerald-500"
                        />

                        <span className="truncate font-medium">
                          {user.phoneNumber || "मोबाइल उपलब्ध नहीं"}
                        </span>
                      </div>

                      {/* Place */}

                      <div className="mt-1 flex items-center gap-1.5 text-sm text-gray-500">
                        <MapPin size={15} className="shrink-0 text-blue-500" />

                        <span className="truncate">
                          {user.place || "स्थान उपलब्ध नहीं"}
                        </span>
                      </div>
                    </div>

                    {/* DESKTOP OPEN */}

                    <div className="hidden shrink-0 items-center gap-2 sm:flex">
                      <div
                        className="
                          flex
                          h-10
                          items-center
                          gap-1.5
                          rounded-xl
                          bg-emerald-50
                          px-4
                          text-sm
                          font-bold
                          text-emerald-700
                          transition
                          group-hover:bg-emerald-600
                          group-hover:text-white
                        "
                      >
                        खोलें
                        <ArrowRight size={16} />
                      </div>
                    </div>
                  </div>

                  {/* =================================================
                      USER DETAILS
                  ================================================== */}

                  <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-100 pt-3">
                    {/* Address */}

                    {user.address && (
                      <span className="flex max-w-full items-center gap-1.5 rounded-xl bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">
                        <House size={14} className="shrink-0" />

                        <span className="max-w-[260px] truncate">
                          {user.address}
                        </span>
                      </span>
                    )}

                    {/* ZIP */}

                    {user.zipCode && (
                      <span className="flex items-center gap-1.5 rounded-xl bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-700">
                        <MapPin size={14} />
                        {user.zipCode}
                      </span>
                    )}

                    {/* Gender */}

                    {user.gender && (
                      <span className="flex items-center gap-1.5 rounded-xl bg-purple-50 px-3 py-1.5 text-xs font-semibold capitalize text-purple-700">
                        <CircleUser size={14} />
                        {user.gender}
                      </span>
                    )}

                    {/* Verification */}

                    <span
                      className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold ${
                        user.isVerified
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-red-50 text-red-600"
                      }`}
                    >
                      {user.isVerified ? (
                        <>
                          <Check size={14} />
                          Verified
                        </>
                      ) : (
                        <>
                          <X size={14} />
                          Not Verified
                        </>
                      )}
                    </span>

                    {/* Mobile open */}

                    <span className="ml-auto flex items-center gap-1.5 rounded-xl bg-gray-100 px-3 py-1.5 text-xs font-bold text-gray-700 transition group-hover:bg-emerald-50 group-hover:text-emerald-700 sm:hidden">
                      खोलें
                      <ArrowRight size={14} />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* =====================================================
            FOOTER RESULT COUNT
        ====================================================== */}

        {!loading && filteredUsers.length > 0 && (
          <div className="mt-5 flex items-center justify-center gap-2 text-xs font-medium text-gray-400">
            <UserRound size={14} />

            {search.trim()
              ? `${filteredUsers.length} में से ${users.length} खरीदार`
              : `${users.length} खरीदार`}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminUsers;
