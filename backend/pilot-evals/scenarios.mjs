/**
 * Phase 1 scenario corpus.
 *
 * Written the way a distributor actually talks to the shop over the phone:
 * Hindi, Hinglish, local pronunciation, no punctuation, quantities repeated and
 * revised mid-sentence, brands named, weights converted, and products the shop
 * does not stock.
 *
 * `expect` is the ground truth a supplier would write on the docket. It is
 * deliberately only asserted where the call is genuinely unambiguous, so a
 * failure means a real defect rather than a debatable reading of the sentence.
 *
 * `soft` marks expectations worth measuring but not worth failing on, because a
 * human reading the same call could reasonably decide the other way.
 */

export const SCENARIOS = [
  {
    id: "hindi-multi-variant",
    title: "Hindi, several products, weights and two packs of the same thing",
    covers: ["hindi", "multiple products", "quantities", "units", "different variants"],
    transcript:
      "हेलो भाई, सुबह का ऑर्डर ले लो। मधुर की चीनी एक किलो वाला चार ले आना, " +
      "और पांच सौ ग्राम वाला दो। टाटा नमक एक किलो का दो पैकेट। " +
      "और डाबर शहद पांच सौ ग्राम वाला तीन। बस इतना ही है।",
    expect: {
      items: [
        { product: "चीनी", quantity: 4, variant: "1kg", company: "मधुर" },
        { product: "चीनी", quantity: 2, variant: "500gm", company: "मधुर" },
        { product: "नमक", quantity: 2, variant: "1kg", company: "टाटा" },
        { product: "शहद", quantity: 3, variant: "500gm", company: "डाबर शहद" },
      ],
      unresolved: [],
    },
  },
  {
    id: "hinglish-two-brands",
    title: "Hinglish, same product requested under two different brands",
    covers: ["hinglish", "different companies/brands", "different variants"],
    transcript:
      "Namak chahiye bhai, Tata wala ek kilo paanch packet, aur Surya brand ka " +
      "same ek kilo do packet. Aur MDH haldi powder paanch sau gram wala chaar packet.",
    expect: {
      items: [
        { product: "नमक", quantity: 5, variant: "1kg", company: "टाटा" },
        { product: "नमक", quantity: 2, variant: "1kg", company: "सूर्य" },
        { product: "हल्दी पाउडर", quantity: 4, variant: "500gm", company: "MDH" },
      ],
      unresolved: [],
    },
  },
  {
    id: "repeated-no-initial-quantity",
    title:
      "The real recording's failure: product named with no quantity, then counted twice",
    covers: ["repeated products", "quantities", "local pronunciation"],
    transcript:
      "भाई अंडे की करेट ले आना। और अंडे की करेट दो ले आना। और अंडे की करेट तीन। बस।",
    expect: {
      // 2 + 3. The unquantified opening mention must add nothing.
      items: [{ product: "अंडे", quantity: 5, variant: "Tray(30 pc)", company: "सफेद अंडा" }],
      unresolved: [],
    },
  },
  {
    id: "quantity-corrected-mid-sentence",
    title: "Customer changes their mind mid-sentence",
    covers: ["corrections", "customers changing their mind mid-sentence", "quantities"],
    transcript:
      "मिर्ची पाउडर एमडीएच का दो सौ ग्राम वाला चार ले आना, नहीं नहीं, मतलब पांच ले आना। " +
      "और हल्दी पाउडर एमडीएच का दो सौ ग्राम... रुको, एक सौ ग्राम वाला दो ले आना।",
    expect: {
      items: [
        { product: "मिर्ची पाउडर", quantity: 5, variant: "200gm", company: "MDH" },
        { product: "हल्दी पाउडर", quantity: 2, variant: "100gm", company: "MDH" },
      ],
      unresolved: [],
    },
  },
  {
    id: "added-not-corrected",
    title: "A repeat that adds rather than replaces must be summed",
    covers: ["repeated products", "quantities"],
    transcript:
      "चीनी मधुर की एक किलो वाला दो ले आना, और दो और ले आना।",
    expect: {
      items: [{ product: "चीनी", quantity: 4, variant: "1kg", company: "मधुर" }],
      unresolved: [],
    },
  },
  {
    id: "unknown-products",
    title: "Products the shop does not stock must be flagged, never guessed",
    covers: ["unknown products", "unresolved items"],
    transcript:
      "भाई अमूल दूध पांच पैकेट ले आना, और त्रिशूल चाय पत्ती दो पैकेट दो सौ पचास ग्राम वाली। " +
      "और मधुर चीनी एक किलो दो।",
    expect: {
      items: [{ product: "चीनी", quantity: 2, variant: "1kg", company: "मधुर" }],
      unresolved: ["doodh", "chai"],
    },
  },
  {
    id: "quantity-never-stated",
    title: "A product named but never counted must block, not default to one",
    covers: ["quantities", "unresolved items"],
    transcript: "भाई टाटा नमक ले आना, एक किलो वाला। और डाबर शहद भी ले आना।",
    expect: {
      // Neither product was counted. Both have to come through as unknown and
      // stop the draft from being confirmable rather than defaulting to 1.
      mustBlock: true,
      items: [
        { product: "नमक", variant: "1kg", company: "टाटा", quantity: null },
        { product: "शहद", company: "डाबर शहद", quantity: null },
      ],
    },
  },
  {
    id: "not-an-order",
    title: "A call that is not an order must produce no lines",
    covers: ["unrelated small talk"],
    transcript:
      "हेलो भाई, क्या हाल है? बरसात का मौसम है, बहुत गर्मी लग रही है। " +
      "कल शाम को फिर बात करते हैं।",
    expect: { isOrderIntent: false, items: [], unresolved: [] },
  },
  {
    id: "mixed-hindi-english-heavily",
    title: "Code-switched every sentence, brands and weights in English digits",
    covers: ["hinglish", "local pronunciation", "quantities", "units"],
    transcript:
      "Bhaiya ek kaam hai, MDH mirchi powder 100gm wala do packet aur 500gm wala ek packet. " +
      "Same hi MDH ka haldi powder 250gm wala teen packet. Aur chini Madhur 500gm do, 1kg ek. " +
      "Salt Tata 1kg paanch. Bas itna hi, ho gaya.",
    expect: {
      items: [
        { product: "मिर्ची पाउडर", quantity: 2, variant: "100gm", company: "MDH" },
        { product: "मिर्ची पाउडर", quantity: 1, variant: "500gm", company: "MDH" },
        { product: "हल्दी पाउडर", quantity: 3, variant: "250gm", company: "MDH" },
        { product: "चीनी", quantity: 2, variant: "500gm", company: "मधुर" },
        { product: "चीनी", quantity: 1, variant: "1kg", company: "मधुर" },
        { product: "नमक", quantity: 5, variant: "1kg", company: "टाटा" },
      ],
      unresolved: [],
    },
  },
  {
    id: "ambiguous-similar-names",
    title: "Two similar-sounding products, the caller does not say which",
    covers: ["ambiguous products", "local pronunciation"],
    transcript: "भाई वो मिरिच वाला पाउडर ले आना, दो सौ ग्राम का, एमडीएच का।",
    expect: {
      // Unambiguous product, so it should resolve; the point of the case is that
      // the local spelling "मिरिच" still reaches the right product.
      items: [{ product: "मिर्ची पाउडर", quantity: 1, variant: "200gm", company: "MDH" }],
      unresolved: [],
    },
  },
];
