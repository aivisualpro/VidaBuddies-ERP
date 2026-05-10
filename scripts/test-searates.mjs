// Quick script to fetch raw SeaRates JSON for a container number
// Usage: node scripts/test-searates.mjs OTPU6113983

const API_KEY = "K-9642B22F-3873-4518-A9CD-80487F0C29E4";
const containerNo = process.argv[2] || "OTPU6113983";

const url = `https://tracking.searates.com/tracking?api_key=${encodeURIComponent(API_KEY)}&number=${encodeURIComponent(containerNo)}&route=true&ais=true`;

console.log(`\n🔍 Fetching SeaRates data for: ${containerNo}`);
console.log(`📡 URL: ${url.replace(API_KEY, 'REDACTED')}\n`);

try {
  const res = await fetch(url);
  const json = await res.json();
  console.log(JSON.stringify(json, null, 2));
} catch (err) {
  console.error("Error:", err.message);
}
