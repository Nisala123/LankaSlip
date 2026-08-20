export class MoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MoneyError";
  }
}

export function lkrToCents(input: string | number): number {
  const raw = typeof input === "number" ? input : Number(String(input).replace(/,/g, "").trim());
  if (!Number.isFinite(raw) || raw <= 0) {
    throw new MoneyError("Amount must be greater than 0");
  }
  return Math.round(raw * 100);
}

export function formatLkr(cents: number): string {
  return new Intl.NumberFormat("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}
