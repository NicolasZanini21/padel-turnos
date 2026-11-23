#!/usr/bin/env node
// Crea (o habilita) un usuario admin del panel.
// Uso:
//   SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=... \
//     node scripts/crear-admin.mjs encargado@club.com 'contraseña-larga'
// La service role key se usa solo acá, desde tu computadora. Nunca va en Vercel.
import { createClient } from "@supabase/supabase-js";

const [email, password] = process.argv.slice(2);
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!email || !password || !url || !key) {
  console.error("Uso: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/crear-admin.mjs <mail> <contraseña>");
  process.exit(1);
}
if (password.length < 10) {
  console.error("Usá una contraseña de al menos 10 caracteres.");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

let userId;
const creado = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
if (creado.error) {
  // Si ya existe, se lo busca y se le actualiza la contraseña
  const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  const existente = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!existente) throw creado.error;
  userId = existente.id;
  const upd = await supabase.auth.admin.updateUserById(userId, { password });
  if (upd.error) throw upd.error;
  console.log("El usuario ya existía: se actualizó la contraseña.");
} else {
  userId = creado.data.user.id;
}

const { error } = await supabase.from("admins").upsert({ user_id: userId, email });
if (error) throw error;
console.log(`Listo: ${email} es admin del panel.`);
