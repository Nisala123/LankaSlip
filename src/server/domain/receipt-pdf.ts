import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";
import { formatReceiptDate } from "@/server/domain/dates";
import { formatLkr } from "@/server/domain/money";

export type ReceiptPdfInput = {
  shopName: string;
  logoBuffer: Buffer | null;
  addressLines: string[];
  contactLines: string[];
  receiptTitle: string;
  receiptFooter: string;
  authorizedBy: string | null;
  referenceNumber: string;
  createdAt: Date;
  customerName: string | null;
  customerPhone: string | null;
  invoiceId: string | null;
  itemDetails: string | null;
  amountCents: number;
  paymentStatus: string;
};

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 48;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];
  const lines: string[] = [];
  let current = words[0]!;
  for (let i = 1; i < words.length; i += 1) {
    const next = `${current} ${words[i]}`;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      current = next;
    } else {
      lines.push(current);
      current = words[i]!;
    }
  }
  lines.push(current);
  return lines;
}

async function embedLogo(doc: PDFDocument, logoBuffer: Buffer | null) {
  if (!logoBuffer || logoBuffer.length === 0) return null;
  const bytes = new Uint8Array(logoBuffer);
  try {
    return await doc.embedPng(bytes);
  } catch {
    try {
      return await doc.embedJpg(bytes);
    } catch {
      return null;
    }
  }
}

function drawText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  font: PDFFont,
  size: number,
  color = rgb(0.09, 0.09, 0.09),
) {
  page.drawText(text, { x, y, size, font, color });
}

export async function buildReceiptPdf(input: ReceiptPdfInput) {
  const doc = await PDFDocument.create();
  doc.setTitle(`${input.referenceNumber} Payment Receipt`);
  doc.setAuthor(input.shopName);

  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const logo = await embedLogo(doc, input.logoBuffer);

  const amount = `LKR ${formatLkr(input.amountCents)}`;
  const pending = input.paymentStatus === "pending";
  const description =
    input.itemDetails?.trim() ||
    (input.invoiceId
      ? `Payment against invoice ${input.invoiceId}`
      : "Payment received");

  let y = PAGE_HEIGHT - MARGIN;
  const logoSize = 56;
  let textX = MARGIN;

  if (logo) {
    const scaled = logo.scale(1);
    const fit = Math.min(logoSize / scaled.width, logoSize / scaled.height, 1);
    const width = scaled.width * fit;
    const height = scaled.height * fit;
    page.drawImage(logo, {
      x: MARGIN,
      y: y - height,
      width,
      height,
    });
    textX = MARGIN + width + 12;
  }

  drawText(page, input.shopName, textX, y - 16, bold, 16);
  let metaY = y - 34;
  for (const line of [...input.addressLines, ...input.contactLines]) {
    drawText(page, line, textX, metaY, regular, 9, rgb(0.32, 0.32, 0.32));
    metaY -= 12;
  }

  const title = (input.receiptTitle || "PAYMENT RECEIPT").toUpperCase();
  const titleWidth = bold.widthOfTextAtSize(title, 11);
  drawText(
    page,
    title,
    PAGE_WIDTH - MARGIN - titleWidth,
    y - 14,
    bold,
    11,
  );

  y = Math.min(metaY, y - (logo ? logoSize : 40)) - 18;
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_WIDTH - MARGIN, y },
    thickness: 1,
    color: rgb(0.83, 0.83, 0.83),
  });

  y -= 24;
  drawText(page, "Receipt No", MARGIN, y, regular, 10, rgb(0.45, 0.45, 0.45));
  drawText(page, "Date", 320, y, regular, 10, rgb(0.45, 0.45, 0.45));
  y -= 16;
  drawText(page, input.referenceNumber, MARGIN, y, bold, 11);
  drawText(page, formatReceiptDate(input.createdAt), 320, y, bold, 11);

  y -= 36;
  drawText(
    page,
    pending ? "INVOICE TO" : "RECEIVED FROM",
    MARGIN,
    y,
    bold,
    8,
    rgb(0.45, 0.45, 0.45),
  );
  y -= 16;
  drawText(
    page,
    input.customerName?.trim() || "Customer",
    MARGIN,
    y,
    bold,
    13,
  );
  y -= 16;
  if (input.customerPhone) {
    drawText(
      page,
      input.customerPhone,
      MARGIN,
      y,
      regular,
      10,
      rgb(0.32, 0.32, 0.32),
    );
    y -= 14;
  }
  if (input.invoiceId) {
    drawText(
      page,
      `Invoice: ${input.invoiceId}`,
      MARGIN,
      y,
      regular,
      10,
      rgb(0.32, 0.32, 0.32),
    );
    y -= 14;
  }

  y -= 12;
  page.drawRectangle({
    x: MARGIN,
    y: y - 8,
    width: CONTENT_WIDTH,
    height: 28,
    color: rgb(0.96, 0.96, 0.96),
  });
  drawText(page, "DESCRIPTION", MARGIN + 12, y, bold, 8, rgb(0.45, 0.45, 0.45));
  const amountHeader = "AMOUNT";
  drawText(
    page,
    amountHeader,
    PAGE_WIDTH -
      MARGIN -
      12 -
      bold.widthOfTextAtSize(amountHeader, 8),
    y,
    bold,
    8,
    rgb(0.45, 0.45, 0.45),
  );

  y -= 36;
  const descLines = wrapText(description, regular, 10, 340);
  let descY = y;
  for (const line of descLines) {
    drawText(page, line, MARGIN + 12, descY, regular, 10);
    descY -= 14;
  }
  drawText(
    page,
    amount,
    PAGE_WIDTH - MARGIN - 12 - bold.widthOfTextAtSize(amount, 10),
    y,
    bold,
    10,
  );

  y = Math.min(descY, y - 14) - 24;
  drawText(page, "Payment Status", MARGIN, y, regular, 10, rgb(0.45, 0.45, 0.45));
  const status = pending ? "Pending" : "Paid";
  const statusColor = pending
    ? rgb(0.63, 0.38, 0.03)
    : rgb(0.02, 0.47, 0.34);
  drawText(
    page,
    status,
    PAGE_WIDTH - MARGIN - bold.widthOfTextAtSize(status, 10),
    y,
    bold,
    10,
    statusColor,
  );

  y -= 20;
  const amountLabel = pending ? "Amount Due" : "Amount Received";
  drawText(page, amountLabel, MARGIN, y, regular, 10, rgb(0.45, 0.45, 0.45));
  drawText(
    page,
    amount,
    PAGE_WIDTH - MARGIN - bold.widthOfTextAtSize(amount, 12),
    y,
    bold,
    12,
  );

  y -= 28;
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_WIDTH - MARGIN, y },
    thickness: 1,
    color: rgb(0.83, 0.83, 0.83),
  });

  y -= 22;
  const footer = input.receiptFooter || "Thank you for your payment.";
  for (const line of wrapText(footer, regular, 10, CONTENT_WIDTH)) {
    drawText(page, line, MARGIN, y, regular, 10, rgb(0.25, 0.25, 0.25));
    y -= 14;
  }

  if (input.authorizedBy) {
    y -= 24;
    drawText(page, "AUTHORIZED BY", MARGIN, y, bold, 8, rgb(0.45, 0.45, 0.45));
    y -= 16;
    drawText(page, input.authorizedBy, MARGIN, y, bold, 11);
  }

  const bytes = await doc.save();
  return Buffer.from(bytes);
}
