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
  Layers3,
  Pencil,
  Trash2,
  Package,
} from "lucide-react";

const AdminCategoryPage = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formName, setFormName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const [editProducts, setEditProducts] = useState([]);
  const [editProductsLoading, setEditProductsLoading] = useState(false);

  const token = localStorage.getItem("token");

  /* =========================================================
     FETCH
  ========================================================= */

  const fetchCategories = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE_URL}/api/v1/category/get-cat`);
      if (res.data.success) setCategories(res.data.categories || []);
    } catch (e) {
      toast.error("कैटेगरी लोड नहीं हो सकीं।");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  /* =========================================================
     SEARCH
  ========================================================= */

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter((c) => c.name.toLowerCase().includes(q));
  }, [categories, search]);

  /* =========================================================
     RESET FORM
  ========================================================= */

  const resetForm = () => {
    setFormName("");
    setEditingId(null);
    setEditProducts([]);
    setShowForm(false);
  };

  /* =========================================================
     EDIT — fetch products for this category
  ========================================================= */

  const startEdit = async (cat) => {
    setEditingId(cat._id);
    setFormName(cat.name);
    setEditProducts([]);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });

    try {
      setEditProductsLoading(true);
      const res = await axios.get(
        `${API_BASE_URL}/api/v1/category/get-cat/${cat._id}`,
      );
      if (res.data.success) {
        setEditProducts(res.data.products || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setEditProductsLoading(false);
    }
  };

  /* =========================================================
     SUBMIT
  ========================================================= */

  const handleSubmit = async () => {
    if (!formName.trim()) {
      toast.error("कैटेगरी का नाम आवश्यक है।");
      return;
    }

    try {
      setSubmitting(true);

      if (editingId) {
        const res = await axios.put(
          `${API_BASE_URL}/api/v1/category/update-cat/${editingId}`,
          { name: formName.trim() },
          { headers: { Authorization: `Bearer ${token}` } },
        );

        if (res.data.success) {
          toast.success("कैटेगरी अपडेट हो गई।");
          resetForm();
          fetchCategories();
        }
      } else {
        const res = await axios.post(
          `${API_BASE_URL}/api/v1/category/add-cat`,
          { name: formName.trim() },
          { headers: { Authorization: `Bearer ${token}` } },
        );

        if (res.data.success) {
          toast.success("कैटेगरी जोड़ दी गई।");
          resetForm();
          fetchCategories();
        }
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

  const handleDelete = async (id, name) => {
    if (!window.confirm(`"${name}" हटाना चाहते हैं?`)) return;

    try {
      setDeletingId(id);
      const res = await axios.delete(
        `${API_BASE_URL}/api/v1/category/delete-cat/${id}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (res.data.success) {
        toast.success("कैटेगरी हटा दी गई।");
        fetchCategories();
      }
    } catch (e) {
      toast.error(e.response?.data?.message || "हटाने में त्रुटि।");
    } finally {
      setDeletingId(null);
    }
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
            from-indigo-700
            via-indigo-600
            to-indigo-500
            text-white
            shadow-xl
          "
        >
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/10" />

          <div className="relative flex items-center justify-between px-5 py-5 sm:px-7 sm:py-6">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
                <Layers3 className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
                  कैटेगरी
                </h1>
                <p className="text-xs font-medium text-indigo-100">
                  कैटेगरी मैनेज करें
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-white/15 px-3 py-2 text-center backdrop-blur">
                <p className="text-xl font-black leading-none">
                  {categories.length}
                </p>
                <p className="mt-1 text-[10px] font-semibold text-indigo-100">
                  कुल
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (editingId) resetForm();
                  setShowForm((prev) => !prev);
                }}
                className="flex h-10 items-center gap-1.5 rounded-2xl bg-white px-4 text-xs font-black text-indigo-700 shadow-sm transition hover:bg-indigo-50 active:scale-[0.97]"
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
          <section className="mt-3 overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
            <div className="p-4 sm:p-5">
              <div className="mb-4 flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
                  {editingId ? (
                    <Pencil className="h-4 w-4" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                </span>
                <h3 className="text-sm font-black text-slate-900">
                  {editingId ? "कैटेगरी एडिट करें" : "नई कैटेगरी जोड़ें"}
                </h3>
              </div>

              <label className="mb-1 block text-[11px] font-bold text-slate-500">
                कैटेगरी का नाम
              </label>

              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="जैसे: दालें, मसाले, चावल..."
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-500/10"
              />

              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="flex h-10 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 text-xs font-black text-white transition hover:bg-indigo-700 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
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
            </div>

            {/* =================================================
                PRODUCTS IN THIS CATEGORY (edit mode)
            ================================================== */}

            {editingId && (
              <div className="border-t border-slate-100 bg-slate-50/70 px-4 py-3 sm:px-5">
                <div className="flex items-center gap-2 mb-2">
                  <Package className="h-3.5 w-3.5 text-indigo-500" />
                  <span className="text-[11px] font-black uppercase tracking-wide text-slate-600">
                    इस कैटेगरी के प्रोडक्ट
                  </span>
                </div>

                {editProductsLoading ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-indigo-400" />
                  </div>
                ) : editProducts.length === 0 ? (
                  <p className="py-2 text-xs font-medium text-slate-400">
                    इस कैटेगरी में कोई प्रोडक्ट नहीं है।
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {editProducts.map((p) => (
                      <span
                        key={p._id}
                        className={`
                          inline-flex
                          items-center
                          gap-1
                          rounded-lg
                          px-2
                          py-1
                          text-[11px]
                          font-bold
                          ${
                            p.isActive !== false
                              ? "bg-white text-slate-700 border border-slate-200"
                              : "bg-red-50 text-red-500 border border-red-100 line-through"
                          }
                        `}
                      >
                        <Package className="h-3 w-3" />
                        {p.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
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
              placeholder="कैटेगरी खोजें..."
              className="h-11 w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-10 text-sm font-medium text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10"
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
              {filtered.length} में से {categories.length} कैटेगरी
            </p>
          )}
        </div>

        {/* =====================================================
            LIST
        ====================================================== */}

        {loading ? (
          <div className="mt-6 flex justify-center">
            <Loader2 className="h-7 w-7 animate-spin text-indigo-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="mt-6 flex min-h-[200px] flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-slate-50">
            <Layers3 className="h-10 w-10 text-slate-300" />
            <p className="mt-3 text-sm font-bold text-slate-500">
              {search.trim() ? "कोई कैटेगरी नहीं मिली" : "कोई कैटेगरी नहीं है"}
            </p>
          </div>
        ) : (
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((cat) => (
              <div
                key={cat._id}
                className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md sm:p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-lg font-black text-indigo-600">
                    {cat.name.charAt(0).toUpperCase()}
                  </div>

                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-black text-slate-900">
                      {cat.name}
                    </h3>

                    <div className="mt-1 flex items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                          cat.isActive !== false
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-red-100 text-red-600"
                        }`}
                      >
                        {cat.isActive !== false ? "Active" : "Off"}
                      </span>

                      <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                        <Package className="h-2.5 w-2.5" />
                        {cat.productCount || 0}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex gap-1.5 border-t border-slate-100 pt-2.5">
                  <button
                    type="button"
                    onClick={() => startEdit(cat)}
                    className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-slate-100 py-2 text-[11px] font-bold text-slate-700 transition hover:bg-slate-200 active:scale-[0.97]"
                  >
                    <Pencil className="h-3 w-3" />
                    एडिट
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDelete(cat._id, cat.name)}
                    disabled={deletingId === cat._id}
                    className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-red-50 py-2 text-[11px] font-bold text-red-600 transition hover:bg-red-100 active:scale-[0.97] disabled:opacity-50"
                  >
                    {deletingId === cat._id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Trash2 className="h-3 w-3" />
                    )}
                    हटाएँ
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminCategoryPage;