import { SCENARIOS } from "./scenarios.mjs";

const s = SCENARIOS[0];
const got = [
  { productName: "चीनी", variantMeasurement: "1kg" },
  { productName: "चीनी", variantMeasurement: "500gm" },
  { productName: "नमक", variantMeasurement: "1kg" },
  { productName: "शहद", variantMeasurement: "500gm" },
];

const codes = (v) => [...String(v)].map((c) => c.codePointAt(0).toString(16)).join(" ");

for (let i = 0; i < 4; i += 1) {
  const want = s.expect.items[i];
  console.log(`--- ${i} ---`);
  console.log(`  want product: ${JSON.stringify(want.product)} [${codes(want.product)}]`);
  console.log(`  got  product: ${JSON.stringify(got[i].productName)} [${codes(got[i].productName)}]`);
  console.log(`  equal: ${want.product === got[i].productName}`);
  console.log(`  want variant: ${JSON.stringify(want.variant)}  got: ${JSON.stringify(got[i].variantMeasurement)}`);
}
