// Envío por SMTP de Gmail con una contraseña de aplicación.
// Sirve para mandar a cualquier dirección sin tener dominio propio (Resend sin dominio
// solo entrega al mail del dueño de la cuenta). Límites: ~500 mails por día en una
// cuenta personal de Gmail, y algunos pueden caer en spam.
//
// Puerto 465 (TLS directo): Supabase bloquea las salidas por los puertos 25 y 587.
import nodemailer from "npm:nodemailer@7.0.13";
import type { EnviarMail } from "./procesar.ts";

export function enviarConGmail(usuario: string, contrasenaApp: string, nombre: string, responderA?: string): EnviarMail {
  const transporte = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    // Google muestra la contraseña de aplicación en grupos con espacios: se aceptan igual
    auth: { user: usuario, pass: contrasenaApp.replace(/\s+/g, "") },
  });
  const dominio = usuario.split("@")[1] ?? "gmail.com";
  return async ({ para, asunto, html, texto, idempotencia }) => {
    const info = await transporte.sendMail({
      // Gmail siempre manda desde la cuenta autenticada; acá solo elegimos el nombre visible
      from: { name: nombre, address: usuario },
      to: para,
      subject: asunto,
      html,
      text: texto,
      // Message-ID fijo por notificación: ayuda a que un reintento no llegue duplicado
      messageId: `<${idempotencia}@${dominio}>`,
      ...(responderA ? { replyTo: responderA } : {}),
    });
    return { id: info.messageId ?? idempotencia };
  };
}
