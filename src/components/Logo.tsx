import Image from "next/image";
import logo from "../../public/marca/logo.png";

// El logo va siempre sobre fondo oscuro (regla 5 de contraste del diseño).
export function Logo({ ancho, prioridad = false, className }: { ancho: number; prioridad?: boolean; className?: string }) {
  return (
    <Image
      src={logo}
      alt="Global Padel Center"
      width={ancho}
      height={Math.round((ancho * logo.height) / logo.width)}
      priority={prioridad}
      className={className}
      style={{ height: "auto" }}
    />
  );
}
