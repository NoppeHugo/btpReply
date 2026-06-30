import { ok } from "@/lib/api/response";

export function GET() {
  return ok({ status: "ok", version: "v1" });
}
