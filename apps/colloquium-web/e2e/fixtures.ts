import jwt from "jsonwebtoken";

// Must match uat-seed-server.ts constants exactly
export const UAT_SECRET = "uat-secret-2026";
export const UAT_CHANNEL_ID = "ch-uat-001";
export const UAT_MEMBER_ID = "uat-user-1";
export const UAT_TOKEN = jwt.sign({ sub: UAT_MEMBER_ID }, UAT_SECRET);
export const CHANNEL_URL = `/channels/${UAT_CHANNEL_ID}?token=${UAT_TOKEN}`;
