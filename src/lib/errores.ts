// Códigos estables que devuelven las funciones de la base → mensajes para la UI
const MENSAJES: Record<string, string> = {
  horario_invalido: "Ese horario no existe en la grilla del club.",
  horario_ocupado: "Uy, alguien acaba de reservar ese turno. Elegí otro.",
  fuera_de_rango: "Ese turno ya no se puede reservar (ya empezó o está demasiado lejos).",
  demasiadas_pendientes: "Ya tenés reservas pendientes de pago con ese teléfono. Coordiná el pago de esas antes de hacer otra.",
  cancha_inactiva: "Esa cancha no está disponible.",
  datos_invalidos: "Revisá los datos del formulario.",
  no_encontrada: "No encontramos esa reserva.",
  ya_cancelada: "Esta reserva ya estaba cancelada.",
  vencida: "Esta reserva ya venció.",
  fuera_de_plazo: "Ya no se puede cancelar online. Escribinos por WhatsApp.",
  transicion_invalida: "Esa acción no se puede hacer sobre una reserva en este estado.",
  campo_inmutable: "No se puede mover una reserva: cancelala y creá otra.",
  no_autorizado: "No tenés permiso para hacer eso.",
};

export function codigoDeError(error: { message?: string; code?: string } | null | undefined): string {
  const m = error?.message ?? "";
  if (m in MENSAJES) return m;
  if (error?.code === "23P01") return "horario_ocupado";
  return "desconocido";
}

export function mensajeDeError(error: { message?: string; code?: string } | null | undefined): string {
  return MENSAJES[codigoDeError(error)] ?? "Algo salió mal. Probá de nuevo en un rato.";
}
