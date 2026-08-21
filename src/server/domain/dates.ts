export function formatReceiptDate(date: Date) {
  return new Intl.DateTimeFormat("en-LK", {
    timeZone: "Asia/Colombo",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}
