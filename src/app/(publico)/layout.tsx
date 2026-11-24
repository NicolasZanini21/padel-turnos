import { Suspense } from "react";
import { BotonWhatsapp } from "@/components/BotonWhatsapp";
import { Encabezado, Pie } from "@/components/Encabezado";

export default function LayoutPublico({ children }: LayoutProps<"/">) {
  return (
    <>
      <Encabezado />
      <div className="flex flex-1 flex-col">{children}</div>
      <Pie />
      <Suspense fallback={null}>
        <BotonWhatsapp />
      </Suspense>
    </>
  );
}
