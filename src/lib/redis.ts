import { Redis } from "@upstash/redis";

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

if (!url || !token) {
  // We log a warning instead of throwing, so that build steps or environments
  // without Redis don't crash unless they actually try to invoke Redis commands.
  console.warn("Warning: UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN is not defined.");
}

export const redis = new Redis({
  url: url || "",
  token: token || "",
});
