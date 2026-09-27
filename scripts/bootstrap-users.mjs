import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Load .env.local before running this script.");
const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
const users = [
  { email: "techbuzzs@gmail.com", password: process.env.BOOTSTRAP_SUPERUSER_PASSWORD, username: "techbuzzs", role: "superuser" },
  { email: "admin@example.local", password: process.env.BOOTSTRAP_ADMIN_PASSWORD, username: "admin", role: "admin" },
  { email: "basic@example.local", password: process.env.BOOTSTRAP_BASIC_PASSWORD, username: "basic", role: "basic" },
];
for (const user of users) {
  if (!user.password) throw new Error(`Missing bootstrap password for ${user.username}`);
  const { data: found } = await admin.auth.admin.listUsers({ perPage: 1000 });
  let account = found?.users.find((item) => item.email === user.email);
  if (!account) {
    const { data, error } = await admin.auth.admin.createUser({ email: user.email, password: user.password, email_confirm: true, user_metadata: { username: user.username } });
    if (error) throw error;
    account = data.user;
  }
  const { error } = await admin.from("profiles").upsert({ id: account.id, username: user.username, role: user.role });
  if (error) throw error;
  console.log(`ready: ${user.username} (${user.role})`);
}
