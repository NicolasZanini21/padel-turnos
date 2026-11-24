import { Suspense } from "react";
import { BotonWhatsapp } from "@/components/BotonWhatsapp";
import { Encabezado, Pie } from "@/components/Encabezado";

export default function LayoutPublico({ children }: LayoutProps<"/">) {
  return (
    <>
      <Encabezado />
      {/* pb extra para que el botón flotante no tape el final de la página */}
      <div className="flex flex-1 flex-col pb-20 sm:pb-0">{children}</div>
      <Pie />
      <Suspense fallback={null}>
        <BotonWhatsapp />
      </Suspense>
    </>
  );
}
