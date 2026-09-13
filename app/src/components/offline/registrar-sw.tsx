"use client";

import { useEffect } from "react";

export function RegistrarSW() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let cancelado = false;

    const registrar = async () => {
      try {
        const primeraVez = !navigator.serviceWorker.controller;
        await navigator.serviceWorker.register(process.env.NODE_ENV === "production" ? "/sw.js" : "/sw.js?modo=dev", {
          scope: "/",
          updateViaCache: "none",
        });
        const registro = await navigator.serviceWorker.ready;
        if (cancelado) return;
        // Lo que esta página cargó antes de que el service worker la controlara también debe quedar disponible sin señal.
        const urls = performance
          .getEntriesByType("resource")
          .map((e) => new URL(e.name))
          .filter((u) => u.origin === location.origin && u.pathname.startsWith("/_next/static/"))
          .map((u) => u.pathname + u.search);
        registro.active?.postMessage({ tipo: "precachear", urls, shell: primeraVez });
      } catch {
        // Sin service worker la app sigue funcionando en línea.
      }
    };

    if (document.readyState === "complete") void registrar();
    else window.addEventListener("load", registrar, { once: true });
    return () => {
      cancelado = true;
      window.removeEventListener("load", registrar);
    };
  }, []);

  return null;
}
