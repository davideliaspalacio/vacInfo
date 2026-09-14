import { Suspense } from "react";
import type { Metadata } from "next";
import { Registro } from "@/components/offline/registro";

export const metadata: Metadata = { title: { absolute: "Registrar · VacDaTa" } };

export default function RegistrarPage() {
  return (
    <Suspense>
      <Registro />
    </Suspense>
  );
}
