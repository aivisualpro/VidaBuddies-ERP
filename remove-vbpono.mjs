import { readFileSync } from "fs";
import { MongoClient } from "mongodb";

// Parse .env file manually
const envContent = readFileSync(".env", "utf-8");
const envVars = {};
envContent.split("\n").forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) envVars[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, "");
});

const uri = envVars.MONGODB_URI;
if (!uri) { console.error("Missing MONGODB_URI in .env"); process.exit(1); }

async function run() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    console.log("Connected to MongoDB.");
    const db = client.db();

    // Step 1: Check how many docs have vbpoNo
    const total = await db.collection("vidapos").countDocuments({});
    const withVbpoNo = await db.collection("vidapos").countDocuments({ vbpoNo: { $exists: true } });
    console.log(`\nTotal vidapos docs: ${total}`);
    console.log(`Docs with vbpoNo field: ${withVbpoNo}`);

    // Step 2: Safety check — ensure every doc with vbpoNo also has VBNumber
    const missingVBNumber = await db.collection("vidapos").countDocuments({
      vbpoNo: { $exists: true },
      $or: [{ VBNumber: { $exists: false } }, { VBNumber: "" }, { VBNumber: null }]
    });

    if (missingVBNumber > 0) {
      console.log(`\n⚠️  ${missingVBNumber} docs have vbpoNo but NO VBNumber!`);
      console.log("Copying vbpoNo → VBNumber for those docs first...");
      
      const cursor = db.collection("vidapos").find({
        vbpoNo: { $exists: true, $ne: "" },
        $or: [{ VBNumber: { $exists: false } }, { VBNumber: "" }, { VBNumber: null }]
      });

      let copied = 0;
      for await (const doc of cursor) {
        await db.collection("vidapos").updateOne(
          { _id: doc._id },
          { $set: { VBNumber: doc.vbpoNo } }
        );
        copied++;
      }
      console.log(`✅ Copied vbpoNo → VBNumber for ${copied} docs`);
    } else {
      console.log("✅ All docs with vbpoNo also have VBNumber — safe to remove.");
    }

    // Step 3: Remove vbpoNo field from ALL docs
    const result = await db.collection("vidapos").updateMany(
      { vbpoNo: { $exists: true } },
      { $unset: { vbpoNo: "" } }
    );
    console.log(`\n✅ Removed vbpoNo from ${result.modifiedCount} docs.`);

    // Step 4: Drop any index on vbpoNo if it exists
    try {
      const indexes = await db.collection("vidapos").indexes();
      for (const idx of indexes) {
        if (idx.key && idx.key.vbpoNo !== undefined) {
          console.log(`Dropping index: ${idx.name}`);
          await db.collection("vidapos").dropIndex(idx.name);
        }
      }
    } catch (e) {
      // No vbpoNo index to drop
    }

    console.log("\n━━━ Done ━━━");
    console.log("vbpoNo field has been completely removed from vidapos collection.");

  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await client.close();
    process.exit(0);
  }
}

run();
