import { dispatchChannel } from "@/lib/env";
import { NotifyLkChannel } from "./notify-lk";
import { StubChannel } from "./stub";
import { WhatsAppCloudChannel } from "./whatsapp";
import type { DispatchChannel } from "./types";

export function getDispatchChannel(): DispatchChannel {
  const channel = dispatchChannel();
  if (channel === "whatsapp") {
    return new WhatsAppCloudChannel();
  }
  if (channel === "stub") {
    return new StubChannel();
  }
  return new NotifyLkChannel();
}
