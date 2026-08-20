import { createHash } from "node:crypto";

export class PhoneError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PhoneError";
  }
}

export function normalizeLkPhone(input: string): string {
  const digits = input.replace(/\D/g, "");
  let national: string | null = null;

  if (digits.startsWith("94") && digits.length === 11) {
    national = digits.slice(2);
  } else if (digits.startsWith("0") && digits.length === 10) {
    national = digits.slice(1);
  } else if (digits.length === 9) {
    national = digits;
  }

  if (!national || !/^7\d{8}$/.test(national)) {
    throw new PhoneError("Enter a valid Sri Lankan mobile number");
  }

  return `+94${national}`;
}

export function toProviderPhone(e164: string): string {
  return e164.replace(/^\+/, "");
}

export function maskPhone(e164: string): string {
  if (e164.length < 8) return "****";
  return `${e164.slice(0, 5)}****${e164.slice(-3)}`;
}

export function hashPhone(e164: string): string {
  return createHash("sha256").update(e164).digest("hex");
}
