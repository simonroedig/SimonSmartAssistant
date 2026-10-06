import { BUILD_ID } from "@/lib/env";

export const dynamic = "force-dynamic";

/** The id of the deployment serving this request (lets wall displays auto-update). */
export function GET() {
  return Response.json({ buildId: BUILD_ID }, { headers: { "Cache-Control": "no-store" } });
}
