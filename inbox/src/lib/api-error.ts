import { NextResponse } from "next/server";

export type ApiErrorCode =
  | "missing_api_key"
  | "invalid_api_key"
  | "revoked_api_key"
  | "insufficient_scope"
  | "mailbox_not_connected"
  | "gmail_token_failed"
  | "gmail_api_failed"
  | "rate_limited"
  | "validation_failed"
  | "internal_error";

export class ApiError extends Error {
  constructor(
    public code: ApiErrorCode,
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function createApiErrorResponse(error: ApiError) {
  return NextResponse.json(
    {
      error: {
        code: error.code,
        message: error.message,
      },
    },
    { status: error.status },
  );
}

export function toApiError(error: unknown) {
  if (error instanceof ApiError) {
    return error;
  }

  return new ApiError("internal_error", 500, "An internal error occurred.");
}
