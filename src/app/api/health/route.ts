import packageJson from "../../../../package.json";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({
    status: "ok",
    service: "tl-finance",
    version: packageJson.version,
  });
}
