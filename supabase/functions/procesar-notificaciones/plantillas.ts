// Plantillas de los mails. Cuerpo claro (los clientes de correo rompen los fondos oscuros)
// con una franja oscura arriba para el logo, que solo se lee sobre fondo oscuro.
// Sin dependencias: se usa desde la Edge Function (Deno) y desde las pruebas (Node).

export type DatosMail = {
  tipo: "confirmacion" | "recordatorio" | "cancelacion";
  nombre: string;
  cancha: string;
  inicio: string;
  fin: string;
  precio_ars: number | null;
  motivo_cancelacion: string | null;
  cancelada_por: "usuario" | "admin" | "sistema" | null;
  link_reserva: string;
  link_cancelar: string;
  link_whatsapp: string;
  logo_url: string;
  sitio_url: string;
  puede_cancelar: boolean;
};

const ZONA = "America/Argentina/Buenos_Aires";
const C = {
  noche: "#0C1014",
  lima: "#AFE122",
  lima700: "#5B750F",
  azul600: "#0A6CB5",
  texto: "#1B2228",
  suave: "#56616B",
  borde: "#E3E7EA",
  fondo: "#F4F6F7",
};

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export function fechaLarga(iso: string) {
  const s = new Intl.DateTimeFormat("es-AR", { timeZone: ZONA, weekday: "long", day: "numeric", month: "long" }).format(new Date(iso));
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function hora(iso: string) {
  return new Intl.DateTimeFormat("es-AR", { timeZone: ZONA, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
}

function boton(texto: string, href: string, principal = true) {
  const estilo = principal
    ? `background:${C.lima};color:${C.noche};`
    : `background:#ffffff;color:${C.azul600};border:1px solid ${C.borde};`;
  return `<a href="${esc(href)}" style="${estilo}display:inline-block;padding:12px 20px;border-radius:10px;font-weight:700;text-decoration:none;font-size:15px">${esc(texto)}</a>`;
}

function marco(titulo: string, preheader: string, cuerpo: string, d: DatosMail) {
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only"><title>${esc(titulo)}</title></head>
<body style="margin:0;padding:0;background:${C.fondo};font-family:Arial,Helvetica,sans-serif;color:${C.texto}">
<span style="display:none!important;opacity:0;color:transparent;height:0;width:0;overflow:hidden">${esc(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.fondo}"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid ${C.borde}">
<tr><td align="center" style="background:${C.noche};padding:20px">
<a href="${esc(d.sitio_url)}"><img src="${esc(d.logo_url)}" width="120" alt="Global Padel Center" style="display:block;width:120px;height:auto;border:0"></a>
</td></tr>
<tr><td style="padding:28px 28px 8px">${cuerpo}</td></tr>
<tr><td style="padding:16px 28px 28px;font-size:13px;color:${C.suave};border-top:1px solid ${C.borde}">
Global Padel Center · Entre Ríos 542, Rosario<br>
¿Dudas? <a href="${esc(d.link_whatsapp)}" style="color:${C.azul600}">Escribinos por WhatsApp</a>
</td></tr>
</table></td></tr></table></body></html>`;
}

function detalle(d: DatosMail) {
  const precio =
    d.precio_ars != null
      ? `<tr><td style="padding:4px 0;color:${C.suave}">Precio</td><td style="padding:4px 0;font-weight:700">${new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(d.precio_ars)}</td></tr>`
      : "";
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:16px 0;font-size:15px;background:${C.fondo};border-radius:12px;padding:12px 16px">
<tr><td style="padding:4px 0;color:${C.suave};width:110px">Cancha</td><td style="padding:4px 0;font-weight:700">${esc(d.cancha)}</td></tr>
<tr><td style="padding:4px 0;color:${C.suave}">Día</td><td style="padding:4px 0;font-weight:700">${esc(fechaLarga(d.inicio))}</td></tr>
<tr><td style="padding:4px 0;color:${C.suave}">Horario</td><td style="padding:4px 0;font-weight:700">${hora(d.inicio)} a ${hora(d.fin)}</td></tr>
<tr><td style="padding:4px 0;color:${C.suave}">A nombre de</td><td style="padding:4px 0;font-weight:700">${esc(d.nombre)}</td></tr>
${precio}</table>`;
}

const h1 = (t: string) => `<h1 style="margin:0 0 8px;font-size:22px;line-height:1.3">${t}</h1>`;
const p = (t: string) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.5">${t}</p>`;

export function armarMail(d: DatosMail): { asunto: string; html: string; texto: string } {
  const cuando = `${fechaLarga(d.inicio).toLowerCase()} a las ${hora(d.inicio)}`;
  const nombre = esc(d.nombre.split(" ")[0]);

  if (d.tipo === "confirmacion") {
    const cuerpo =
      h1(`¡Tu turno está confirmado, ${nombre}!`) +
      p("Recibimos el pago. Te esperamos en el club.") +
      detalle(d) +
      `<p style="margin:20px 0">${boton("Ver mi reserva", d.link_reserva)}</p>` +
      p(`<span style="color:${C.suave};font-size:13px">Te mandamos un recordatorio 5 horas antes. Si no podés venir, cancelá desde <a href="${esc(d.link_cancelar)}" style="color:${C.azul600}">este link</a> así otra persona puede usar la cancha.</span>`);
    return {
      asunto: `Turno confirmado: ${d.cancha}, ${cuando}`,
      html: marco("Turno confirmado", `${d.cancha}, ${cuando}`, cuerpo, d),
      texto: `¡Tu turno está confirmado!\n${d.cancha} · ${fechaLarga(d.inicio)}, de ${hora(d.inicio)} a ${hora(d.fin)}\nA nombre de: ${d.nombre}\n\nVer o cancelar: ${d.link_reserva}`,
    };
  }

  if (d.tipo === "recordatorio") {
    const cancelar = d.puede_cancelar
      ? p(`<span style="color:${C.suave};font-size:13px">¿No podés venir? <a href="${esc(d.link_cancelar)}" style="color:${C.azul600}">Cancelá el turno</a> así se libera la cancha.</span>`)
      : p(`<span style="color:${C.suave};font-size:13px">¿No podés venir? Avisanos por WhatsApp.</span>`);
    const cuerpo =
      h1(`Hoy jugás, ${nombre}`) +
      p(`Te recordamos tu turno de hoy a las <strong>${hora(d.inicio)}</strong>.`) +
      detalle(d) +
      `<p style="margin:20px 0">${boton("Ver mi reserva", d.link_reserva)}</p>` +
      cancelar;
    return {
      asunto: `Recordatorio: hoy a las ${hora(d.inicio)} en ${d.cancha}`,
      html: marco("Recordatorio de turno", `Hoy a las ${hora(d.inicio)}`, cuerpo, d),
      texto: `Recordatorio: hoy a las ${hora(d.inicio)} tenés turno en ${d.cancha}.\nVer o cancelar: ${d.link_reserva}`,
    };
  }

  const porClub = d.cancelada_por === "admin";
  const motivo =
    porClub && d.motivo_cancelacion && d.motivo_cancelacion !== "rechazada por el club"
      ? p(`Motivo: ${esc(d.motivo_cancelacion)}`)
      : "";
  const cuerpo =
    h1(porClub ? "El club canceló tu turno" : "Cancelaste tu turno") +
    p(porClub ? "Lamentamos el inconveniente. Si tenés dudas, escribinos por WhatsApp." : "Listo, el turno quedó libre para otra persona.") +
    motivo +
    detalle(d) +
    `<p style="margin:20px 0">${boton("Reservar otro turno", d.sitio_url)}</p>`;
  return {
    asunto: `Turno cancelado: ${d.cancha}, ${cuando}`,
    html: marco("Turno cancelado", `${d.cancha}, ${cuando}`, cuerpo, d),
    texto: `${porClub ? "El club canceló tu turno" : "Cancelaste tu turno"}: ${d.cancha} · ${cuando}.\nReservá otro: ${d.sitio_url}`,
  };
}
