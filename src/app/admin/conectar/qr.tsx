"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";

export function QrCode({ value }: { value: string }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(value, { width: 220, margin: 1 })
      .then((url) => {
        if (alive) setDataUrl(url);
      })
      .catch(() => {
        if (alive) setDataUrl(null);
      });
    return () => {
      alive = false;
    };
  }, [value]);

  if (!dataUrl) return <p className="text-sm text-gray-500">Generando código…</p>;
  // Es una imagen de datos (base64), next/image no aporta nada acá.
  return <img src={dataUrl} alt={`Código QR para abrir ${value}`} width={220} height={220} />;
}
