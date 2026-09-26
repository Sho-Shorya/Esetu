const LOOSE_MARKS = /[\u0901-\u0903\u093A-\u094F\u0951-\u0957\u0962\u0963]/g;

const current = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[\u0964\u0965]/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(LOOSE_MARKS, "")
    .replace(/\s+/g, " ")
    .trim();

// marks removed FIRST, then punctuation stripped
const proposed = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[\u0964\u0965]/g, " ")
    .replace(LOOSE_MARKS, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const probes = [
  "मिर्ची", "मीरची", "मिर्ची पाउडर", "अंडे", "अंडा", "अंडे की करेट",
  "हल्दी", "हल्दी पाउडर", "नमक", "टाटा नमक", "चीनी", "शहद",
  "mirchi powder", "tata namak 1kg", "500gm", "crate", "Tata Namak, 1kg!",
];

console.log("input".padEnd(24), "current".padEnd(22), "proposed");
for (const p of probes) {
  console.log(`  ${p.padEnd(22)} ${JSON.stringify(current(p)).padEnd(20)} ${JSON.stringify(proposed(p))}`);
}

// collision check: does over-stripping merge different words?
console.log("\ncollision check (proposed must stay distinct):");
for (const [a, b] of [["अंडा", "अंडे"], ["मिर्ची", "मीरची"], ["नमक", "नमकीन"], ["चीनी", "चीनी मधुर"]]) {
  console.log(`  ${a} -> ${JSON.stringify(proposed(a))}   ${b} -> ${JSON.stringify(proposed(b))}   same=${proposed(a) === proposed(b)}`);
}
