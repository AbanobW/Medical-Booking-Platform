/** Proves free-text search really reaches into each provider's service catalogue. */
import { searchProviders } from "../src/lib/api/providers";

const CASES: [string, "doctor" | "lab" | "radiology", string][] = [
  ["MRI", "radiology", "scan name"],
  ["CT Brain", "radiology", "multi-word scan name"],
  ["Vitamin D", "lab", "test name"],
  ["CBC", "lab", "test abbreviation"],
  ["Cardiology", "doctor", "specialty name"],
  ["أشعة", "radiology", "Arabic scan term"],
  ["صورة دم", "lab", "Arabic test term"],
];

async function main() {
  let failed = false;

  for (const [q, type, what] of CASES) {
    const result = await searchProviders({ q, type });
    const hit = result.total > 0;
    console.log(`${hit ? "✓" : "✗"} "${q}" (${what}, ${type}) → ${result.total} providers`);
    if (!hit) failed = true;
  }

  // A nonsense term must return nothing — proves we aren't matching everything.
  const junk = await searchProviders({ q: "zzzznotathing" });
  console.log(`${junk.total === 0 ? "✓" : "✗"} nonsense query → ${junk.total} (expected 0)`);
  if (junk.total !== 0) failed = true;

  console.log(
    failed
      ? "\n❌ search gaps found"
      : "\n✅ catalogue search works across names, abbreviations and Arabic",
  );
  if (failed) process.exit(1);
}

main();
