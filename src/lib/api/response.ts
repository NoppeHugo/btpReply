import { NextResponse } from "next/server";

type ApiSuccess<T> = { ok: true; data: T };
type ApiError = { ok: false; error: string; code?: string };

export function ok<T>(data: T, status = 200): NextResponse<ApiSuccess<T>> {
  return NextResponse.json({ ok: true, data }, { status });
}

export function err(
  error: string,
  status: number,
  code?: string
): NextResponse<ApiError> {
  return NextResponse.json({ ok: false, error, code }, { status });
}

export const HTTP = {
  badRequest: (msg = "Bad request") => err(msg, 400, "BAD_REQUEST"),
  unauthorized: () => err("Unauthorized", 401, "UNAUTHORIZED"),
  forbidden: () => err("Forbidden", 403, "FORBIDDEN"),
  notFound: (msg = "Not found") => err(msg, 404, "NOT_FOUND"),
  internal: () => err("Internal server error", 500, "INTERNAL"),
} as const;
