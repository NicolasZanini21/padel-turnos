export type EstadoReserva = "pendiente_pago" | "confirmada" | "cancelada" | "vencida";
export type OrigenReserva = "web" | "admin" | "fijo";
export type EstadoTurno = "libre" | "ocupado" | "no_disponible";

export type Turno = {
  cancha_id: number;
  cancha: string;
  inicio: string;
  fin: string;
  precio_ars: number | null;
  estado: EstadoTurno;
};

export type ConfigPublica = {
  nombre_club: string;
  whatsapp_numero: string;
  dias_max_anticipacion: number;
  ventana_gracia_minutos: number;
  limite_cancelacion_minutos: number;
  hoy: string;
};

export type ReservaPublica = {
  cancha: string;
  inicio: string;
  fin: string;
  estado: EstadoReserva;
  nombre: string;
  vence_en: string | null;
  precio_ars: number | null;
  origen: OrigenReserva;
  cancelada_por: "usuario" | "admin" | "sistema" | null;
  puede_cancelar: boolean;
};

export type Reserva = {
  id: string;
  cancha_id: number;
  inicio: string;
  fin: string;
  nombre: string;
  telefono: string;
  email: string | null;
  estado: EstadoReserva;
  origen: OrigenReserva;
  turno_fijo_id: number | null;
  precio_ars: number | null;
  token_gestion: string;
  creada_en: string;
  vence_en: string | null;
  confirmada_en: string | null;
  cancelada_en: string | null;
  cancelada_por: "usuario" | "admin" | "sistema" | null;
  motivo_cancelacion: string | null;
  notas_admin: string | null;
};

export const NOMBRE_ESTADO: Record<EstadoReserva, string> = {
  pendiente_pago: "Pendiente de pago",
  confirmada: "Confirmada",
  cancelada: "Cancelada",
  vencida: "Vencida",
};
