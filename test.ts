import mongoose from "mongoose";
import VidaPO from "./lib/models/VidaPO";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

mongoose.connect(process.env.MONGODB_URI as string).then(async () => {
  const po = await VidaPO.findById("69f33bb4222856bacc5f4b01").lean();
  console.log(JSON.stringify(po?.customerPO || [], null, 2));
  process.exit(0);
});
