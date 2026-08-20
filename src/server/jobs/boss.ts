import PgBoss from "pg-boss";

export const SEND_RECEIPT_QUEUE = "send-receipt";

const globalForBoss = globalThis as unknown as { pgBoss?: PgBoss };

export async function getBoss() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
  }
  if (!globalForBoss.pgBoss) {
    const boss = new PgBoss({
      connectionString: process.env.DATABASE_URL,
      retryLimit: 3,
      retryDelay: 8,
      retryBackoff: true,
    });
    boss.on("error", (err) => {
      console.error("[pg-boss]", err);
    });
    await boss.start();
    try {
      await boss.createQueue(SEND_RECEIPT_QUEUE);
    } catch {
      // Queue already exists from a previous process.
    }
    globalForBoss.pgBoss = boss;
  }
  return globalForBoss.pgBoss;
}

export async function enqueueSendReceipt(messageId: string) {
  const boss = await getBoss();
  await boss.send(
    SEND_RECEIPT_QUEUE,
    { messageId },
    { retryLimit: 3, retryDelay: 8, retryBackoff: true },
  );
}
