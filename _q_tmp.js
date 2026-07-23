const mongoose = require('mongoose');
require('dotenv').config();
(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  const po = await db.collection('vidapos').findOne({ VBNumber: 'VB504' }, { projection: { _id: 1, VBNumber: 1 } });
  console.log('PO:', po?._id?.toString(), po?.VBNumber);
  const ships = await db.collection('vbshippings').find({ VBNumber: po._id }, { projection: { VBShipmentNumber: 1, svbid: 1, VBSerialNumber: 1 } }).limit(8).toArray();
  console.log('SHIPS (VBShipmentNumber | svbid):');
  ships.forEach(s => console.log('  ', JSON.stringify(s.VBShipmentNumber), '|', JSON.stringify(s.svbid)));
  const cpos = await db.collection('vbcustomerpos').find({ VBNumber: po._id }, { projection: { VBSerialNumber: 1, poNo: 1 } }).limit(5).toArray();
  console.log('CPOS (VBSerialNumber | poNo):');
  cpos.forEach(c => console.log('  ', JSON.stringify(c.VBSerialNumber), '|', JSON.stringify(c.poNo)));
  await mongoose.disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
