import { MongoClient } from "mongodb";

const uri = "mongodb+srv://admin:hbgsYPMDLe-8p-@bookingx.qni27fu.mongodb.net/vidaBuddies?retryWrites=true&w=majority";
const client = new MongoClient(uri);

async function run() {
  await client.connect();
  const db = client.db("vidaBuddies");

  const pos = await db.collection("vidapos").find({}).toArray();
  const cpos = await db.collection("vbcustomerpos").find({}).toArray();
  const ships = await db.collection("vbshippings").find({}).toArray();

  console.log(`Total POs: ${pos.length}`);
  console.log(`Total standalone CPOs: ${cpos.length}`);
  console.log(`Total standalone Ships: ${ships.length}`);
  console.log("---");

  // Group CPOs by VBNumber (parent PO)
  const cposByPO = new Map();
  cpos.forEach(c => {
    const key = c.VBNumber?.toString() || "NONE";
    if (!cposByPO.has(key)) cposByPO.set(key, []);
    cposByPO.get(key).push(c);
  });

  // Group Ships by VBSerialNumber (parent CPO)
  const shipsByCPO = new Map();
  ships.forEach(s => {
    const key = s.VBSerialNumber?.toString() || "NONE";
    if (!shipsByCPO.has(key)) shipsByCPO.set(key, []);
    shipsByCPO.get(key).push(s);
  });

  console.log("PO merge analysis:");
  for (const po of pos) {
    const poId = po._id.toString();
    const standaloneCPOs = cposByPO.get(poId) || [];
    const embeddedCPOs = (po.customerPO || []).filter(c => c.poNo || c.VBSerialNumber || c.customer);
    
    let totalShipsFromStandalone = 0;
    standaloneCPOs.forEach(c => {
      const cpoId = c._id.toString();
      totalShipsFromStandalone += (shipsByCPO.get(cpoId) || []).length;
    });

    let embeddedShipCount = 0;
    embeddedCPOs.forEach(c => {
      embeddedShipCount += (c.shipping || []).filter(s => s.svbid || s.VBShipmentNumber || s.supplier).length;
    });

    const usedSource = standaloneCPOs.length > 0 ? "STANDALONE" : "EMBEDDED";
    const cpoCount = standaloneCPOs.length > 0 ? standaloneCPOs.length : embeddedCPOs.length;
    const shipCount = standaloneCPOs.length > 0 ? totalShipsFromStandalone : embeddedShipCount;

    // Count statuses
    let inTransit = 0, delivered = 0, planned = 0;
    const getShips = () => {
      if (standaloneCPOs.length > 0) {
        const result = [];
        standaloneCPOs.forEach(c => {
          (shipsByCPO.get(c._id.toString()) || []).forEach(s => result.push(s));
        });
        return result;
      }
      const result = [];
      embeddedCPOs.forEach(c => (c.shipping || []).forEach(s => result.push(s)));
      return result;
    };
    getShips().forEach(s => {
      const st = (s.status || "").toLowerCase().trim();
      if (st === 'in transit' || st === 'in_transit' || st === 'on water') inTransit++;
      else if (st === 'delivered' || st === 'arrived') delivered++;
      else if (st === 'planned' || st === 'booking confirmed') planned++;
    });

    console.log(`  ${po.VBNumber} (${poId}): source=${usedSource} CPOs=${cpoCount} Ships=${shipCount} Planned=${planned} InTransit=${inTransit} Delivered=${delivered}`);
  }

  await client.close();
}

run().catch(console.error);
