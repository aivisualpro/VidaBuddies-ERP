const mongoose = require("mongoose");
const VidaPO = require("./lib/models/VidaPO").default;
require("dotenv").config({ path: ".env.local" });

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const po = await VidaPO.findById("69f33bb4222856bacc5f4b01").lean();
  console.log(JSON.stringify(po.customerPO, null, 2));
  process.exit(0);
});
