import "server-only";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { dispatchPendingPushesSafe } from "@/lib/push";

/** Seiten neu laden + neu entstandene Benachrichtigungen (DB-Trigger) nach der Antwort als Push senden */
export function refreshAll() {
  revalidatePath("/", "layout");
  after(dispatchPendingPushesSafe);
}
