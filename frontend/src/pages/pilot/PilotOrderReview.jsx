import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import Fuse from "fuse.js";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  Check,
  CheckCheck,
  ChevronDown,
  CircleHelp,
  CircleSlash,
  ClipboardList,
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
 * record only. The confirm tap also asks the backend bridge to write the real
 * e-Setu order, so reviewing and ordering happen in one action — the supplier
 * still reads every line first, and the bridge still revalidates each item
 * against the live catalog before anything is written.
 */

const AUTOSAVE_MS = 900;

/**
 * The backend phrases line problems, reasons and clarification questions as
 * plain English sentences. The supplier reads Hindi, so the fixed ones are
 * mapped here at the display layer; free-form text (the model's own wording)
 * passes through untouched.
 */
const FRIENDLY_NOTES = [
  ["No product selected.", "कोई सामान चुना नहीं गया।"],
  [
    "This product is no longer in the catalog. Pick another product.",
    "यह सामान अब सूची में नहीं है। कोई और सामान चुनें।",
  ],
  [
    "Quantity must be a whole number of 1 or more.",
    "मात्रा 1 या उससे ज़्यादा, पूरी संख्या में होनी चाहिए।",
  ],
  [
    "Variant (size/weight) was not stated. Pick the right one.",
    "नाप/वज़न नहीं बताया गया। सही नाप चुनें।",
  ],
  [
    "Company/brand was not stated. Pick the right one.",
    "कंपनी नहीं बताई गई। सही कंपनी चुनें।",
  ],
  ["not matched to catalog", "दुकान की सूची से मैच नहीं हुआ"],
  ["not in catalog", "सूची में नहीं है"],
  ["removed by supplier", "आपने हटाया"],
  ["malformed item row", "सामान की जानकारी ठीक नहीं थी"],
  ["no valid catalog ref", "सूची में नहीं मिला"],
];

const FRIENDLY_PATTERNS = [
  [
    /^No quantity was stated for (.+)\. Enter how many\.$/,
    (m) => `${m[1]} की मात्रा नहीं बताई। कितने लिखें।`,
  ],
  [
    /^No quantity was stated for (.+)\. How many\.$/,
    (m) => `${m[1]} की मात्रा नहीं बताई गई। कितने?`,
  ],
  [
    /^“(.+)” is not a variant of (.+)\. Pick a listed variant\.$/,
    (m) => `“${m[1]}” यह ${m[2]} की किस्म नहीं है। सूची में से सही किस्म चुनें।`,
  ],
  [
    /^“(.+)” does not make (.+)\. Pick a listed company\.$/,
    (m) => `${m[1]} कंपनी ${m[2]} नहीं बनाती। सूची में से सही कंपनी चुनें।`,
  ],
  [
    /^“(.+)” does not make (.+) in (.+)\. Pick a listed combination\.$/,
    (m) =>
      `${m[2]} में “${m[1]}” कंपनी का ${m[3]} नाप नहीं मिलता। सूचीवाली जोड़ी चुनें।`,
  ],
  [
    /^AI could not match “([^”]+)”[:：]\s*(.*)$/,
    (m) =>
      m[2]
        ? `सामान पहचाना नहीं जा सका: “${m[1]}” — ${m[2]}`
        : `सामान पहचाना नहीं जा सका: “${m[1]}”`,
  ],
  [
    /^Which product did the customer mean by (.+)\? None of these are in the catalog\.$/,
    (m) => `ग्राहक का मतलब ${m[1]} से था। ये कोई भी सामान दुकान की सूची में नहीं है।`,
  ],
];

const friendlyNote = (text) => {
  if (!text) return text;
  const exact = FRIENDLY_NOTES.find(([source]) => source === text);
  if (exact) return exact[1];
  for (const [pattern, to] of FRIENDLY_PATTERNS) {
    const matched = String(text).match(pattern);
    if (matched) return to(matched);
  }
  return text;
};

const LINE_FLAGS = {
  unresolved: {
    label: "मैच नहीं",
    card: "border-orange-300 bg-orange-50/70",
    chip: "bg-orange-200 text-orange-900",
    icon: CircleSlash,
  },
  ambiguous: {
    label: "सामान जाँचें",
    card: "border-amber-300 bg-amber-50/70",
    chip: "bg-amber-200 text-amber-900",
    icon: TriangleAlert,
  },
  uncertain_variant: {
    label: "किस्म चुनें",
    card: "border-sky-300 bg-sky-50/70",
    chip: "bg-sky-200 text-sky-900",
    icon: Info,
  },
  quantity_unknown: {
    label: "कितने?",
    card: "border-fuchsia-300 bg-fuchsia-50/70",
    chip: "bg-fuchsia-200 text-fuchsia-900",
    icon: CircleHelp,
  },
  merged_mentions: {
    label: "जोड़ा गया",
    card: "border-emerald-200 bg-white",
    chip: "bg-slate-200 text-slate-700",
    icon: Layers,
  },
  invalid: {
    label: "सुधारें",
    card: "border-red-300 bg-red-50/70",
    chip: "bg-red-200 text-red-900",
    icon: AlertTriangle,
  },
  ok: {
    label: "तैयार",
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
          placeholder="सामान खोजें…"
          className={`${fieldClass} pl-9`}
        />
      </div>

      {open && (
        <div className="absolute left-0 right-0 top-12 z-30 max-h-64 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
          {results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-400">
              कोई सामान नहीं मिला।
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
        <option value="">नाप / वज़न…</option>
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
        <option value="">कंपनी…</option>
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
                आपने जोड़ा
              </span>
            )}
            {line.origin === "ai_unresolved" && !line.removed && (
              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-black uppercase text-slate-700">
                छूटा सामान
              </span>
            )}
            {wasCorrected && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-black uppercase text-emerald-700">
                सुधारा गया
              </span>
            )}
            {typeof line.confidence === "number" && line.origin === "ai" && (
              <span className="text-[11px] font-bold text-slate-400">
                भरोसा {Math.round(line.confidence * 100)}%
              </span>
            )}
            {line.origin !== "manual" &&
              Number(line.mentions) > 1 &&
              !line.removed && (
                <span
                  className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-black uppercase text-slate-700"
                  title="ग्राहक ने यह बात कई बार कही। कुल उन्हीं बातों से जोड़ा गया है, अलग से नंबर नहीं बोला गया।"
                >
                  <Layers className="h-3 w-3" />
                  {line.mentions} बार कहा
                </span>
              )}
          </div>

          <p className="mt-1.5 truncate text-lg font-black leading-tight text-slate-900">
            {product?.name ||
              line.spokenName ||
              line.productName ||
              "अनजान सामान"}
          </p>

          {product?.hinglishName && (
            <p className="truncate text-xs text-slate-500">
              {product.hinglishName}
            </p>
          )}

          {line.matchedPhrase && product && (
            <p className="mt-0.5 truncate text-xs text-slate-400">
              सुना: “{line.matchedPhrase}”
            </p>
          )}
          {line.origin === "ai_unresolved" && line.reason && (
            <p className="mt-0.5 text-xs font-semibold text-orange-800">
              {friendlyNote(line.reason)}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onRemove(line.key, line.removed)}
            title={line.removed ? "हटाना वापस लें" : "यह सामान हटाएँ"}
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
              • {friendlyNote(issue)}
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
                सामान बदलें
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
                  title="एक कम"
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
                  title="एक ज़्यादा"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              <input
                value={line.unit || ""}
                disabled={disabled}
                placeholder="नाप (पेटी, किलो…)"
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
              मैच सही है — यह पंक्ति मान लें
            </button>
          )}
        </>
      )}

      {line.removed && (
        <p className="mt-2 flex items-center gap-2 text-xs font-bold text-slate-500">
          <Trash2 className="h-3.5 w-3.5" />
          ड्राफ्ट से हटाया गया
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
        छूटा सामान जोड़ें
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
              placeholder="नाप (पेटी, किलो…)"
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
            ड्राफ्ट में जोड़ें
          </button>
        </div>
      )}
    </div>
  );
};

/* ------------------------------- order summary ------------------------------ */

/**
 * What the supplier's single tap actually produced.
 *
 * Read straight off the Order the backend returned, so it can never disagree
 * with what was written: no second fetch, no re-derived totals.
 */
const OrderSummary = ({ order, orderId }) => {
  const items = Array.isArray(order?.items) ? order.items : [];
  const total = Number(order?.totalAmount);

  return (
    <div className="mt-3 space-y-2 rounded-2xl border border-emerald-200 bg-white p-3">
      <p className="flex flex-wrap items-center gap-x-2 text-sm font-black text-emerald-900">
        <CheckCheck className="h-4 w-4" />
        ऑर्डर बन गया ✓
        <span className="font-mono text-xs font-bold text-slate-500">
          #{String(order?._id || orderId || "")}
        </span>
      </p>

      {order?.createdAt && (
        <p className="text-xs font-semibold text-slate-500">
          {new Date(order.createdAt).toLocaleString("hi-IN", {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </p>
      )}

      {items.length > 0 && (
        <ul className="space-y-1">
          {items.map((item, index) => (
            <li
              key={`${item.productId}-${index}`}
              className="flex items-baseline justify-between gap-2 text-sm text-slate-800"
            >
              <span className="min-w-0">
                <span className="font-bold">{item.qty}</span> × {item.name}
                {item.measurement ? (
                  <span className="text-xs text-slate-500">
                    {" "}
                    ({item.measurement}
                    {item.companyName ? `, ${item.companyName}` : ""})
                  </span>
                ) : null}
              </span>
              <span className="shrink-0 font-mono text-xs font-bold text-slate-600">
                ₹{Number(item.total || 0).toFixed(2)}
              </span>
            </li>
          ))}
        </ul>
      )}

      {Number.isFinite(total) && (
        <p className="flex items-baseline justify-between border-t border-emerald-200 pt-2 text-sm font-black text-emerald-900">
          <span>कुल</span>
          <span className="font-mono">₹{total.toFixed(2)}</span>
        </p>
      )}

      <Link
        to="/today-orders"
        className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-emerald-700 text-sm font-black text-emerald-800 transition hover:bg-emerald-50"
      >
        <ClipboardList className="h-4 w-4" />
        ऑर्डर देखें
      </Link>
    </div>
  );
};

/* -------------------------------- confirmed -------------------------------- */

const ConfirmedPanel = ({
  confirmed,
  order,
  orderError,
  creating,
  onCreateOrder,
  onReopen,
  reopening,
}) => {
  const [open, setOpen] = useState(false);
  const hasOrder = Boolean(order?.order) || order?.alreadyCreated === true;

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
            {new Date(confirmed.at).toLocaleString("hi-IN")}
          </p>
          <p
            className={`mt-2 rounded-xl p-2.5 text-xs font-bold ${
              hasOrder
                ? "bg-white/70 text-emerald-900"
                : "bg-amber-100 text-amber-900"
            }`}
          >
            {hasOrder
              ? `ऑर्डर बन गया${order.merged ? " और आज के ऑर्डर में जोड़ा गया" : ""}।`
              : "ड्राफ्ट पक्का है, पर अभी असली ऑर्डर नहीं बना है।"}
          </p>
        </div>
      </div>

      {orderError && (
        <p
          role="alert"
          className="mt-3 rounded-xl bg-red-100 p-2.5 text-xs font-bold text-red-800"
        >
          {orderError}
        </p>
      )}

      {!hasOrder && (
        <button
          type="button"
          disabled={creating}
          onClick={onCreateOrder}
          className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 text-sm font-black text-white transition hover:bg-emerald-800 disabled:opacity-40"
        >
          {creating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCheck className="h-4 w-4" />
          )}
          {creating ? "ऑर्डर बन रहा है..." : "अब ऑर्डर बनाएँ"}
        </button>
      )}

      {hasOrder && <OrderSummary order={order?.order} orderId={order?.orderId} />}

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
                {item.quantity} {item.unit || "नग"}
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
          {confirmed.removed.length} गलत सामान जाँच के दौरान हटाया गया।
        </p>
      )}
      {confirmed.corrections?.length > 0 && (
        <p className="mt-1 text-xs font-bold text-emerald-800">
          आपने {confirmed.corrections.length} सामान जाँच में सही किया।
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
  // The real order this confirm produced, or null while it does not exist yet.
  // Kept separate from the review payload so the panel can tell "confirmed" and
  // "ordered" apart, which are two different facts.
  const [order, setOrder] = useState(null);
  const [orderError, setOrderError] = useState("");

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
      // A draft confirmed earlier may already have produced an order, so the
      // panel is seeded from the stored snapshot rather than assuming a page
      // load means "not ordered yet".
      const confirmed = reviewData.review?.confirmed;
      setOrder(
        confirmed?.orderCreated === true
          ? {
              orderId: confirmed.orderId || null,
              merged: false,
              alreadyCreated: true,
              // The stored snapshot proves an order exists but carries no
              // order body, so the panel shows the fact without inventing
              // line items it would have to re-derive.
              order: null,
            }
          : null,
      );
      setOrderError("");
      dirtyRef.current = false;
    } catch (error) {
      toast.error(
        error.response?.data?.message || "जाँच नहीं खुल सकी।",
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
          error.response?.data?.message || "यह ड्राफ्ट सहेजा नहीं जा सका।",
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
      toast.success("सही मान लिया गया।");
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
        toast.success("सामान ड्राफ्ट में जुड़ गया।");
      } catch (error) {
        toast.error(
          error.response?.data?.message || "यह सामान नहीं जुड़ सका।",
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
    setOrderError("");
    try {
      // One tap: the supplier has just read every line, so the same action
      // confirms the draft and asks the bridge for the real order.
      const data = await confirmPilotDraft(pilotCallId, { createOrder: true });
      setReview(data.review);
      setLines(data.review.lines.map((line) => ({ ...line })));
      setOrder({
        orderId: data.orderId || null,
        merged: data.merged === true,
        alreadyCreated: data.alreadyCreated === true,
        order: data.order || null,
      });
      onChanged?.();
      toast.success(data.message || "ऑर्डर बन गया।");
    } catch (error) {
      const payload = error.response?.data;
      if (payload?.review) {
        setReview(payload.review);
        setLines(payload.review.lines.map((line) => ({ ...line })));
      }
      // A refused order still leaves a confirmed draft behind, so the supplier
      // keeps their work and can see exactly what stopped it.
      const message =
        payload?.message || "ऑर्डर नहीं बन सका। जाँचकर दोबारा कोशिश करें।";
      setOrderError(message);
      toast.error(message);
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
      toast.success("ड्राफ्ट फिर जाँचने के लिए खुल गया।");
    } catch (error) {
      toast.error(
        error.response?.data?.message || "ड्राफ्ट फिर नहीं खुल सका।",
      );
    } finally {
      setReopening(false);
    }
  }, [pilotCallId, onChanged]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-sm font-bold text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin" />
        जाँच खोली जा रही है…
      </div>
    );
  }

  if (!review) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-300 p-4 text-center text-sm font-bold text-slate-500">
        यह जाँच नहीं खुल सकी। कॉल को फिर से खोलकर कोशिश करें।
      </p>
    );
  }

  const kept = lines.filter((line) => !line.removed);
  const removedCount = lines.length - kept.length;
  const blockers = (review.report?.blockers || []).filter((blocker) =>
    kept.some((line) => line.key === blocker.key),
  );
  const isConfirmed = review.status === "confirmed";
  // The bridge refuses to attach an order to a customer it cannot identify, so
  // saying so before the tap is kinder than a refusal after it.
  const customerMatched = call.customer?.matched === true;

  return (
    <section className="rounded-[24px] border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-lg font-black text-slate-900">
          ऑर्डर की जाँच ({kept.length} सामान)
        </h4>
        <div className="flex items-center gap-2 text-xs font-bold">
          {saving ? (
            <span className="flex items-center gap-1 text-slate-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              सहेजा जा रहा है…
            </span>
          ) : savedAt ? (
            <span className="text-emerald-600">सहेजा गया</span>
          ) : null}
        </div>
      </div>

      {isConfirmed ? (
        <div className="mt-3">
          <ConfirmedPanel
            confirmed={review.confirmed}
            order={order}
            orderError={orderError}
            creating={confirming}
            onCreateOrder={handleConfirm}
            onReopen={handleReopen}
            reopening={reopening}
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
                {blockers.length} सामान पर आपका फैसला चाहिए
              </p>
              <ul className="mt-1.5 space-y-0.5">
                {blockers.map((blocker) => (
                  <li
                    key={blocker.key}
                    className="text-xs font-bold text-amber-900"
                  >
                    • {blocker.productName} — {friendlyNote(blocker.messages?.[0])}
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
                  <span>{friendlyNote(meta.clarificationQuestion)}</span>
                </p>
              ) : (
                <p>
                  इस कॉल के बारे में पक्का भरोसा नहीं है। ऊपर लिखी बात से हर
                  सामान जाँच लें।
                </p>
              )}
            </div>
          )}

          {meta.customerNote && (
            <p className="mt-3 rounded-2xl bg-slate-50 p-3 text-sm text-slate-700">
              <span className="font-black">ग्राहक की बात:</span>{" "}
              {meta.customerNote}
            </p>
          )}

          {kept.length === 0 ? (
            <p className="mt-3 rounded-2xl border border-dashed border-slate-300 p-4 text-center text-sm font-bold text-slate-500">
              जाँचने के लिए कुछ नहीं बचा। मंगाया गया सामान जोड़ दें।
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
              {removedCount} सामान हटाए गए हैं — वापस लाने के लिए वापसी वाले
              आइकन को दबाएँ।
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
              {confirming ? "ऑर्डर बन रहा है..." : "ऑर्डर पक्का करें"}
            </button>

            {review.report?.confirmable ? (
              customerMatched ? (
                <p className="mt-2 flex items-start gap-1.5 text-xs font-semibold text-slate-500">
                  <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  एक ही टैप में ड्राफ्ट पक्का होगा और e-Setu में असली ऑर्डर बनेगा।
                </p>
              ) : (
                <p className="mt-2 flex items-start gap-1.5 text-xs font-bold text-amber-700">
                  <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  ग्राहक का नंबर मैच नहीं हुआ। ऑर्डर तभी बनेगा जब ग्राहक पहचान
                  जाए, इसलिए पहले ग्राहक चुनें।
                </p>
              )
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
