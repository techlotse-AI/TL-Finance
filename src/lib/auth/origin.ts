import { ApiError } from "@/lib/api/errors";

export function assertTrustedOrigin(request: Request): void {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    return;
  }

  const expectedOrigin = process.env.NEXT_PUBLIC_APP_URL;
  const origin = request.headers.get("origin");

  if (!expectedOrigin || !origin) {
    throw new ApiError(403, "untrusted_origin", "Request origin is not trusted.");
  }

  try {
    if (new URL(origin).origin !== new URL(expectedOrigin).origin) {
      throw new ApiError(403, "untrusted_origin", "Request origin is not trusted.");
    }
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError(403, "untrusted_origin", "Request origin is not trusted.");
  }
}
