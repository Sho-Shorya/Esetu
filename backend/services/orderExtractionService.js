import axios from "axios";
import Product from "../models/productModel.js";
import Company from "../models/companiesModel.js";

/**
 * Phase 1 pilot: transcript -> draft order items.
 *
 * Hard rules enforced here, not just requested in the prompt:
 *   - the model only ever sees a read-only projection of the live catalog
 *   - every returned productId must exist in that projection, otherwise the
 *     item is dropped into `unresolved`
 *   - variant measurement and company must match a real variant, otherwise the
 *     claim is discarded and flagged for review
 *   - nothing here creates, mutates or reads an Order
 *
 * `unit` stays free text (peti / crate / bottle / piece / half peti ...) because
 * Product has no canonical pack-unit field.
 */

export const isLlmConfigured = () =>
  Boolean(
    process.env.LLM_API_KEY &&
      process.env.LLM_BASE_URL &&
      process.env.LLM_MODEL,
  );

const toStringOrNull = (value) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

/**
 * A quantity the model could not state as a positive whole number.
 *
 * `null` means "the caller never said one" and must stay `null` all the way to
 * the review screen. It must never become 1: the merge below adds the
 * quantities of every mention of the same product, so an invented 1 silently
 * inflates the order. A real recording read "2 egg trays... 3 egg trays" as
 * 1+2+3 = 7 trays because the opening mention had no number.
 */
const toQuantity = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  const rounded = Math.round(parsed);
  return rounded > 0 ? rounded : null;
};

const statedSomething = (value) =>
  value !== null && value !== undefined && String(value).trim() !== "";

const toConfidence = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  if (parsed < 0) return 0;
  if (parsed > 1) return 1;
  return parsed;
};

/**
 * Read-only catalog projection sent to the model. No price, no stock, no
 * images, no mutation surface.
 */
export const buildCatalogProjection = async () => {
  const [products, companies] = await Promise.all([
    Product.find({ isActive: true })
      .select("name hinglishName keyword variants.company variants.measurement")
      .lean(),
    Company.find({ active: true }).select("name").lean(),
  ]);

  const companyNameById = new Map(
    companies.map((company) => [String(company._id), company.name]),
  );

  return products.map((product, index) => ({
    // Opaque reference handed to the model. A string label cannot be confused
    // with a 0-based or 1-based array position, which the model gets wrong.
    ref: `P${index + 1}`,
    productId: String(product._id),
    name: product.name || "",
    hinglishName: product.hinglishName || "",
    aliases: Array.isArray(product.keyword)
      ? product.keyword.filter((alias) => typeof alias === "string" && alias.trim())
      : [],
    variants: (product.variants || []).map((variant) => ({
      companyId: String(variant.company),
      company: companyNameById.get(String(variant.company)) || null,
      measurement: variant.measurement || "",
    })),
  }));
};

/**
 * Identifiers are stripped before the catalog reaches the model. It only ever
 * sees an opaque `ref`, and the ref is resolved back to the real productId
 * here, so a mistyped or miscounted id can never become a wrong line item.
 */
const toModelCatalog = (catalog) =>
  catalog.map((product) => ({
    ref: product.ref,
    name: product.name,
    hinglishName: product.hinglishName,
    aliases: product.aliases,
    variants: product.variants.map((variant) => ({
      company: variant.company,
      measurement: variant.measurement,
    })),
  }));

const SYSTEM_PROMPT = [
  "You convert a Hindi/English grocery phone-call transcript into a structured DRAFT order.",
  "You never invent products. You only reference products that appear in the CATALOG given to you.",
  "Every catalog entry has a `ref` label such as \"P3\". Reference a product ONLY by copying that exact `ref` string.",
  "Never output, guess or reconstruct any database id, _id, productId or list position. Only the `ref` strings shown in the CATALOG are valid.",
  "Match the spoken product to the closest catalog entry using name, hinglishName and aliases.",
  "The CATALOG is a shortlist, not the whole shop. A spoken product that is absent from it must go in `unresolved` with a reason - never guess a nearby ref.",
  "If no catalog entry is a reasonable match, put the spoken name in `unresolved` with a reason and do not guess a ref.",
  "Emit one item per distinct (product, company, variant) combination the customer ordered.",
  "If the same product is ordered with two different variants, emit a SEPARATE item for each. If it is ordered under two different companies, emit a SEPARATE item for each. Never merge those.",
  "If the customer states a quantity more than once for the same product, emit an item for EVERY mention. Do not combine them, and do not drop the earlier one. The server decides whether the quantities are added or replace each other.",
  "Set `isCorrection` to true on a LATER item only when the customer is revising what they just said (wording like \"matlab\", \"nahi\", \"sahi hai\", \"mat\", \"actually\", \"I mean\", \"reconsider\"). Set it to false when the customer is simply adding more of the same thing, so the quantities get added.",
  "Do not correct the customer's numbers yourself and do not assume the latest mention overrides the earlier one. Report exactly what was said, in the order it was said.",
  "`quantity` must be a positive whole number. If the caller never said a quantity for that item, use null - never guess a number and never default to 1. A guessed 1 is added to the other quantities for the same product and inflates the order.",
  "`unit` is free text exactly as spoken (peti, crate, bottle, piece, half peti). Use an empty string if unsaid.",
  "`variantMeasurement` must be copied exactly from the matched product's variants[].measurement. Convert a spoken weight to the closest listed one. Use null if unsure.",
  "`company` must be copied exactly from the matched variant's company. Use null if unsure. Do not guess a company the customer did not say.",
  "Ignore greetings, small talk and questions that are not part of the order.",
  "Never treat background noise or unrelated talk as an order. Set isOrderIntent=false and return no items then.",
  "Keep every string short. `matchedPhrase` must be at most 3 words, written in Latin/hinglish letters, not Devanagari (for example \"tata namak 1kg\"). Devanagari costs many more tokens, so transliterate it. `customerNote` must be an empty string unless the customer asked for something extra.",
  "Respond with JSON only, no markdown, no explanation, using exactly this shape:",
  '{"isOrderIntent":boolean,"customerNote":string,"needsClarification":boolean,"clarificationQuestion":string,"items":[[ref,quantity,unit,variantMeasurement,company,matchedPhrase,confidence,isCorrection]],"unresolved":[[spokenName,reason]]}',
  "Every entry in `items` MUST be an array of exactly 8 values in this fixed order:",
  "0 ref = the catalog ref string. 1 quantity = a positive number, or null when the caller never said one. 2 unit = short spoken word or \"\". 3 variantMeasurement = a string or null. 4 company = a string or null. 5 matchedPhrase = at most 3 Latin/hinglish words. 6 confidence = a number from 0 to 1. 7 isCorrection = true or false.",
  "For `confidence`, report how sure you are of the match itself, and be honest about doubt: 0.9+ only for a name you are certain of, 0.6-0.8 when the spoken name was vague or could be another product, and below 0.6 when you are guessing. Do not return the same number for every item.",
  "Use these arrays instead of objects because repeated object keys waste the output budget and long orders were being cut off before finishing.",
].join("\n");

/**
 * The full catalog cannot be sent every call: a large shop produces a prompt so
 * big that Groq's predicted output blows the free-tier tokens-per-minute cap.
 * Instead the catalog is shortlisted against the transcript first, which keeps
 * the prompt bounded and measurably improves matching.
 */

// Devanagari vowel signs, anusvara/chandrabindu, virama and the danda are
// dropped so "अंडा" and "अंडे" collapse to the same stem.
const LOOSE_MARKS = /[\u0901-\u0903\u093A-\u094F\u0951-\u0957\u0962\u0963]/g;

// Order matters: the marks are combining marks (\p{Mn}/\p{Mc}), not letters, so
// stripping punctuation first would replace every vowel sign and virama with a
// space and shatter "मिर्ची" into the single characters "म र च". Those fragments
// are then dropped by the length filter below and the product never matches.
// Removing the marks first keeps the word whole, which is what makes "अंडा" and
// "अंडे" collapse to the same stem as intended.
const looseNormalize = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[\u0964\u0965]/g, " ")
    .replace(LOOSE_MARKS, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const productSearchText = (product) =>
  looseNormalize(
    [product.name, product.hinglishName, ...(product.aliases || [])].filter(Boolean).join(" "),
  );

/** Word n-grams of the transcript, which is what a spoken order actually contains. */
const transcriptTerms = (transcript) => {
  const words = looseNormalize(transcript).split(" ").filter((word) => word.length >= 2);
  const terms = new Set(words);
  for (let i = 0; i < words.length - 1; i += 1) {
    const bigram = `${words[i]} ${words[i + 1]}`;
    if (bigram.length >= 5) terms.add(bigram);
  }
  return terms;
};

/**
 * Lexical pre-filter. It cannot bridge the Devanagari transcript to Latin
 * catalog keywords on its own, so it is only a fallback that guarantees the
 * model is never handed an empty candidate set. Pure numbers are ignored
 * because weights and quantities match almost everything.
 */
export const scoreCatalog = (catalog, transcript) => {
  const terms = transcriptTerms(transcript);

  return catalog
    .map((product) => {
      const haystack = productSearchText(product);
      if (!haystack) return { product, score: 0, hits: [] };

      let score = 0;
      const hits = [];

      for (const term of terms) {
        if (/^\d+$/.test(term)) continue;
        if (haystack.includes(term)) {
          // A multi-word hit is far stronger evidence than a single word.
          score += term.includes(" ") ? 3 : 1;
          hits.push(term);
        }
      }

      return { product, score, hits };
    })
    .sort((a, b) => b.score - a.score);
};

const estimateTokens = (value) => Math.ceil(String(value).length / 3);

/**
 * A two-stage pass keeps both provider limits satisfied.
 *
 * Stage 1 sees a compact catalog (ref + names only) and returns just the refs
 * the customer mentioned. Its output is tiny, and its input is small enough to
 * fit the input-tokens-per-minute budget. Chunking keeps that true for any
 * catalog size.
 *
 * Stage 2 receives full detail for only the selected products, so the expensive
 * aliases and variant lists are paid for just once per spoken item.
 *
 * Because only selected products are resolvable, a hallucinated ref is still
 * rejected exactly as before.
 */
const SELECT_SYSTEM_PROMPT = [
  "You are matching a Hindi/English grocery order transcript against a product list.",
  "Each product has a `ref` like \"P7\". Return the refs of ONLY the products the customer actually asks for.",
  "Match across scripts: the transcript is often Devanagari while names are Latin transliteration, so match the SOUND and meaning (\"अंडा\" = anda = eggs, \"चीनी\" = cheeni = sugar, \"नमक\" = namak = salt).",
  "Do not include anything the customer did not ask for. Ignore greetings and small talk.",
  "If nothing matches, return an empty list.",
  "Respond with JSON only: {\"refs\":[\"P1\",\"P2\"]}",
].join("\n");

const chunkCatalogForSelection = (catalog, budgetTokens) => {
  const chunks = [];
  let current = [];
  let currentChars = 0;

  for (const product of catalog) {
    const entry = {
      ref: product.ref,
      name: product.name,
      hinglishName: product.hinglishName,
    };
    const chars = JSON.stringify(entry).length;

    if (current.length && currentChars + chars > budgetTokens * 3) {
      chunks.push(current);
      current = [];
      currentChars = 0;
    }

    current.push(entry);
    currentChars += chars;
  }

  if (current.length) chunks.push(current);
  return chunks;
};

const parseRefs = (content) => {
  const refs = new Set();

  const collect = (value) => {
    if (typeof value === "string" && /^P\d+$/i.test(value.trim())) refs.add(value.trim().toUpperCase());
  };

  // The model is asked for {"refs":[...]}, but salvage a bare array too.
  try {
    const parsed = parseModelJson(content);
    const list = Array.isArray(parsed) ? parsed : parsed?.refs ?? parsed?.products ?? [];
    if (Array.isArray(list)) list.forEach(collect);
  } catch {
    for (const match of String(content || "").match(/P\d+/gi) || []) collect(match);
  }

  return refs;
};

const buildUserPrompt = ({ transcript, catalog }) =>
  [
    "CATALOG:",
    JSON.stringify(toModelCatalog(catalog)),
    "",
    "TRANSCRIPT:",
    transcript,
    "",
    "Return the JSON draft now.",
  ].join("\n");


const parseModelJson = (content) => {
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("Model returned an empty response.");
  }

  const withoutFences = content
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();

  try {
    return JSON.parse(withoutFences);
  } catch {
    const start = withoutFences.indexOf("{");
    const end = withoutFences.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) {
      throw new Error("Model response was not valid JSON.");
    }
    return JSON.parse(withoutFences.slice(start, end + 1));
  }
};

/**
 * Wording that means the customer is revising what they just said rather than
 * adding to it. The model sets isCorrection from the full transcript, which is
 * the stronger signal; this is a safety net for when it does not.
 */
const CORRECTION_CUES =
  /\b(matlab|m\s*a*tlab|nahi|nahin|sahi\s*hai|sahi\s*h\s*ai|mat\b|reconsider|actually|i\s*meant|galat|m\s*badal|chodo|chod\s*do|bilkul\s*ulat|ulta)\b/i;

const isCorrectionMention = (item) =>
  item.isCorrection === true || CORRECTION_CUES.test(item.matchedPhrase || "");

/**
 * A line is the same product only when product, company and variant all match
 * exactly. A missing company is treated as a different line from a stated one,
 * so "do 2 packets of salt" and "Tata 1kg" stay separate rather than silently
 * becoming one line with invented detail.
 *
 * Within a group the stated quantities add up, because that is what a repeat
 * mention normally means ("do 2 packets... and 5 more"). A later mention that
 * carries a correction cue replaces the quantity instead, which is what "no,
 * make it 3" means.
 *
 * A mention with no stated quantity is no information, not zero and not one, so
 * it is counted in `mentions` and leaves the total alone. If no mention of that
 * product ever carried a number, the merged quantity stays null so review asks
 * the supplier for it instead of confirming an invented figure.
 */
export const mergeDuplicateLines = (items) => {
  const byKey = new Map();
  const lines = [];

  for (const item of items) {
    const key = JSON.stringify([
      item.productId,
      item.company ?? null,
      item.variantMeasurement ?? null,
    ]);

    const existing = byKey.get(key);
    if (!existing) {
      const line = { ...item, mentions: 1 };
      byKey.set(key, line);
      lines.push(line);
      continue;
    }

    existing.mentions += 1;

    const stated = typeof item.quantity === "number";

    if (isCorrectionMention(item)) {
      if (stated) existing.quantity = item.quantity;
      if (item.unit) existing.unit = item.unit;
      existing.matchedPhrase = item.matchedPhrase || existing.matchedPhrase;
      existing.isCorrection = true;
    } else if (stated) {
      // null + n would coerce to n, but only because JavaScript treats null as 0.
      // Written out so the intent survives: an unstated quantity adds nothing.
      const base = typeof existing.quantity === "number" ? existing.quantity : 0;
      existing.quantity = base + item.quantity;
    }

    if (!existing.unit && item.unit) existing.unit = item.unit;
    if (typeof existing.confidence === "number" && typeof item.confidence === "number") {
      existing.confidence = Math.min(existing.confidence, item.confidence);
    }
  }

  return lines;
};

const ITEM_FIELDS = [
  "ref",
  "quantity",
  "unit",
  "variantMeasurement",
  "company",
  "matchedPhrase",
  "confidence",
  "isCorrection",
];

/**
 * Accepts the compact positional row the prompt asks for, and still tolerates
 * the object form in case the model ignores the instruction. Repeated object
 * keys were measured at roughly three times the output cost per item, which is
 * what pushed long orders past the provider's output cap.
 *
 * A row of the wrong arity is rejected rather than reinterpreted, so a
 * misaligned column can never be silently turned into a wrong order line.
 */
export const normalizeItemRow = (row) => {
  if (Array.isArray(row)) {
    if (row.length !== ITEM_FIELDS.length) return null;
    return Object.fromEntries(ITEM_FIELDS.map((field, index) => [field, row[index]]));
  }
  if (row && typeof row === "object") return row;
  return null;
};

const normalizeUnresolvedRow = (row) => {
  if (Array.isArray(row)) {
    return { spokenName: row[0], reason: row[1] };
  }
  if (row && typeof row === "object") return row;
  return null;
};

/**
 * Re-checks the model output against the catalog we actually sent. Anything
 * unverifiable is demoted, never silently accepted.
 */
const validateDraft = (parsed, catalog) => {
  const errors = [];
  const catalogById = new Map(catalog.map((product) => [product.productId, product]));
  const catalogByRef = new Map(catalog.map((product) => [product.ref, product]));

  const items = [];
  const unresolved = Array.isArray(parsed?.unresolved)
    ? parsed.unresolved
        .map(normalizeUnresolvedRow)
        .filter(Boolean)
        .map((entry) => ({
          spokenName: toStringOrNull(entry?.spokenName) || "",
          reason: toStringOrNull(entry?.reason) || "not matched to catalog",
        }))
        .filter((entry) => entry.spokenName)
    : [];

  const rawRows = Array.isArray(parsed?.items) ? parsed.items : [];
  const rawItems = [];

  for (const row of rawRows) {
    const normalized = normalizeItemRow(row);
    if (normalized) {
      rawItems.push(normalized);
      continue;
    }
    errors.push(
      "Dropped item: it was not a recognisable item row and was not safely readable.",
    );
    unresolved.push({
      spokenName: "(unreadable item)",
      reason: "malformed item row",
    });
  }

  for (const rawItem of rawItems) {
    const ref = toStringOrNull(rawItem?.ref);
    let product = ref ? catalogByRef.get(ref) || null : null;

    if (!product) {
      // Tolerate an older prompt that still emitted productId, but only after
      // checking it against the exact catalog we sent.
      const productId = toStringOrNull(rawItem?.productId);
      product = productId ? catalogById.get(productId) || null : null;

      if (!product) {
        errors.push(
          `Dropped item: ref "${ref || "(missing)"}" is not in the supplied catalog.`,
        );
        unresolved.push({
          spokenName: toStringOrNull(rawItem?.matchedPhrase) || ref || "unknown",
          reason: "no valid catalog ref",
        });
        continue;
      }
    }

    const quantity = toQuantity(rawItem?.quantity);
    if (quantity === null && statedSomething(rawItem?.quantity)) {
      errors.push(
        `Discarded unusable quantity "${rawItem.quantity}" for ${product.name}: not a positive whole number.`,
      );
    }

    const requestedMeasurement = toStringOrNull(rawItem?.variantMeasurement);
    const validMeasurements = new Set(
      product.variants
        .map((variant) => variant.measurement)
        .filter((measurement) => typeof measurement === "string" && measurement),
    );

    let variantMeasurement = null;
    if (requestedMeasurement && validMeasurements.has(requestedMeasurement)) {
      variantMeasurement = requestedMeasurement;
    } else if (requestedMeasurement) {
      errors.push(
        `Discarded variant measurement "${requestedMeasurement}" for ${product.name}: not one of its variants.`,
      );
    }

    const requestedCompany = toStringOrNull(rawItem?.company);
    let company = null;
    if (requestedCompany) {
      const companyAllowed = product.variants.some(
        (variant) => variant.company && variant.company === requestedCompany,
      );
      if (companyAllowed) {
        company = requestedCompany;
      } else {
        errors.push(
          `Discarded company "${requestedCompany}" for ${product.name}: not one of its variants.`,
        );
      }
    }

    const confidence = toConfidence(rawItem?.confidence);

    items.push({
      productId: product.productId,
      productName: product.name,
      hinglishName: product.hinglishName || "",
      quantity,
      unit: toStringOrNull(rawItem?.unit) || "",
      variantMeasurement,
      company,
      matchedPhrase: toStringOrNull(rawItem?.matchedPhrase) || "",
      confidence,
      isCorrection: rawItem?.isCorrection === true,
    });
  }

  const merged = mergeDuplicateLines(items);

  const isOrderIntent = parsed?.isOrderIntent !== false && merged.length > 0;
  const needsClarification = Boolean(parsed?.needsClarification) || unresolved.length > 0;

  // A clarification flag the supplier cannot act on is worse than none, because
  // it reads as "already handled". When the model left the question empty but
  // there is something unresolvable, name the actual items instead.
  const askedQuestion = toStringOrNull(parsed?.clarificationQuestion) || "";
  const unquantified = merged.filter((item) => item.quantity === null);
  const fallbackQuestion =
    unresolved.length > 0
      ? `Which product did the customer mean by ${unresolved
          .slice(0, 4)
          .map((entry) => `“${entry.spokenName}”`)
          .join(", ")}? None of these are in the catalog.`
      : unquantified.length > 0
        ? `No quantity was stated for ${unquantified
            .slice(0, 4)
            .map((item) => item.productName)
            .join(", ")}. How many?`
        : "";

  return {
    draft: {
      isOrderIntent,
      customerNote: toStringOrNull(parsed?.customerNote) || "",
      needsClarification,
      clarificationQuestion: askedQuestion || fallbackQuestion,
      items: merged,
      unresolved,
      itemCount: merged.length,
    },
    validationErrors: errors,
  };
};

/**
 * LLM providers return a structured error body. Surfacing it turns an
 * unactionable "Request failed with status code 404" into the real cause
 * (wrong model, bad key, quota, unsupported parameter).
 */
const describeLlmError = (error) => {
  const body = error?.response?.data;
  const detail =
    body?.error?.message ||
    body?.message ||
    (typeof body === "string" && body.trim() ? body.trim() : null) ||
    error?.message ||
    "unknown error";

  const enriched = new Error(`LLM request failed: ${detail}`);
  enriched.code = body?.error?.code || error?.code || null;
  return enriched;
};

const readMaxTokens = () =>
  Math.max(
    256,
    Math.min(
      Number(process.env.LLM_MAX_TOKENS || 900),
      // Groq's free tier rejects a request whose predicted output exceeds the
      // tokens-per-minute allowance, so never ask for more than that.
      Number(process.env.LLM_MAX_TOKENS || 900),
    ),
  );

const isRateLimit = (error) => {
  const code = error?.code || "";
  const body = error?.detail || "";
  return (
    code === "rate_limit_exceeded" ||
    /rate.?limit|too many requests|tokens per minute|OTPM/i.test(String(body))
  );
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Opt-in token accounting. The free tier enforces input/output tokens per
 * minute, so when an order is long it helps to know which side is binding.
 */
const logUsage = (data, payload) => {
  if (process.env.LLM_DEBUG_TOKENS !== "true") return;
  const usage = data?.usage ?? {};
  console.log(
    `[pilot-extract] tokens in=${usage.prompt_tokens ?? "?"} out=${usage.completion_tokens ?? "?"} ` +
      `max_out=${payload?.max_tokens ?? "default"} finish=${data?.choices?.[0]?.finish_reason ?? "?"}`,
  );
};

const callLlm = async (payload, baseUrl) => {
  const options = {
    headers: {
      Authorization: `Bearer ${process.env.LLM_API_KEY}`,
      "Content-Type": "application/json",
    },
    timeout: Number(process.env.LLM_TIMEOUT_MS || 90000),
  };

  try {
    const data = (await axios.post(`${baseUrl}/chat/completions`, payload, options)).data;
    logUsage(data, payload);
    return data;
  } catch (error) {
    const enriched = describeLlmError(error);
    // OTPM is a per-minute budget, so a single wait usually clears it. One
    // retry only, otherwise a busy shop would pile up duplicate requests.
    const retryWaitMs = Number(process.env.LLM_RATE_LIMIT_RETRY_WAIT_MS || 65000);
    const retries = Number(process.env.LLM_RATE_LIMIT_RETRIES || 1);

    if (retries > 0 && isRateLimit(enriched)) {
      console.warn(
        `[pilot-extract] provider rate limit hit, waiting ${retryWaitMs}ms before retry ${retries} time(s).`,
      );
      await sleep(retryWaitMs);
      try {
        const data = (await axios.post(`${baseUrl}/chat/completions`, payload, options)).data;
        logUsage(data, payload);
        return data;
      } catch (retryError) {
        throw describeLlmError(retryError);
      }
    }

    throw enriched;
  }
};

/**
 * Stage 1: ask the model which catalog refs this transcript actually mentions.
 * The catalog is chunked so the input stays inside the provider's
 * input-tokens-per-minute budget no matter how large the shop catalogue is.
 */
const selectCandidateRefs = async ({ catalog, transcript, baseUrl }) => {
  const budget = Math.max(500, Number(process.env.LLM_SELECT_TOKEN_BUDGET || 3500));
  const chunks = chunkCatalogForSelection(catalog, budget);
  const selected = new Set();

  for (const chunk of chunks) {
    const payload = {
      model: process.env.LLM_MODEL,
      messages: [
        { role: "system", content: SELECT_SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            "PRODUCTS:",
            JSON.stringify(chunk),
            "",
            "TRANSCRIPT:",
            transcript,
            "",
            "Return the refs JSON now.",
          ].join("\n"),
        },
      ],
      temperature: 0,
      max_tokens: 300,
    };

    if (process.env.LLM_JSON_MODE !== "false") {
      payload.response_format = { type: "json_object" };
    }

    const data = await callLlm(payload, baseUrl);
    for (const ref of parseRefs(data?.choices?.[0]?.message?.content)) selected.add(ref);
  }

  return selected;
};

export const extractOrderDraft = async ({ transcript, catalog }) => {
  if (!isLlmConfigured()) {
    const error = new Error(
      "LLM_API_KEY / LLM_BASE_URL / LLM_MODEL are not configured.",
    );
    error.code = "LLM_NOT_CONFIGURED";
    throw error;
  }
  if (!transcript || !transcript.trim()) {
    const error = new Error("Transcript is empty; nothing to extract.");
    error.code = "EXTRACTION_NO_TRANSCRIPT";
    throw error;
  }

  const baseUrl = String(process.env.LLM_BASE_URL).replace(/\/+$/, "");

  // When the whole catalog already fits inside the input budget, skip the
  // selection pass. That halves latency and removes the second call that would
  // otherwise race the per-minute input allowance.
  const singlePassBudget = Math.max(
    500,
    Number(process.env.LLM_SINGLE_PASS_TOKEN_BUDGET || 4500),
  );
  const systemTokens = estimateTokens(SYSTEM_PROMPT);
  const fullCatalogTokens = estimateTokens(JSON.stringify(toModelCatalog(catalog)));
  const transcriptTokens = estimateTokens(transcript);
  const fitsInOnePass =
    systemTokens + fullCatalogTokens + transcriptTokens + 200 <= singlePassBudget;

  let shortlist = catalog;
  let selectedRefs = 0;

  if (!fitsInOnePass) {
    const selected = await selectCandidateRefs({ catalog, transcript, baseUrl });
    const byRef = new Map(catalog.map((product) => [product.ref, product]));
    selectedRefs = selected.size;
    shortlist = [...selected].map((ref) => byRef.get(ref)).filter(Boolean);

    // Nothing selected: fall back to the lexical ranking so the model is never
    // asked to extract against an empty catalog and can report real misses.
    if (shortlist.length === 0) {
      const limit = Math.max(5, Number(process.env.LLM_CATALOG_FALLBACK_LIMIT || 15));
      shortlist = scoreCatalog(catalog, transcript)
        .slice(0, limit)
        .map((entry) => entry.product);
    }
  }

  const shortlistStats = {
    catalogSize: catalog.length,
    mode: fitsInOnePass ? "single_pass" : "two_stage",
    selectedRefs,
    shortlisted: shortlist.length,
  };

  const payload = {
    model: process.env.LLM_MODEL,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: buildUserPrompt({ transcript, catalog: shortlist }),
      },
    ],
    temperature: Number(process.env.LLM_TEMPERATURE || 0.1),
    max_tokens: readMaxTokens(),
  };

  if (process.env.LLM_JSON_MODE !== "false") {
    payload.response_format = { type: "json_object" };
  }

  const data = await callLlm(payload, baseUrl);

  const choice = data?.choices?.[0];
  const content = choice?.message?.content;

  // A truncated response is a real risk with a hard token cap, and it fails as
  // a confusing JSON error, so name it explicitly.
  if (choice?.finish_reason === "length") {
    const error = new Error(
      `Model response hit the ${payload.max_tokens} token cap before completing. ` +
        "Raise LLM_MAX_TOKENS, or shorten the transcript, or split the call.",
    );
    error.code = "LLM_OUTPUT_TRUNCATED";
    throw error;
  }

  const parsed = parseModelJson(content);

  const { draft, validationErrors } = validateDraft(parsed, shortlist);

  return {
    model: process.env.LLM_MODEL,
    draft,
    validationErrors,
    // A pilot draft is always human-reviewed. This flag is informational.
    needsReview: true,
    shortlist: shortlistStats,
  };
};
