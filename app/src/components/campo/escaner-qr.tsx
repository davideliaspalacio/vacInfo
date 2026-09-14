"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Camera, CameraOff, X } from "lucide-react";

type Detector = { detect(fuente: HTMLVideoElement): Promise<{ rawValue: string }[]> };
type ConstructorDetector = new (opciones: { formats: string[] }) => Detector;

const obtenerDetector = () => (window as unknown as { BarcodeDetector?: ConstructorDetector }).BarcodeDetector;
const suscribir = () => () => {};
const hayCamara = () => Boolean(obtenerDetector() && navigator.mediaDevices?.getUserMedia);

/** El QR de la chapeta trae el código del animal (TON-2079), la chapeta o un enlace a su ficha. */
export function leerCodigoChapeta(valor: string): { animalId: string | null; codigo: string } {
  const texto = valor.trim();
  const animalId = texto.match(/\/campo\/animal\/([0-9a-f-]{36})/i)?.[1] ?? texto.match(/[?&]animal=([0-9a-f-]{36})/i)?.[1] ?? null;
  const codigo = texto.split(/[/?#=&]/).filter(Boolean).pop() ?? texto;
  return { animalId, codigo };
}

/** Lee el QR de la chapeta con la cámara. Funciona sin señal: no necesita internet. */
export function EscanerChapeta({ alLeer, alCancelar }: { alLeer: (valor: string) => void; alCancelar: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const alLeerActual = useRef(alLeer);
  const soportado = useSyncExternalStore(suscribir, hayCamara, () => null);
  const [estado, setEstado] = useState<"iniciando" | "escaneando" | "sin-permiso" | "encontrado">("iniciando");

  useEffect(() => {
    alLeerActual.current = alLeer;
  });

  useEffect(() => {
    if (!soportado) return;
    const Detector = obtenerDetector()!;
    const detector = new Detector({ formats: ["qr_code"] });
    let activo = true;
    let flujo: MediaStream | undefined;
    let temporizador: number | undefined;

    const buscar = async () => {
      if (!activo || !video.current) return;
      try {
        const [codigo] = await detector.detect(video.current);
        if (codigo?.rawValue) {
          activo = false;
          setEstado("encontrado");
          flujo?.getTracks().forEach((pista) => pista.stop());
          alLeerActual.current(codigo.rawValue);
          return;
        }
      } catch {
        // El cuadro aún no está listo; se intenta de nuevo.
      }
      temporizador = window.setTimeout(buscar, 250);
    };

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" }, audio: false })
      .then(async (stream) => {
        flujo = stream;
        if (!activo || !video.current) return stream.getTracks().forEach((pista) => pista.stop());
        video.current.srcObject = stream;
        await video.current.play();
        setEstado("escaneando");
        buscar();
      })
      .catch(() => activo && setEstado("sin-permiso"));

    return () => {
      activo = false;
      window.clearTimeout(temporizador);
      flujo?.getTracks().forEach((pista) => pista.stop());
    };
  }, [soportado]);

  if (soportado === false || estado === "sin-permiso") {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
        <CameraOff className="mb-3 h-7 w-7" aria-hidden />
        <p className="font-bold">{estado === "sin-permiso" ? "No pudimos usar la cámara." : "Este celular o navegador no permite escanear la chapeta desde aquí."}</p>
        <p className="mt-1 text-sm">
          {estado === "sin-permiso"
            ? "Revisa que diste permiso a la cámara e inténtalo de nuevo."
            : "Prueba con Chrome en Android o escribe el número que aparece en la chapeta."}
        </p>
        <button type="button" onClick={alCancelar} className="mt-4 inline-flex min-h-12 items-center rounded-xl bg-amber-900 px-4 font-bold text-white">
          Escribir la chapeta
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="relative aspect-square overflow-hidden rounded-3xl bg-slate-900">
        <video ref={video} muted playsInline className="h-full w-full object-cover" />
        <div className="pointer-events-none absolute inset-[18%] rounded-3xl border-4 border-white/80 shadow-[0_0_0_999px_rgba(15,23,42,0.35)]" aria-hidden />
        {estado !== "escaneando" && (
          <div className="absolute inset-0 grid place-items-center text-white">
            <span className="flex items-center gap-2 font-bold">
              <Camera className="h-5 w-5 animate-pulse" aria-hidden />
              {estado === "encontrado" ? "Chapeta leída" : "Encendiendo la cámara…"}
            </span>
          </div>
        )}
      </div>
      <p className="mt-3 text-center text-sm text-slate-600" aria-live="polite">
        Apunta la cámara al código QR de la chapeta.
      </p>
      <button
        type="button"
        onClick={alCancelar}
        className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white font-bold text-slate-700"
      >
        <X className="h-5 w-5" aria-hidden />
        Cerrar cámara
      </button>
    </div>
  );
}
