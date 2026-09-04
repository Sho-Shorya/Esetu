import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";
import { toast } from "sonner";
import { API_BASE_URL } from "@/lib/constants";
import {
  Search,
  X,
  Plus,
  Loader2,
  ChevronLeft,
  Building2,
  Pencil,
  Trash2,
  Check,
  Package,
  Image,
} from "lucide-react";

const AdminCompanyPage = () => {
  const [companies, setCompanies] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formName, setFormName] = useState("");
  const [formCategories, setFormCategories] = useState([]);
  const [formLogo, setFormLogo] = useState(null);
  const [formLogoPreview, setFormLogoPreview] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const token = localStorage.getItem("token");

  /* =========================================================
     FETCH
  ========================================================= */

  const fetchCompanies = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE_URL}/api/v1/company/get-com`);
      if (res.data.success) setCompanies(res.data.companies || []);
    } catch (e) {
      toast.error("कंपनियाँ लोड नहीं हो सकीं।");
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    if (!token) return;
    try {
      const res = await axios.get(`${API_BASE_URL}/api/v1/category/get-cat`);
      if (res.data.success) setCategories(res.data.categories || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchCompanies();
    fetchCategories();
  }, []);

  /* =========================================================
     SEARCH
  ========================================================= */

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return companies;
    return companies.filter((c) => c.name.toLowerCase().includes(q));
  }, [companies, search]);

  /* =========================================================
     RESET FORM
  ========================================================= */

  const resetForm = () => {
    setFormName("");
    setFormCategories([]);
    setFormLogo(null);
    setFormLogoPreview("");
    setEditingId(null);
    setShowForm(false);
  };

  /* =========================================================
     EDIT
  ========================================================= */

  const startEdit = (company) => {
    setEditingId(company._id);
    setFormName(company.name);
    setFormCategories(
      (company.categories || []).map((c) => (typeof c === "string" ? c : c._id)),
    );
    setFormLogo(null);
    setFormLogoPreview(company.logo || "");
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  /* =========================================================
     SUBMIT
  ========================================================= */

  const handleSubmit = async () => {
    if (!formName.trim()) {
      toast.error("कंपनी का नाम आवश्यक है।");
      return;
    }
    if (formCategories.length === 0) {
      toast.error("कम से कम एक कैटेगरी चुनें।");
      return;
    }

    try {
      setSubmitting(true);

      const formData = new FormData();
      formData.append("name", formName.trim());
      formData.append("categories", JSON.stringify(formCategories));
      if (formLogo) formData.append("logo", formLogo);

      const url = editingId
        ? `${API_BASE_URL}/api/v1/company/update-com/${editingId}`
        : `${API_BASE_URL}/api/v1/company/add-com`;

      const method = editingId ? "put" : "post";

      const res = await axios[method](url, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });

      if (res.data.success) {
        toast.success(editingId ? "कंपनी अपडेट हो गई।" : "कंपनी जोड़ दी गई।");
        resetForm();
        fetchCompanies();
      }
    } catch (e) {
      toast.error(e.response?.data?.message || "कुछ गलत हो गया।");
    } finally {
      setSubmitting(false);
    }
  };

  /* =========================================================
     DELETE
  ========================================================= */

  const handleDelete = async (id) => {
    if (!window.confirm("क्या आप यह कंपनी हटाना चाहते हैं?")) return;

    try {
      setDeletingId(id);
      const res = await axios.delete(
        `${API_BASE_URL}/api/v1/company/delete-com/${id}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (res.data.success) {
        toast.success("कंपनी हटा दी गई।");
        fetchCompanies();
      }
    } catch (e) {
      toast.error(e.response?.data?.message || "हटाने में त्रुटि।");
    } finally {
      setDeletingId(null);
    }
  };

  /* =========================================================
     TOGGLE CATEGORY
  ========================================================= */

  const toggleCategory = (catId) => {
    setFormCategories((prev) =>
      prev.includes(catId) ? prev.filter((id) => id !== catId) : [...prev, catId],
    );
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

        <section
          className="
            relative
            overflow-hidden
            rounded-[28px]
            bg-gradient-to-br
            from-emerald-700
            via-emerald-600
            to-emerald-500
            text-white
            shadow-xl
          "
        >
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/10" />

          <div className="relative flex items-center justify-between px-5 py-5 sm:px-7 sm:py-6">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
                  कंपनियाँ
                </h1>
                <p className="text-xs font-medium text-emerald-100">
                  कंपनियाँ मैनेज करें
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-white/15 px-3 py-2 text-center backdrop-blur">
                <p className="text-xl font-black leading-none">
                  {companies.length}
                </p>
                <p className="mt-1 text-[10px] font-semibold text-emerald-100">
                  कुल
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (editingId) resetForm();
                  setShowForm((prev) => !prev);
                }}
                className="flex h-10 items-center gap-1.5 rounded-2xl bg-white px-4 text-xs font-black text-emerald-700 shadow-sm transition hover:bg-emerald-50 active:scale-[0.97]"
              >
                {showForm ? (
                  <>
                    <X className="h-4 w-4" />
                    बंद
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    नई
                  </>
                )}
              </button>
            </div>
          </div>
        </section>

        {/* =====================================================
            FORM
        ====================================================== */}

        {showForm && (
          <section className="mt-3 overflow-hidden rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-4 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                {editingId ? (
                  <Pencil className="h-4 w-4" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
              </span>
              <h3 className="text-sm font-black text-slate-900">
                {editingId ? "कंपनी एडिट करें" : "नई कंपनी जोड़ें"}
              </h3>
            </div>

            {/* NAME */}

            <label className="mb-1 block text-[11px] font-bold text-slate-500">
              कंपनी का नाम
            </label>

            <input
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="जैसे: Nestle, Parle..."
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
            />

            {/* LOGO */}

            <label className="mb-1 mt-3 block text-[11px] font-bold text-slate-500">
              लोगो
            </label>

            <div className="flex items-center gap-3">
              <label className="flex h-11 cursor-pointer items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 text-xs font-bold text-slate-500 transition hover:border-emerald-400 hover:bg-emerald-50">
                <Image className="h-4 w-4" />
                {formLogo ? formLogo.name : "लोगो चुनें"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setFormLogo(file);
                      setFormLogoPreview(URL.createObjectURL(file));
                    }
                  }}
                />
              </label>

              {formLogoPreview && (
                <img
                  src={formLogoPreview}
                  alt="Logo"
                  className="h-10 w-10 rounded-lg border border-slate-200 bg-white object-contain"
                />
              )}
            </div>

            {/* CATEGORIES */}

            <label className="mb-1 mt-3 block text-[11px] font-bold text-slate-500">
              कैटेगरी चुनें
            </label>

            <div className="flex flex-wrap gap-1.5">
              {categories.map((cat) => {
                const selected = formCategories.includes(cat._id);
                return (
                  <button
                    key={cat._id}
                    type="button"
                    onClick={() => toggleCategory(cat._id)}
                    className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition ${
                      selected
                        ? "bg-emerald-500 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {selected && <Check className="h-3 w-3" />}
                    {cat.name}
                  </button>
                );
              })}
            </div>

            {/* ACTIONS */}

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="flex h-10 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 text-xs font-black text-white transition hover:bg-emerald-700 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : editingId ? (
                  "अपडेट करें"
                ) : (
                  "जोड़ें"
                )}
              </button>

              <button
                type="button"
                onClick={resetForm}
                disabled={submitting}
                className="flex h-10 items-center rounded-xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-600 transition hover:bg-slate-50"
              >
                रद्द
              </button>
            </div>
          </section>
        )}

        {/* =====================================================
            SEARCH
        ====================================================== */}

        <div className="mt-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="कंपनी खोजें..."
              className="h-11 w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-10 text-sm font-medium text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10"
            />

            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {search.trim() && (
            <p className="mt-1.5 px-1 text-[11px] font-bold text-slate-400">
              {filtered.length} में से {companies.length} कंपनियाँ
            </p>
          )}
        </div>

        {/* =====================================================
            LIST
        ====================================================== */}

        {loading ? (
          <div className="mt-6 flex justify-center">
            <Loader2 className="h-7 w-7 animate-spin text-emerald-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="mt-6 flex min-h-[200px] flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-slate-50">
            <Building2 className="h-10 w-10 text-slate-300" />
            <p className="mt-3 text-sm font-bold text-slate-500">
              {search.trim() ? "कोई कंपनी नहीं मिली" : "कोई कंपनी नहीं है"}
            </p>
          </div>
        ) : (
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((company) => {
              const catNames = (company.categories || [])
                .map((c) => (typeof c === "string" ? c : c.name))
                .filter(Boolean);

              return (
                <div
                  key={company._id}
                  className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md sm:p-4"
                >
                  <div className="flex items-start gap-3">
                    {/* LOGO */}

                    {company.logo ? (
                      <img
                        src={company.logo}
                        alt={company.name}
                        className="h-12 w-12 shrink-0 rounded-xl border border-slate-100 bg-slate-50 object-contain"
                      />
                    ) : (
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-lg font-black text-emerald-600">
                        {company.name.charAt(0).toUpperCase()}
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-sm font-black text-slate-900">
                        {company.name}
                      </h3>

                      <div className="mt-1 flex flex-wrap gap-1">
                        {catNames.length > 0 ? (
                          catNames.slice(0, 3).map((name, i) => (
                            <span
                              key={i}
                              className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600"
                            >
                              {name}
                            </span>
                          ))
                        ) : (
                          <span className="text-[10px] font-bold text-slate-400">
                            कोई कैटेगरी नहीं
                          </span>
                        )}
                        {catNames.length > 3 && (
                          <span className="text-[10px] font-bold text-slate-400">
                            +{catNames.length - 3}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* STATUS */}

                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black ${
                        company.active
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-red-100 text-red-600"
                      }`}
                    >
                      {company.active ? "Active" : "Off"}
                    </span>
                  </div>

                  {/* ACTIONS */}

                  <div className="mt-3 flex gap-1.5 border-t border-slate-100 pt-2.5">
                    <button
                      type="button"
                      onClick={() => startEdit(company)}
                      className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-slate-100 py-2 text-[11px] font-bold text-slate-700 transition hover:bg-slate-200 active:scale-[0.97]"
                    >
                      <Pencil className="h-3 w-3" />
                      एडिट
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDelete(company._id)}
                      disabled={deletingId === company._id}
                      className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-red-50 py-2 text-[11px] font-bold text-red-600 transition hover:bg-red-100 active:scale-[0.97] disabled:opacity-50"
                    >
                      {deletingId === company._id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Trash2 className="h-3 w-3" />
                      )}
                      हटाएँ
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminCompanyPage;
