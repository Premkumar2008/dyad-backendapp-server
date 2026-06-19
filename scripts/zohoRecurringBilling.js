import dotenv from "dotenv";
import { processDueSubscriptions } from "../utils/zohoRecurring.js";

dotenv.config();

const run = async () => {
  const result = await processDueSubscriptions(new Date());
  console.log(JSON.stringify({ success: true, ...result }, null, 2));
  process.exit(0);
};

run().catch((err) => {
  console.error("Zoho recurring billing failed:", err);
  process.exit(1);
});
