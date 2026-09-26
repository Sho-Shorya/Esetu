import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import Fuse from "fuse.js";
import {
  AlertTriangle,
  Check,
  CheckCheck,
  ChevronDown,
  CircleHelp,
  CircleSlash,
  Info,
  Layers,
  Loader2,
  Lock,
  Minus,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import {
  addPilotReviewItem,
  confirmPilotDraft,
  fetchPilotReview,
  fetchPilotReviewCatalog,
  reopenPilotDraft,
  savePilotReview,
} from "@/services/phoneOrderPilotApi";

/**
 * Supplier review of the AI draft.
 *
 * One screen, no wizard, no extra navigation: the distributor reads the draft,
 * fixes the flagged lines and confirms. Every edit is autosaved to the pilot
 * record only. "Confirm Draft" writes a confirmed pilot draft and never
 * creates an e-Setu order.
 */

const AUTOSAVE_MS = 900;

const LINE_FLAGS = {
  unresolved: {
    label: "Not matched",
    card: "border-orange-300 bg-orange-50/70",
    chip: "bg-orange-200 text-orange-900",
    icon: CircleSlash,
  },
  ambiguous: {
    label: "Check product",
    card: "border-amber-300 bg-amber-50/70",
    chip: "bg-amber-200 text-amber-900",
    icon: TriangleAlert,
  },
  uncertain_variant: {
    label: "Variant needed",
    card: "border-sky-300 bg-sky-50/70",
    chip: "bg-sky-200 text-sky-900",
    icon: Info,
  },
  quantity_unknown: {
    label: "How many?",
    card: "border-fuchsia-300 bg-fuchsia-50/70",
    chip: "bg-fuchsia-200 text-fuchsia-900",
    icon: CircleHelp,
  },
  merged_mentions: {
    label: "Added up",
    card: "border-emerald-200 bg-white",
    chip: "bg-slate-200 text-slate-700",
    icon: Layers,
  },
  invalid: {
    label: "Fix this",
    card: "border-red-300 bg-red-50/70",
    chip: "bg-red-200 text-red-900",
    icon: AlertTriangle,
  },
  ok: {
    label: "Ready",
    card: "border-emerald-200 bg-white",
    chip: "bg-emerald-100 text-emerald-700",
    icon: Check,
  },
};

const fieldClass =
  "h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-base font-semibold text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 disabled:bg-slate-100 disabled:text-slate-400";

const smallFieldClass =
  "h-10 w-full rounded-xl border border-slate-300 bg-white px-2.5 text-sm font-semibold text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10";

/* ------------------------------- product pick ------------------------------ */

const ProductPicker = ({ catalog, value, onPick, autoFocus }) => {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  const fuse = useMemo(
    () =>
      new Fuse(catalog, {
        threshold: 0.35,
        ignoreLocation: true,
        keys: ["name", "hinglishName", "aliases"],
      }),
    [catalog],
  );

  const results = useMemo(() => {
    const needle = query.trim();
    if (!needle) return catalog.slice(0, 40);
    return fuse
      .search(needle)
      .slice(0, 40)
      .map((entry) => entry.item);
  }, [query, fuse, catalog]);

  useEffect(() => {
    if (!open) return undefined;
    const onAway = (event) => {
      if (boxRef.current && !boxRef.current.contains(event.target))
        setOpen(false);
    };
    document.addEventListener("mousedown", onAway);
    return () => document.removeEventListener("mousedown", onAway);
  }, [open]);

  return (
    <div ref={boxRef} className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={query}
          autoFocus={autoFocus}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="Search product…"
          className={`${fieldClass} pl-9`}
        />
      </div>

      {open && (
        <div className="absolute left-0 right-0 top-12 z-30 max-h-64 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
          {results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-400">
              No product found.
            </p>
          ) : (
            results.map((product) => {
              const active = product.productId === value;
              return (
                <button
                  key={product.productId}
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    onPick(product);
                    setQuery("");
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left transition hover:bg-slate-50 ${
                    active ? "bg-slate-100" : ""
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-slate-900">
                      {product.name}
                    </span>
                    {product.hinglishName && (
                      <span className="block truncate text-xs text-slate-500">
                        {product.hinglishName}
                      </span>
                    )}
                  </span>
                  {active && (
                    <Check className="h-4 w-4 shrink-0 text-slate-900" />
                  )}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

/* --------------------------------- variant pick ----------------------------- */

const VariantPick = ({
  product,
  measurement,
  company,
  onMeasurement,
  onCompany,
  disabled,
}) => {
  const measurements = useMemo(
    () => [
      ...new Set(
        (product?.variants || []).map((v) => v.measurement).filter(Boolean),
      ),
    ],
    [product],
  );
  const companies = useMemo(
    () => [
      ...new Set(
        (product?.variants || []).map((v) => v.company).filter(Boolean),
      ),
    ],
    [product],
  );

  if (!product) return null;

  return (
    <div className="grid grid-cols-2 gap-2">
      <select
        value={measurement || ""}
        disabled={disabled}
        onChange={(event) => onMeasurement(event.target.value || null)}
        className={smallFieldClass}
      >
        <option value="">Size / weight…</option>
        {measurements.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>

      <select
        value={company || ""}
        disabled={disabled}
        onChange={(event) => onCompany(event.target.value || null)}
        className={smallFieldClass}
      >
        <option value="">Brand…</option>
        {companies.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
};

/* --------------------------------- line card ------------------------------- */

const LineCard = ({
  line,
  catalog,
  catalogById,
  onChange,
  onRemove,
  onAcknowledge,
  disabled,
}) => {
  const [editingProduct, setEditingProduct] = useState(false);
  const flag = LINE_FLAGS[line.status] || LINE_FLAGS.ok;
  const FlagIcon = flag.icon;
  const product = line.productId ? catalogById.get(line.productId) : null;
  const canAcknowledge = [
    "ambiguous",
    "uncertain_variant",
    "merged_mentions",
  ].includes(line.status);
  const wasCorrected = Boolean(line.resolution);

  const patch = (changes) => onChange(line.key, changes);

  return (
    <li className={`rounded-2xl border-2 p-3 ${flag.card}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-black uppercase tracking-wide ${flag.chip}`}
            >
              <FlagIcon className="h-3 w-3" />
              {flag.label}
            </span>
            {line.origin === "manual" && (
              <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-black uppercase text-violet-700">
                Added by you
              </span>
            )}
            {line.origin === "ai_unresolved" && !line.removed && (
              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-black uppercase text-slate-700">
                Missing item
              </span>
            )}
            {wasCorrected && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-black uppercase text-emerald-700">
                Corrected
              </span>
            )}
            {typeof line.confidence === "number" && line.origin === "ai" && (
              <span className="text-[11px] font-bold text-slate-400">
                AI {Math.round(line.confidence * 100)}%
              </span>
            )}
            {line.origin !== "manual" &&
              Number(line.mentions) > 1 &&
              !line.removed && (
                <span
                  className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-black uppercase text-slate-700"
                  title="The customer mentioned this more than once. The total was added up from those mentions, not spoken as a single number."
                >
                  <Layers className="h-3 w-3" />
                  {line.mentions} mentions
                </span>
              )}
          </div>

          <p className="mt-1.5 truncate text-lg font-black leading-tight text-slate-900">
            {product?.name ||
              line.spokenName ||
              line.productName ||
              "Unknown item"}
          </p>

          {product?.hinglishName && (
            <p className="truncate text-xs text-slate-500">
              {product.hinglishName}
            </p>
          )}

          {line.matchedPhrase && product && (
            <p className="mt-0.5 truncate text-xs text-slate-400">
              heard as “{line.matchedPhrase}”
            </p>
          )}
          {line.origin === "ai_unresolved" && line.reason && (
            <p className="mt-0.5 text-xs font-semibold text-orange-800">
              {line.reason}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onRemove(line.key, line.removed)}
            title={line.removed ? "Undo remove" : "Remove this item"}
            className={`flex h-9 w-9 items-center justify-center rounded-full border transition disabled:opacity-40 ${
              line.removed
                ? "border-slate-300 bg-white text-slate-700"
                : "border-transparent text-slate-400 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
            }`}
          >
            {line.removed ? (
              <RotateCcw className="h-4 w-4" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {line.issues?.length > 0 && !line.removed && (
        <ul className="mt-2 space-y-0.5">
          {line.issues.map((issue) => (
            <li key={issue} className="text-xs font-bold text-slate-700">
              • {issue}
            </li>
          ))}
        </ul>
      )}

      {!line.removed && (
        <>
          {/* Quick-fix chips: one tap for the most common corrections. */}
          {line.candidates?.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {line.candidates.map((candidate) => (
                <button
                  key={candidate.productId}
                  type="button"
                  disabled={disabled}
                  onClick={() =>
                    patch({
                      productId: candidate.productId,
                      resolution: { method: "supplier_product" },
                    })
                  }
                  className={`rounded-full border px-3 py-1.5 text-xs font-bold transition disabled:opacity-40 ${
                    candidate.productId === line.productId
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-300 bg-white text-slate-700 hover:border-slate-900"
                  }`}
                >
                  {candidate.productName}
                </button>
              ))}
            </div>
          )}

          <div className="mt-2 space-y-2">
            {editingProduct || !product ? (
              <ProductPicker
                catalog={catalog}
                value={line.productId}
                autoFocus={!product}
                onPick={(picked) => {
                  patch({
                    productId: picked.productId,
                    company: null,
                    variantMeasurement: null,
                    resolution: { method: "supplier_product" },
                  });
                  setEditingProduct(false);
                }}
              />
            ) : (
              <button
                type="button"
                disabled={disabled}
                onClick={() => setEditingProduct(true)}
                className="flex h-10 w-full items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold text-slate-700 transition hover:border-slate-900 disabled:opacity-40"
              >
                <Pencil className="h-3.5 w-3.5" />
                Change product
              </button>
            )}

            <VariantPick
              product={product}
              measurement={line.variantMeasurement}
              company={line.company}
              disabled={disabled}
              onMeasurement={(value) =>
                patch({
                  variantMeasurement: value,
                  resolution: { method: "supplier_variant" },
                })
              }
              onCompany={(value) =>
                patch({
                  company: value,
                  resolution: { method: "supplier_variant" },
                })
              }
            />

            <div className="flex items-center gap-2">
              <div className="flex h-11 items-center overflow-hidden rounded-xl border border-slate-300 bg-white">
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() =>
                    patch({
                      quantity: Math.max(1, Number(line.quantity || 1) - 1),
                    })
                  }
                  className="flex h-full w-10 items-center justify-center text-slate-600 transition hover:bg-slate-50 active:bg-slate-100 disabled:opacity-40"
                  title="One less"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <input
                  value={line.quantity ?? ""}
                  disabled={disabled}
                  inputMode="numeric"
                  onChange={(event) => patch({ quantity: event.target.value })}
                  className="h-full w-12 border-x border-slate-200 text-center text-base font-black text-slate-900 outline-none"
                />
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() =>
                    patch({ quantity: Number(line.quantity || 0) + 1 })
                  }
                  className="flex h-full w-10 items-center justify-center text-slate-600 transition hover:bg-slate-50 active:bg-slate-100 disabled:opacity-40"
                  title="One more"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              <input
                value={line.unit || ""}
                disabled={disabled}
                placeholder="unit (peti, kg…)"
                onChange={(event) => patch({ unit: event.target.value })}
                className={`${smallFieldClass} flex-1`}
              />
            </div>
          </div>

          {canAcknowledge && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => onAcknowledge(line.key)}
              className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-xl border-2 border-slate-900 bg-slate-900 text-sm font-black text-white transition hover:bg-slate-700 disabled:opacity-40"
            >
              <CheckCheck className="h-4 w-4" />
              Match is correct — accept this line
            </button>
          )}
        </>
      )}

      {line.removed && (
        <p className="mt-2 flex items-center gap-2 text-xs font-bold text-slate-500">
          <Trash2 className="h-3.5 w-3.5" />
          Removed from this draft
        </p>
      )}
    </li>
  );
};

/* ------------------------------- add-by-hand ------------------------------- */

const AddItemPanel = ({ catalog, onAdd, busy }) => {
  const [open, setOpen] = useState(false);
  const [productId, setProductId] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [unit, setUnit] = useState("");
  const [company, setCompany] = useState(null);
  const [variantMeasurement, setVariantMeasurement] = useState(null);

  const product = productId
    ? catalog.find((entry) => entry.productId === productId)
    : null;

  const reset = () => {
    setProductId(null);
    setQuantity(1);
    setUnit("");
    setCompany(null);
    setVariantMeasurement(null);
    setOpen(false);
  };

  const submit = () => {
    if (!product) return;
    onAdd({ productId, quantity, unit, company, variantMeasurement });
    reset();
  };

  return (
    <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white p-3">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex h-11 w-full items-center justify-center gap-2 text-sm font-black text-slate-700"
      >
        <Plus className="h-4 w-4" />
        Add a missing item
        <ChevronDown
          className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          <ProductPicker
            catalog={catalog}
            value={productId}
            onPick={(picked) => {
              setProductId(picked.productId);
              setCompany(null);
              setVariantMeasurement(null);
            }}
          />

          <VariantPick
            product={product}
            measurement={variantMeasurement}
            company={company}
            onMeasurement={setVariantMeasurement}
            onCompany={setCompany}
          />

          <div className="flex items-center gap-2">
            <div className="flex h-11 items-center overflow-hidden rounded-xl border border-slate-300 bg-white">
              <button
                type="button"
                onClick={() =>
                  setQuantity((value) => Math.max(1, Number(value || 1) - 1))
                }
                className="flex h-full w-10 items-center justify-center text-slate-600 hover:bg-slate-50"
              >
                <Minus className="h-4 w-4" />
              </button>
              <input
                value={quantity}
                inputMode="numeric"
                onChange={(event) => setQuantity(event.target.value)}
                className="h-full w-12 border-x border-slate-200 text-center text-base font-black outline-none"
              />
              <button
                type="button"
                onClick={() => setQuantity((value) => Number(value || 0) + 1)}
                className="flex h-full w-10 items-center justify-center text-slate-600 hover:bg-slate-50"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <input
              value={unit}
              placeholder="unit (peti, kg…)"
              onChange={(event) => setUnit(event.target.value)}
              className={`${smallFieldClass} flex-1`}
            />
          </div>

          <button
            type="button"
            disabled={!product || busy}
            onClick={submit}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 text-sm font-black text-white transition hover:bg-slate-700 disabled:opacity-40"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Add to draft
          </button>
        </div>
      )}
    </div>
  );
};

/* -------------------------------- confirmed -------------------------------- */

const ConfirmedPanel = ({ confirmed, onReopen, reopening }) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
          <CheckCheck className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-black text-emerald-900">
            ड्राफ्ट पक्का हुआ · {confirmed.itemCount} सामान
          </p>
          <p className="text-xs font-semibold text-emerald-800">
            {new Date(confirmed.at).toLocaleString("en-IN")}
          </p>
          <p className="mt-2 rounded-xl bg-white/70 p-2.5 text-xs font-bold text-emerald-900">
            ड्राफ्ट सहेजा गया। अभी असली ऑर्डर नहीं बना है।
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="mt-3 flex items-center gap-1 text-sm font-black text-emerald-800"
      >
        {open ? "सूची छिपाएँ" : "पक्का सामान देखें"}
        <ChevronDown
          className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <ul className="mt-2 space-y-1.5">
          {confirmed.items.map((item, index) => (
            <li
              key={`${item.productId}-${index}`}
              className="rounded-xl bg-white/80 p-2.5 text-sm text-slate-800"
            >
              <span className="font-black">
                {item.quantity} {item.unit || "unit(s)"}
              </span>{" "}
              · {item.productName}
              <span className="block text-xs text-slate-500">
                {[item.variantMeasurement, item.company]
                  .filter(Boolean)
                  .join(" · ") || "—"}
              </span>
            </li>
          ))}
        </ul>
      )}

      {confirmed.removed?.length > 0 && (
        <p className="mt-2 text-xs font-bold text-emerald-800">
          {confirmed.removed.length} incorrect item(s) removed during review.
        </p>
      )}
      {confirmed.corrections?.length > 0 && (
        <p className="mt-1 text-xs font-bold text-emerald-800">
          {confirmed.corrections.length} item(s) corrected by you.
        </p>
      )}

      <button
        type="button"
        disabled={reopening}
        onClick={onReopen}
        className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-emerald-700 text-sm font-black text-emerald-800 transition hover:bg-white disabled:opacity-40"
      >
        {reopening ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <RotateCcw className="h-4 w-4" />
        )}
        ड्राफ्ट फिर खोलें
      </button>
    </div>
  );
};

/* --------------------------------- the screen ------------------------------ */

const PilotOrderReview = ({ call, onChanged }) => {
  const pilotCallId = call._id;

  const [catalog, setCatalog] = useState([]);
  const [review, setReview] = useState(null);
  const [meta, setMeta] = useState({
    customerNote: "",
    needsClarification: false,
    clarificationQuestion: "",
  });
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [adding, setAdding] = useState(false);

  const dirtyRef = useRef(false);
  const timerRef = useRef(null);

  const catalogById = useMemo(
    () => new Map(catalog.map((entry) => [entry.productId, entry])),
    [catalog],
  );

  const load = useCallback(async () => {
    try {
      const [reviewData, catalogData] = await Promise.all([
        fetchPilotReview(pilotCallId),
        fetchPilotReviewCatalog(),
      ]);

      setCatalog(catalogData.products || []);
      setReview(reviewData.review);
      setMeta({
        customerNote: reviewData.customerNote || "",
        needsClarification: reviewData.needsClarification === true,
        clarificationQuestion: reviewData.clarificationQuestion || "",
      });
      setLines((reviewData.review?.lines || []).map((line) => ({ ...line })));
      dirtyRef.current = false;
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Could not open the draft review.",
      );
      setReview(null);
    } finally {
      setLoading(false);
    }
  }, [pilotCallId]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  const persist = useCallback(
    async (nextLines) => {
      setSaving(true);
      try {
        const data = await savePilotReview(pilotCallId, nextLines);
        setReview(data.review);
        // The server is the authority on status, issues and names, but the
        // supplier is the authority on the values they are typing. Merging
        // instead of replacing stops a save from wiping a half-typed quantity.
        setLines((current) =>
          data.review.lines.map((saved) => {
            const mine = current.find((line) => line.key === saved.key);
            return {
              ...saved,
              quantity: mine?.quantity === "" ? "" : saved.quantity,
            };
          }),
        );
        setSavedAt(data.savedAt);
        dirtyRef.current = false;
        return data.review;
      } catch (error) {
        toast.error(
          error.response?.data?.message || "Could not save this draft.",
        );
        return null;
      } finally {
        setSaving(false);
      }
    },
    [pilotCallId],
  );

  const scheduleSave = useCallback(
    (nextLines) => {
      dirtyRef.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => persist(nextLines), AUTOSAVE_MS);
    },
    [persist],
  );

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const changeLine = useCallback(
    (key, changes) => {
      setLines((current) => {
        const next = current.map((line) => {
          if (line.key !== key) return line;
          const merged = { ...line, ...changes };
          if (changes.resolution) {
            merged.resolution = {
              method: changes.resolution.method,
              at: new Date().toISOString(),
            };
          }
          return merged;
        });
        scheduleSave(next);
        return next;
      });
    },
    [scheduleSave],
  );

  const removeLine = useCallback(
    (key, wasRemoved) => {
      setLines((current) => {
        const next = current.map((line) =>
          line.key === key
            ? {
                ...line,
                removed: !wasRemoved,
                removedAt: wasRemoved ? null : new Date().toISOString(),
                removedReason: wasRemoved ? null : "removed by supplier",
              }
            : line,
        );
        scheduleSave(next);
        return next;
      });
    },
    [scheduleSave],
  );

  const acknowledgeLine = useCallback(
    (key) => {
      changeLine(key, { resolution: { method: "supplier_acknowledged" } });
      toast.success("Line accepted.");
    },
    [changeLine],
  );

  const addItem = useCallback(
    async (input) => {
      setAdding(true);
      try {
        const data = await addPilotReviewItem(pilotCallId, input);
        setReview(data.review);
        setLines(data.review.lines.map((line) => ({ ...line })));
        toast.success("Item added to the draft.");
      } catch (error) {
        toast.error(
          error.response?.data?.message || "Could not add that item.",
        );
      } finally {
        setAdding(false);
      }
    },
    [pilotCallId],
  );

  const handleConfirm = useCallback(async () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setConfirming(true);
    try {
      const data = await confirmPilotDraft(pilotCallId);
      setReview(data.review);
      setLines(data.review.lines.map((line) => ({ ...line })));
      onChanged?.();
      toast.success(data.message || "Draft confirmed. No order was created.");
    } catch (error) {
      const payload = error.response?.data;
      if (payload?.review) {
        setReview(payload.review);
        setLines(payload.review.lines.map((line) => ({ ...line })));
      }
      toast.error(payload?.message || "Could not confirm the draft.");
    } finally {
      setConfirming(false);
    }
  }, [pilotCallId, onChanged]);

  const handleReopen = useCallback(async () => {
    setReopening(true);
    try {
      const data = await reopenPilotDraft(pilotCallId);
      setReview(data.review);
      onChanged?.();
      toast.success("Draft reopened for review.");
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Could not reopen the draft.",
      );
    } finally {
      setReopening(false);
    }
  }, [pilotCallId, onChanged]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-sm font-bold text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin" />
        Opening draft review…
      </div>
    );
  }

  if (!review) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-300 p-4 text-center text-sm font-bold text-slate-500">
        This draft could not be opened for review. Refresh the call to try
        again.
      </p>
    );
  }

  const kept = lines.filter((line) => !line.removed);
  const removedCount = lines.length - kept.length;
  const blockers = (review.report?.blockers || []).filter((blocker) =>
    kept.some((line) => line.key === blocker.key),
  );
  const isConfirmed = review.status === "confirmed";

  return (
    <section className="rounded-[24px] border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-lg font-black text-slate-900">
          Review order ({kept.length} item{kept.length === 1 ? "" : "s"})
        </h4>
        <div className="flex items-center gap-2 text-xs font-bold">
          {saving ? (
            <span className="flex items-center gap-1 text-slate-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Saving…
            </span>
          ) : savedAt ? (
            <span className="text-emerald-600">Saved</span>
          ) : null}
        </div>
      </div>

      {isConfirmed ? (
        <div className="mt-3">
          <ConfirmedPanel
            confirmed={review.confirmed}
            reopening={reopening}
            onReopen={handleReopen}
          />
        </div>
      ) : (
        <>
          {/* Blocker summary: the only thing that stands between the supplier
              and Confirm Draft, shown before they start tapping. */}
          {blockers.length > 0 && (
            <div className="mt-3 rounded-2xl border-2 border-amber-300 bg-amber-50 p-3">
              <p className="flex items-center gap-2 text-sm font-black text-amber-900">
                <TriangleAlert className="h-4 w-4" />
                {blockers.length} item(s) need your decision
              </p>
              <ul className="mt-1.5 space-y-0.5">
                {blockers.map((blocker) => (
                  <li
                    key={blocker.key}
                    className="text-xs font-bold text-amber-900"
                  >
                    • {blocker.productName} — {blocker.messages?.[0]}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {meta.needsClarification && (
            <div className="mt-3 rounded-2xl bg-sky-50 p-3 text-xs font-bold text-sky-900">
              {meta.clarificationQuestion ? (
                <p className="flex items-start gap-2">
                  <CircleHelp className="mt-px h-4 w-4 shrink-0" />
                  <span>{meta.clarificationQuestion}</span>
                </p>
              ) : (
                <p>
                  The AI was not fully sure about this call. Check every line
                  against the transcript above.
                </p>
              )}
            </div>
          )}

          {meta.customerNote && (
            <p className="mt-3 rounded-2xl bg-slate-50 p-3 text-sm text-slate-700">
              <span className="font-black">Customer note:</span>{" "}
              {meta.customerNote}
            </p>
          )}

          {kept.length === 0 ? (
            <p className="mt-3 rounded-2xl border border-dashed border-slate-300 p-4 text-center text-sm font-bold text-slate-500">
              Nothing left to confirm. Add the items that were ordered.
            </p>
          ) : (
            <ul className="mt-3 space-y-2.5">
              {kept.map((line) => (
                <LineCard
                  key={line.key}
                  line={line}
                  catalog={catalog}
                  catalogById={catalogById}
                  onChange={changeLine}
                  onRemove={removeLine}
                  onAcknowledge={acknowledgeLine}
                />
              ))}
            </ul>
          )}

          <div className="mt-3">
            <AddItemPanel catalog={catalog} onAdd={addItem} busy={adding} />
          </div>

          {removedCount > 0 && (
            <p className="mt-3 flex items-center gap-1.5 text-xs font-bold text-slate-500">
              <Trash2 className="h-3.5 w-3.5" />
              {removedCount} removed item(s) — tap the undo icon to bring one
              back.
            </p>
          )}

          <div className="mt-4 border-t border-slate-200 pt-4">
            <button
              type="button"
              disabled={confirming || !review.report?.confirmable}
              onClick={handleConfirm}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-lg font-black text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
            >
              {confirming ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <CheckCheck className="h-5 w-5" />
              )}
              ड्राफ्ट पक्का करें
            </button>

            {review.report?.confirmable ? (
              <p className="mt-2 flex items-start gap-1.5 text-xs font-semibold text-slate-500">
                <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                सामान की जाँच सहेजी जाएगी। अभी असली ऑर्डर नहीं बनेगा।
              </p>
            ) : (
              <p className="mt-2 flex items-start gap-1.5 text-xs font-bold text-amber-700">
                <X className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {blockers.length > 0
                  ? "पहले हर निशान लगे सामान की जाँच करें।"
                  : "ड्राफ्ट पक्का करने के लिए सामान जोड़ें।"}
              </p>
            )}
          </div>
        </>
      )}
    </section>
  );
};

export default PilotOrderReview;
