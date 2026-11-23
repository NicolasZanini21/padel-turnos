"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

function restante(hasta: string) {
  return Math.max(0, new Date(hasta).getTime() - Date.now());
}

export function CuentaRegresiva({ hasta }: { hasta: string }) {
  const router = useRouter();
  const [ms, setMs] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => {
      const r = restante(hasta);
      setMs(r);
      if (r === 0) {
        clearInterval(id);
        router.refresh();
      }
    };
    const primero = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(primero);
      clearInterval(id);
    };
  }, [hasta, router]);

  if (ms === null) return <p className="mt-1 h-9 font-titulo text-3xl font-extrabold text-estado-pendiente">&nbsp;</p>;

  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const dos = (n: number) => String(n).padStart(2, "0");

  return (
    <p
      className="mt-1 font-titulo text-3xl font-extrabold text-estado-pendiente tabular-nums"
      aria-label={`Quedan ${h} horas y ${m} minutos`}
    >
      {h > 0 ? `${h}:${dos(m)}:${dos(s)}` : `${dos(m)}:${dos(s)}`}
    </p>
  );
}
