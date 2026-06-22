import axios from "axios";
import { API_BASE, getAccessToken, getAccountId } from "./zohoAuth.js";

const buildUrl = (path) => {
  const accountId = getAccountId();
  if (!accountId) {
    throw new Error("ZOHO_ACCOUNT_ID is not configured");
  }
  const separator = path.includes("?") ? "&" : "?";
  return `${API_BASE}${path}${separator}account_id=${accountId}`;
};

const zohoHeaders = async () => {
  const token = await getAccessToken();
  return {
    Authorization: `Zoho-oauthtoken ${token}`,
    "Content-Type": "application/json",
  };
};

export async function zohoPost(path, body) {
  const response = await axios.post(buildUrl(path), body, {
    headers: await zohoHeaders(),
  });
  return response.data;
}

export async function zohoGet(path) {
  const response = await axios.get(buildUrl(path), {
    headers: await zohoHeaders(),
  });
  return response.data;
}
