import Link from "next/link";
import { Encabezado, Pie } from "@/components/Encabezado";
import { Logo } from "@/components/Logo";
import { clasesBoton } from "@/components/ui";

export default function NoEncontrado() {
  return (
    <>
      <Encabezado />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 py-16 text-center">
        <Logo ancho={160} className="h-auto w-36" />
        <h1 className="mt-6 font-titulo text-2xl font-extrabold">No encontramos esta página</h1>
        <p className="mt-2 text-texto-suave">Puede que el link esté incompleto o que la reserva no exista.</p>
        <Link href="/" className={clasesBoton("primario", "mt-6")}>
          Ver turnos libres
        </Link>
      </main>
      <Pie />
    </>
  );
}
