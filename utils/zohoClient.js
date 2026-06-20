import axios from "axios";
import { API_BASE, getAccessToken, getAccountId } from "./zohoAuth.js";

export async function zohoPost(path, body) {
  const token = await getAccessToken();
  const accountId = getAccountId();

  if (!accountId) {
    throw new Error("ZOHO_ACCOUNT_ID is not configured");
  }

  const separator = path.includes("?") ? "&" : "?";
  const url = `${API_BASE}${path}${separator}account_id=${accountId}`;

  const response = await axios.post(url, body, {
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      "Content-Type": "application/json",
    },
  });

  return response.data;
}
