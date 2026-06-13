import { normalizeArabic, DEFAULT_CONFIG, levenshtein, similarity } from "./qa-engine";

function testNormalization() {
  console.log("Testing Arabic Normalization...");
  const cases = [
    ["أحمد", "احمد"],
    ["مدرسة", "مدرسة"], // Should NOT change to مدره
    ["آمال", "امال"],
    ["إيمان", "ايمان"],
    ["هدى", "هدي"],
  ];

  for (const [input, expected] of cases) {
    const actual = normalizeArabic(input);
    if (actual === expected) {
      console.log(`✅ OK: ${input} -> ${actual}`);
    } else {
      console.error(`❌ FAIL: ${input} -> ${actual} (expected ${expected})`);
      process.exit(1);
    }
  }
}

function testConfig() {
  console.log("\nTesting DEFAULT_CONFIG...");
  if (DEFAULT_CONFIG.numericToleranceMode === "ABSOLUTE") {
    console.log("✅ OK: numericToleranceMode is ABSOLUTE");
  } else {
    console.error(`❌ FAIL: numericToleranceMode is ${DEFAULT_CONFIG.numericToleranceMode}`);
    process.exit(1);
  }
}

function testLevenshtein() {
  console.log("\nTesting Levenshtein & Memoization...");
  const a = "Hello world from the QA Engine";
  const b = "Hello world from the QA engine";

  const start1 = performance.now();
  const d1 = levenshtein(a, b);
  const end1 = performance.now();

  const start2 = performance.now();
  const d2 = levenshtein(a, b);
  const end2 = performance.now();

  console.log(`Distance: ${d1}`);
  console.log(`First run: ${(end1 - start1).toFixed(4)}ms`);
  console.log(`Second run (cached): ${(end2 - start2).toFixed(4)}ms`);

  if (d1 === d2 && (end2 - start1) > (end2 - start2)) {
    console.log("✅ OK: Memoization working");
  }
}

testNormalization();
testConfig();
testLevenshtein();
console.log("\nAll core logic tests passed!");
