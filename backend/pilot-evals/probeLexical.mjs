import { scoreCatalog } from "../services/orderExtractionService.js";

const catalog = [
  { ref: "P1", productId: "salt", name: "नमक", hinglishName: "Namak", aliases: ["namak"], variants: [] },
  { ref: "P2", productId: "mirchi", name: "मिर्ची पाउडर", hinglishName: "Mirchi Powder", aliases: ["mirchi", "mirch"], variants: [] },
  { ref: "P3", productId: "ande", name: "अंडे", hinglishName: "Eggs", aliases: ["anda", "egg"], variants: [] },
  { ref: "P4", productId: "haldi", name: "हल्दी पाउडर", hinglishName: "Haldi powder", aliases: ["haldi", "हल्दी"], variants: [] },
];

const probes = [
  "मिर्ची", "मिर्ची पाउडर", "मीरची", "mirchi", "mirchi powder",
  "अंडे", "अंडा", "anda", "egg",
  "हल्दी", "हल्दी पाउडर", "haldi",
  "नमक", "namak", "टाटा नमक 1kg", "tata namak",
];

console.log("probe".padEnd(24), "-> best match (score)");
for (const p of probes) {
  const ranked = scoreCatalog(catalog, p).filter((e) => e.score > 0);
  const top = ranked[0];
  console.log(
    `  ${p.padEnd(22)} -> ${top ? `${top.product.productId} (${top.score})` : "NO MATCH  <-- dead"}`,
  );
}
