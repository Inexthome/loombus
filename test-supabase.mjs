import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const env = fs.readFileSync(".env.local", "utf8");

for (const line of env.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const [key, ...valueParts] = trimmed.split("=");
  process.env[key] = valueParts.join("=");
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.error("FAIL: Missing Supabase URL or anon key in .env.local");
  process.exit(1);
}

const supabase = createClient(url, anonKey);

const { data, error } = await supabase.auth.getSession();

if (error) {
  console.error("FAIL: Supabase connection error:", error.message);
  process.exit(1);
}

console.log("PASS: Supabase client connected.");
console.log("Session:", data.session ? "active" : "none");
