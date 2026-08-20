import { getBoss, SEND_RECEIPT_QUEUE } from "./boss";
import { sendReceiptJob } from "./send-receipt";

const globalForWorker = globalThis as unknown as { lankaslipWorker?: boolean };

export async function startWorker() {
  if (globalForWorker.lankaslipWorker) return;
  const boss = await getBoss();
  await boss.work<{ messageId: string }>(SEND_RECEIPT_QUEUE, async (jobs) => {
    for (const job of jobs) {
      await sendReceiptJob(job.data.messageId);
    }
  });
  globalForWorker.lankaslipWorker = true;
  console.info("[lankaslip] send-receipt worker started");
}
