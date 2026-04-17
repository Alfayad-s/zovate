import axios from "axios";

import { getStoredAccessToken } from "./auth-storage";

const baseURL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

export const apiClient = axios.create({
  baseURL,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

apiClient.interceptors.request.use((config) => {
  const token = getStoredAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // Default Content-Type is application/json; multipart uploads need the boundary
  // only the browser/fetch layer can set — clear so FormData works (avatar, logos).
  if (typeof FormData !== "undefined" && config.data instanceof FormData) {
    const h = config.headers;
    if (typeof h.delete === "function") {
      h.delete("Content-Type");
    } else {
      delete (h as Record<string, unknown>)["Content-Type"];
    }
  }
  return config;
});
