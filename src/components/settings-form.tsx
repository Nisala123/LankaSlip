"use client";

import { FormEvent, useState } from "react";

type Settings = {
  shopName: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  branch: string;
  lankaQrPayload: string;
};

export function SettingsForm({ initial }: { initial: Settings }) {
  const [form, setForm] = useState(initial);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setSaved(false);
    setError(null);
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setPending(false);
    if (!res.ok) {
      setError("Could not save settings");
      return;
    }
    setSaved(true);
  }

  function field(
    key: keyof Settings,
    label: string,
    extra?: { textarea?: boolean },
  ) {
    const shared = {
      value: form[key],
      onChange: (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
      ) => setForm((current) => ({ ...current, [key]: e.target.value })),
      className:
        "mt-1 w-full rounded-xl border border-line bg-background px-3 py-3 outline-none focus:border-accent",
    };
    return (
      <label className="block text-sm">
        {label}
        {extra?.textarea ? (
          <textarea rows={4} {...shared} />
        ) : (
          <input {...shared} />
        )}
      </label>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-2xl bg-card p-4">
      <h2 className="text-lg font-semibold">Shop & bank details</h2>
      <p className="text-sm text-muted">
        Pending receipts show these details and a QR on the customer page.
      </p>
      {field("shopName", "Shop name")}
      {field("bankName", "Bank")}
      {field("branch", "Branch")}
      {field("accountName", "Account name")}
      {field("accountNumber", "Account number")}
      {field("lankaQrPayload", "Static LankaQR payload (optional)", {
        textarea: true,
      })}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {saved ? <p className="text-sm text-accent">Saved.</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-accent py-3 font-medium text-white hover:bg-accent-hover disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
