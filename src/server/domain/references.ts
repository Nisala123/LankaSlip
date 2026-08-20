import { nanoid } from "nanoid";

export function colomboDateStamp(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Colombo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(date)
    .replaceAll("-", "");
}

export function buildReference(seq: number, date = new Date()): string {
  return `LS-${colomboDateStamp(date)}-${String(seq).padStart(4, "0")}`;
}

export function newReceiptToken(): string {
  return nanoid(21);
}

export function newId(): string {
  return nanoid();
}
