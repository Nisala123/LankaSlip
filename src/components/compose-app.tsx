"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import {
  canUseSystemContactPicker,
  getContactsManager,
  isAppleTouchDevice,
  pickContactFromPhonebook,
  pickPhoneFromClipboard,
  pickPhoneFromVCardFile,
  toNationalLkInput,
} from "@/lib/phone-input";

type ReceiptRow = {
  id: string;
  token: string;
  referenceNumber: string;
  amount: string;
  paymentStatus: string;
  createdAt: string;
  messageStatus: string;
  messageError: string | null;
  channel: string | null;
  customerPhone: string | null;
  itemDetails: string | null;
  whatsappShareUrl: string | null;
};

type CustomerChip = {
  id: string;
  phone: string;
  displayPhone: string;
  name: string | null;
};

function statusLabel(status: string, channel: string | null) {
  if (channel === "stub" && status === "sent") return "Simulated";
  if (status === "queued") return "Sending";
  if (status === "sent") return channel === "sms" ? "SMS sent" : "Sent";
  if (status === "delivered" || status === "read") return "Delivered";
  if (status === "failed") return "Failed";
  return status;
}

export function ComposeApp() {
  const [phone, setPhone] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [amount, setAmount] = useState("");
  const [itemDetails, setItemDetails] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<"received" | "pending">(
    "received",
  );
  const [slip, setSlip] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [receipts, setReceipts] = useState<ReceiptRow[]>([]);
  const [customers, setCustomers] = useState<CustomerChip[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const phoneInputRef = useRef<HTMLInputElement>(null);
  const vcardInputRef = useRef<HTMLInputElement>(null);
  const skipPhonebookOnce = useRef(false);
  const [iosHelpOpen, setIosHelpOpen] = useState(false);
  const [contactHint, setContactHint] = useState<string | null>(null);

  function applyPickedPhone(nextPhone: string, nextName?: string | null) {
    setPhone(nextPhone);
    if (nextName) setCustomerName(nextName);
    setError(null);
    setContactHint(null);
    setIosHelpOpen(false);
    phoneInputRef.current?.blur();
  }

  async function openPhonebook() {
    setError(null);
    setContactHint(null);

    // Android Chrome / supported browsers: native Contact Picker
    if (canUseSystemContactPicker()) {
      try {
        const picked = await pickContactFromPhonebook();
        if (!picked) {
          skipPhonebookOnce.current = true;
          phoneInputRef.current?.focus();
          return;
        }
        applyPickedPhone(picked.phone, picked.name);
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          skipPhonebookOnce.current = true;
          phoneInputRef.current?.focus();
          return;
        }
      }
    }

    // iOS Safari: Apple blocks Contact Picker — use AutoFill + paste + vCard
    if (isAppleTouchDevice()) {
      setIosHelpOpen(true);
      return;
    }

    skipPhonebookOnce.current = true;
    setContactHint(
      "This browser cannot open the phonebook. Tap the field and use AutoFill, or type the number.",
    );
    phoneInputRef.current?.focus();
  }

  async function pasteFromContacts() {
    setError(null);
    try {
      const next = await pickPhoneFromClipboard();
      applyPickedPhone(next);
      setContactHint("Number pasted from clipboard.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not paste. Long-press the phone field and choose Paste.",
      );
    }
  }

  async function onVCardSelected(file: File | null) {
    if (!file) return;
    setError(null);
    try {
      const picked = await pickPhoneFromVCardFile(file);
      applyPickedPhone(picked.phone, picked.name);
      setContactHint("Contact imported.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not read that contact card",
      );
    } finally {
      if (vcardInputRef.current) vcardInputRef.current.value = "";
    }
  }

  async function refreshHistory() {
    const res = await fetch("/api/receipts");
    if (!res.ok) return;
    const data = (await res.json()) as { receipts: ReceiptRow[] };
    setReceipts(data.receipts);
  }

  useEffect(() => {
    let cancelled = false;

    fetch("/api/receipts")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.receipts) setReceipts(data.receipts);
      });

    fetch("/api/customers")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.customers) setCustomers(data.customers);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!activeId) return;
    const current = receipts.find((row) => row.id === activeId);
    if (
      current &&
      (current.messageStatus === "delivered" ||
        current.messageStatus === "read" ||
        current.messageStatus === "failed" ||
        current.messageStatus === "sent")
    ) {
      return;
    }
    const timer = setInterval(async () => {
      const res = await fetch(`/api/receipts/${activeId}`);
      if (!res.ok) return;
      const data = await res.json();
      setReceipts((rows) =>
        rows.map((row) =>
          row.id === activeId
            ? {
                ...row,
                messageStatus: data.receipt.messageStatus,
                messageError: data.receipt.messageError,
                channel: data.receipt.channel ?? row.channel,
                whatsappShareUrl:
                  data.receipt.whatsappShareUrl ?? row.whatsappShareUrl,
              }
            : row,
        ),
      );
    }, 2000);
    return () => clearInterval(timer);
  }, [activeId, receipts]);

  const idempotencyKey = useRef(crypto.randomUUID());

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData();
    form.set("phone", phone);
    if (customerName) form.set("customerName", customerName);
    form.set("amount", amount);
    form.set("itemDetails", itemDetails);
    form.set("invoiceId", invoiceId);
    form.set("paymentStatus", paymentStatus);
    if (slip) form.set("slip", slip);

    const res = await fetch("/api/receipts", {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey.current },
      body: form,
    });
    const data = await res.json();
    setPending(false);
    if (!res.ok) {
      setError(data.error ?? "Could not send receipt");
      return;
    }
    idempotencyKey.current = crypto.randomUUID();
    setActiveId(data.receipt.id);
    setReceipts((rows) =>
      [data.receipt, ...rows.filter((row) => row.id !== data.receipt.id)].slice(
        0,
        20,
      ),
    );
    setPhone("");
    setCustomerName("");
    setAmount("");
    setItemDetails("");
    setInvoiceId("");
    setSlip(null);
    setPaymentStatus("received");
    await refreshHistory();
  }

  async function retry(id: string) {
    await fetch(`/api/receipts/${id}?action=retry`, { method: "POST" });
    setActiveId(id);
    await refreshHistory();
  }

  return (
    <div className="space-y-6">
      <form onSubmit={onSubmit} className="space-y-4 rounded-2xl bg-card p-4">
        <div className="block text-sm">
          <div className="flex items-center justify-between gap-2">
            <span>Customer phone</span>
            {customerName ? (
              <span className="truncate text-xs text-muted">{customerName}</span>
            ) : null}
          </div>
          <div className="mt-1 flex overflow-hidden rounded-xl border border-line bg-background">
            <span className="flex items-center px-3 text-muted">+94</span>
            <input
              ref={phoneInputRef}
              id="customer-phone"
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              required
              value={phone}
              onChange={(e) => {
                const next = e.target.value;
                const national = toNationalLkInput(next);
                setPhone(national ?? next.replace(/[^\d\s]/g, ""));
                if (!next.trim()) setCustomerName("");
              }}
              onPaste={(e) => {
                const text = e.clipboardData.getData("text");
                const national = toNationalLkInput(text);
                if (national) {
                  e.preventDefault();
                  setPhone(national);
                  setContactHint(null);
                }
              }}
              onFocus={() => {
                // Only auto-open native picker where Contact Picker exists (Android).
                // On iOS, leave focus alone so Safari Contact AutoFill can appear.
                if (
                  !getContactsManager() ||
                  phone.trim() ||
                  skipPhonebookOnce.current
                ) {
                  skipPhonebookOnce.current = false;
                  return;
                }
                void openPhonebook();
              }}
              placeholder="77 123 4567"
              className="w-full bg-transparent px-3 py-3 outline-none"
            />
            <button
              type="button"
              onClick={() => void openPhonebook()}
              className="shrink-0 border-l border-line px-3 py-3 text-sm font-medium text-accent"
              aria-label="Pick from contacts"
            >
              Contacts
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void pasteFromContacts()}
              className="rounded-full border border-line px-3 py-1.5 text-xs text-accent"
            >
              Paste number
            </button>
            <button
              type="button"
              onClick={() => vcardInputRef.current?.click()}
              className="rounded-full border border-line px-3 py-1.5 text-xs text-muted"
            >
              Import contact card
            </button>
            <input
              ref={vcardInputRef}
              type="file"
              accept=".vcf,text/vcard,text/x-vcard"
              className="hidden"
              onChange={(e) =>
                void onVCardSelected(e.target.files?.[0] ?? null)
              }
            />
          </div>
          <p className="mt-1 text-xs text-muted">
            iPhone: tap the field and choose a contact from AutoFill above the
            keyboard, or use Paste / Import. Android: Contacts opens the
            phonebook.
          </p>
          {contactHint ? (
            <p className="mt-1 text-xs text-accent">{contactHint}</p>
          ) : null}
        </div>

        {iosHelpOpen ? (
          <div
            className="fixed inset-0 z-50 flex items-end bg-black/40 p-4 sm:items-center sm:justify-center"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ios-contacts-title"
            onClick={() => setIosHelpOpen(false)}
          >
            <div
              className="w-full max-w-md rounded-2xl bg-card p-5"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 id="ios-contacts-title" className="text-lg font-semibold">
                Pick a contact on iPhone
              </h2>
              <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-muted">
                <li>
                  Tap the phone field, then choose a contact from{" "}
                  <strong className="text-foreground">AutoFill</strong> above
                  the keyboard (Contacts icon).
                </li>
                <li>
                  Or open the Contacts app, copy the mobile number, return here,
                  and tap <strong className="text-foreground">Paste number</strong>.
                  Safari may ask you to confirm Paste.
                </li>
                <li>
                  Or in Contacts tap Share Contact → Save to Files, then{" "}
                  <strong className="text-foreground">Import contact card</strong>.
                </li>
              </ol>
              <div className="mt-5 grid gap-2">
                <button
                  type="button"
                  className="rounded-xl bg-accent py-3 font-medium text-white"
                  onClick={() => {
                    setIosHelpOpen(false);
                    skipPhonebookOnce.current = true;
                    phoneInputRef.current?.focus();
                  }}
                >
                  Use AutoFill
                </button>
                <button
                  type="button"
                  className="rounded-xl border border-line py-3 font-medium text-accent"
                  onClick={() => void pasteFromContacts()}
                >
                  Paste number
                </button>
                <button
                  type="button"
                  className="rounded-xl border border-line py-3 text-muted"
                  onClick={() => {
                    setIosHelpOpen(false);
                    vcardInputRef.current?.click();
                  }}
                >
                  Import contact card
                </button>
                <button
                  type="button"
                  className="py-2 text-sm text-muted"
                  onClick={() => setIosHelpOpen(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {customers.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {customers.map((customer) => (
              <button
                key={customer.id}
                type="button"
                onClick={() => {
                  setPhone(customer.phone.replace("+94", ""));
                  setCustomerName(customer.name ?? "");
                }}
                className="rounded-full border border-line px-3 py-1 text-xs text-muted"
              >
                {customer.name || customer.displayPhone}
              </button>
            ))}
          </div>
        ) : null}

        <label className="block text-sm">
          Amount (LKR)
          <input
            inputMode="decimal"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-3 text-2xl outline-none focus:border-accent"
          />
        </label>

        <label className="block text-sm">
          Item / invoice
          <input
            value={itemDetails}
            onChange={(e) => setItemDetails(e.target.value)}
            placeholder="Rice 5kg, invoice 1042"
            className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-3 outline-none focus:border-accent"
          />
        </label>

        <label className="block text-sm">
          Invoice ID
          <input
            value={invoiceId}
            onChange={(e) => setInvoiceId(e.target.value)}
            placeholder="Optional"
            className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-3 outline-none focus:border-accent"
          />
        </label>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setPaymentStatus("received")}
            className={`rounded-xl border px-3 py-3 text-sm ${
              paymentStatus === "received"
                ? "border-accent bg-accent text-white"
                : "border-line"
            }`}
          >
            Payment received
          </button>
          <button
            type="button"
            onClick={() => setPaymentStatus("pending")}
            className={`rounded-xl border px-3 py-3 text-sm ${
              paymentStatus === "pending"
                ? "border-pending bg-pending text-white"
                : "border-line"
            }`}
          >
            Pending
          </button>
        </div>

        <label className="block text-sm">
          Bank slip (optional)
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => setSlip(e.target.files?.[0] ?? null)}
            className="mt-1 w-full text-sm"
          />
        </label>

        {error ? <p className="text-sm text-danger">{error}</p> : null}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-xl bg-accent py-4 text-lg font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
        >
          {pending ? "Sending SMS…" : "Send SMS receipt"}
        </button>
        <p className="text-center text-xs text-muted">
          SMS via Notify.lk. You can also share on WhatsApp after sending.
        </p>
      </form>

      <section>
        <h2 className="mb-3 text-sm font-medium text-muted">Recent receipts</h2>
        <div className="space-y-2">
          {receipts.map((row) => (
            <article key={row.id} className="rounded-2xl bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">LKR {row.amount}</p>
                  <p className="text-sm text-muted">
                    {row.customerPhone} · {row.referenceNumber}
                  </p>
                  {row.itemDetails ? (
                    <p className="mt-1 text-sm">{row.itemDetails}</p>
                  ) : null}
                </div>
                <span
                  className={`text-xs font-medium ${
                    row.messageStatus === "failed"
                      ? "text-danger"
                      : row.messageStatus === "delivered" ||
                          row.messageStatus === "read" ||
                          row.messageStatus === "sent"
                        ? "text-accent"
                        : "text-pending"
                  }`}
                >
                  {statusLabel(row.messageStatus, row.channel)}
                </span>
              </div>
              {row.messageError ? (
                <p className="mt-2 text-sm text-danger">{row.messageError}</p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-3 text-sm">
                <a
                  className="text-accent"
                  href={`/r/${row.token}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  View receipt
                </a>
                {row.whatsappShareUrl ? (
                  <a
                    className="text-accent"
                    href={row.whatsappShareUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Share on WhatsApp
                  </a>
                ) : null}
                {row.messageStatus === "failed" ? (
                  <button
                    type="button"
                    className="text-muted"
                    onClick={() => retry(row.id)}
                  >
                    Retry SMS
                  </button>
                ) : null}
              </div>
            </article>
          ))}
          {receipts.length === 0 ? (
            <p className="text-sm text-muted">No receipts yet.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
