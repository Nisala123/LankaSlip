"use client";

import { FormEvent, useRef, useState } from "react";

export type SettingsFormValues = {
  shopName: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  contactPhone: string;
  contactEmail: string;
  website: string;
  receiptTitle: string;
  receiptFooter: string;
  authorizedBy: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  branch: string;
  lankaQrPayload: string;
};

export function SettingsForm({
  initial,
  hasLogo,
}: {
  initial: SettingsFormValues;
  hasLogo: boolean;
}) {
  const [form, setForm] = useState(initial);
  const [logoPresent, setLogoPresent] = useState(hasLogo);
  const [logoPreview, setLogoPreview] = useState(
    hasLogo ? "/api/settings/logo/preview" : null,
  );
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [logoPending, setLogoPending] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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

  async function onLogoSelected(file: File | null) {
    if (!file) return;
    setLogoPending(true);
    setError(null);
    const body = new FormData();
    body.set("logo", file);
    const res = await fetch("/api/settings/logo", { method: "POST", body });
    setLogoPending(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as
        | { error?: string }
        | null;
      setError(data?.error ?? "Could not upload logo");
      return;
    }
    setLogoPresent(true);
    setLogoPreview(`/api/settings/logo/preview?v=${crypto.randomUUID()}`);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function removeLogo() {
    setLogoPending(true);
    setError(null);
    const res = await fetch("/api/settings/logo", { method: "DELETE" });
    setLogoPending(false);
    if (!res.ok) {
      setError("Could not remove logo");
      return;
    }
    setLogoPresent(false);
    setLogoPreview(null);
  }

  function field(
    key: keyof SettingsFormValues,
    label: string,
    extra?: { textarea?: boolean; hint?: string },
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
          <textarea rows={3} {...shared} />
        ) : (
          <input {...shared} />
        )}
        {extra?.hint ? (
          <span className="mt-1 block text-xs text-muted">{extra.hint}</span>
        ) : null}
      </label>
    );
  }

  return (
    <div className="space-y-4">
      <section className="space-y-4 rounded-2xl bg-card p-4">
        <h2 className="text-lg font-semibold">Letterhead</h2>
        <p className="text-sm text-muted">
          Logo and company details appear at the top of every customer receipt.
        </p>
        <div className="flex items-start gap-4">
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl border border-line bg-background">
            {logoPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoPreview}
                alt="Shop logo"
                className="h-full w-full object-contain p-1"
              />
            ) : (
              <span className="px-2 text-center text-xs text-muted">No logo</span>
            )}
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="block w-full text-sm"
              disabled={logoPending}
              onChange={(e) => onLogoSelected(e.target.files?.[0] ?? null)}
            />
            <p className="text-xs text-muted">JPG, PNG, or WebP · max 2 MB</p>
            {logoPresent ? (
              <button
                type="button"
                disabled={logoPending}
                onClick={removeLogo}
                className="text-sm text-danger underline disabled:opacity-60"
              >
                Remove logo
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <form onSubmit={onSubmit} className="space-y-4 rounded-2xl bg-card p-4">
        <h2 className="text-lg font-semibold">Receipt template</h2>
        <p className="text-sm text-muted">
          Customize the payment receipt customers open and download as PDF.
        </p>
        {field("shopName", "Company / shop name")}
        {field("addressLine1", "Address line 1")}
        {field("addressLine2", "Address line 2")}
        {field("city", "City")}
        {field("contactPhone", "Phone")}
        {field("contactEmail", "Email")}
        {field("website", "Website")}
        {field("receiptTitle", "Receipt heading", {
          hint: 'Default: "PAYMENT RECEIPT"',
        })}
        {field("receiptFooter", "Footer message", { textarea: true })}
        {field("authorizedBy", "Authorized by", {
          hint: "Name or company shown at the bottom of the receipt",
        })}

        <h3 className="pt-2 text-base font-semibold">Bank details (pending)</h3>
        <p className="text-sm text-muted">
          Shown when a receipt is marked payment pending.
        </p>
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
          {pending ? "Saving…" : "Save template"}
        </button>
      </form>
    </div>
  );
}
