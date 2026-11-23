import { connection, NextResponse, type NextRequest } from "next/server";
import { obtenerDisponibilidad } from "@/lib/datos-publicos";
import { esFechaISO } from "@/lib/tiempo";

// Refresco de la grilla pública cada 30 s. La garantía contra la doble reserva
// está en la base al insertar; esto es solo para que el jugador vea lo último.
export async function GET(request: NextRequest) {
  await connection();
  const fecha = request.nextUrl.searchParams.get("fecha");
  if (!esFechaISO(fecha)) {
    return NextResponse.json({ error: "fecha inválida" }, { status: 400 });
  }
  try {
    const turnos = await obtenerDisponibilidad(fecha);
    return NextResponse.json({ turnos }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "no disponible" }, { status: 502 });
  }
}
