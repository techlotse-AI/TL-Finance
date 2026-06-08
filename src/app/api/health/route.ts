export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({
    status: "ok",
    service: "tl-finance",
    version: "0.3.1",
  });
}
