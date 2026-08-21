"use client";

import { useState } from "react";

type Props = {
  token: string;
  fileName: string;
};

export function DownloadReceiptPdfButton({ token, fileName }: Props) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/public/receipts/${token}/pdf`);
      if (!res.ok) {
        throw new Error("Could not create PDF");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError("Download failed. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="receipt-no-print flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={download}
        disabled={pending}
        className="inline-flex items-center justify-center rounded-xl bg-accent px-4 py-3 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-60"
      >
        {pending ? "Preparing PDF…" : "Download PDF"}
      </button>
      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </div>
  );
}
