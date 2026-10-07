export type MailboxSetupCode =
  | "DATABASE_URL_MISSING"
  | "DATABASE_URL_MALFORMED"
  | "DATABASE_URL_PRIVATE_HOST_ON_VERCEL"
  | "DATABASE_CONNECT_FAILED"
  | "DATABASE_CONNECT_TIMEOUT"
  | "DATABASE_AUTH_FAILED"
  | "DATABASE_SSL_REQUIRED"
  | "PRISMA_CLIENT_INIT_FAILED"
  | "PRISMA_SCHEMA_NOT_DEPLOYED"
  | "DATABASE_QUERY_FAILED"
  | "DATABASE_WRITE_FAILED"
  | "GOOGLE_EXTERNAL_ACCOUNT_MISSING"
  | "GMAIL_TOKEN_MISSING"
  | "GOOGLE_OAUTH_ACCESS_DENIED"
  | "GOOGLE_OAUTH_BLOCKED_ACCESS"
  | "GOOGLE_OAUTH_SERVER_ERROR"
  | "GOOGLE_OAUTH_TOKEN_MISSING"
  | "MICROSOFT_TOKEN_MISSING"
  | "MICROSOFT_SCOPE_MISSING"
  | "MICROSOFT_ADMIN_CONSENT_REQUIRED"
  | "MICROSOFT_RECONNECT_REQUIRED"
  | "GMAIL_SCOPES_MISSING"
  | "GMAIL_SCOPE_MISSING"
  | "GMAIL_API_DISABLED"
  | "GMAIL_API_CALL_FAILED"
  | "GOOGLE_TOKEN_REFRESH_FAILED"
  | "GMAIL_PROFILE_FAILED"
  | "GMAIL_PROFILE_FETCH_FAILED"
  | "MAILBOX_UPSERT_FAILED"
  | "MAILBOX_ACCOUNT_CREATE_FAILED"
  | "MAILBOX_ACCOUNT_UPDATE_FAILED"
  | "MISSING_MAILBOX_ENCRYPTION_KEY"
  | "INVALID_MAILBOX_ENCRYPTION_KEY"
  | "MAILBOX_TOKEN_ENCRYPT_FAILED"
  | "MAILBOX_SYNC_BOOTSTRAP_FAILED"
  | "MAILBOX_LIST_FETCH_FAILED"
  | "MAILBOX_SYNC_FAILED"
  | "UNSUPPORTED_PROVIDER"
  | "ACTIVE_MAILBOX_SELECTION_FAILED"
  | "MAILBOX_SYNC_TIMEOUT"
  | "UNKNOWN_MAILBOX_SETUP_FAILURE";

export type MailboxSetupDiagnostic = {
  code: MailboxSetupCode;
  step: string;
  userMessage: string;
  devMessage: string;
  probableCause: string;
  recommendedAction: string;
  metadata?: Record<string, unknown>;
};

type MailboxSetupDiagnosticDefinition = Omit<MailboxSetupDiagnostic, "step" | "code" | "metadata">;

const DIAGNOSTICS: Record<MailboxSetupCode, MailboxSetupDiagnosticDefinition> = {
  DATABASE_URL_MISSING: {
    userMessage: "Inbox cannot reach the mailbox database.",
    devMessage: "DATABASE_URL is missing for this runtime.",
    probableCause: "The deployment does not define DATABASE_URL.",
    recommendedAction: "Add the correct PostgreSQL connection string to DATABASE_URL.",
  },
  DATABASE_URL_MALFORMED: {
    userMessage: "Inbox cannot reach the mailbox database.",
    devMessage: "DATABASE_URL is present but malformed.",
    probableCause: "The connection string cannot be parsed as a PostgreSQL URL.",
    recommendedAction: "Replace DATABASE_URL with a valid PostgreSQL connection string.",
  },
  DATABASE_URL_PRIVATE_HOST_ON_VERCEL: {
    userMessage: "Inbox cannot reach the mailbox database.",
    devMessage: "Vercel is using a Railway private host. Use Railway DATABASE_PUBLIC_URL / TCP proxy URL.",
    probableCause: "The deployment is trying to reach postgres.railway.internal from outside Railway.",
    recommendedAction: "Set Vercel DATABASE_URL to the Railway public TCP proxy URL.",
  },
  DATABASE_CONNECT_FAILED: {
    userMessage: "Inbox cannot reach the mailbox database.",
    devMessage: "Prisma could not connect to the configured database host.",
    probableCause: "The database host is unreachable, down, or blocked by network rules.",
    recommendedAction: "Verify host, port, network access, and database availability.",
  },
  DATABASE_CONNECT_TIMEOUT: {
    userMessage: "Inbox cannot reach the mailbox database.",
    devMessage: "The database connection attempt timed out.",
    probableCause: "The database is slow, sleeping, or network connectivity is degraded.",
    recommendedAction: "Check database latency and wake the database service if it is paused.",
  },
  DATABASE_AUTH_FAILED: {
    userMessage: "Inbox cannot reach the mailbox database.",
    devMessage: "Database authentication failed for the configured credentials.",
    probableCause: "DATABASE_URL contains the wrong username or password.",
    recommendedAction: "Rotate or correct the database credentials in DATABASE_URL.",
  },
  DATABASE_SSL_REQUIRED: {
    userMessage: "Inbox cannot reach the mailbox database.",
    devMessage: "The database requires SSL or an SSL mode different from the current connection string.",
    probableCause: "The connection string SSL options do not match the database server requirements.",
    recommendedAction: "Update DATABASE_URL SSL parameters to match the database server.",
  },
  PRISMA_CLIENT_INIT_FAILED: {
    userMessage: "Inbox cannot reach the mailbox database.",
    devMessage: "Prisma client initialization failed before mailbox setup completed.",
    probableCause: "Prisma could not initialize with the current runtime or database config.",
    recommendedAction: "Review Prisma initialization logs and validate the runtime database config.",
  },
  PRISMA_SCHEMA_NOT_DEPLOYED: {
    userMessage: "Inbox cannot reach the mailbox database.",
    devMessage: "Mailbox tables or Prisma migrations are missing from the target database.",
    probableCause: "Prisma migrations were not deployed to the active database.",
    recommendedAction: "Run prisma migrate deploy against the correct database.",
  },
  DATABASE_QUERY_FAILED: {
    userMessage: "Inbox could not read the mailbox connection state.",
    devMessage: "A mailbox database query failed after the database became reachable.",
    probableCause: "A Prisma read failed because the mailbox schema or query shape does not match the database.",
    recommendedAction: "Inspect the failing Prisma query and verify the deployed mailbox schema matches Prisma.",
  },
  DATABASE_WRITE_FAILED: {
    userMessage: "Inbox could not store the mailbox connection state.",
    devMessage: "A mailbox database write failed after the database became reachable.",
    probableCause: "A Prisma write, constraint, or schema mismatch blocked mailbox persistence.",
    recommendedAction: "Inspect the failing Prisma write and reconcile schema/data constraints.",
  },
  GOOGLE_EXTERNAL_ACCOUNT_MISSING: {
    userMessage: "Google connected, but the linked Google account is missing from this session.",
    devMessage: "The mailbox session exists but no Google external account is attached.",
    probableCause: "Google SSO completed without a persistent external account link.",
    recommendedAction: "Reconnect Google and verify the Google account connection is configured correctly.",
  },
  GMAIL_TOKEN_MISSING: {
    userMessage: "Google authorization finished, but Gmail access was not attached to this session.",
    devMessage: "No usable Gmail OAuth token was available after authorization.",
    probableCause: "The provider did not return a token with the requested Gmail access.",
    recommendedAction: "Reconnect Google and verify the requested Gmail scopes.",
  },
  GOOGLE_OAUTH_ACCESS_DENIED: {
    userMessage: "Google authorization succeeded, but Gmail permission was denied.",
    devMessage: "The user denied Gmail access on the Google consent screen.",
    probableCause: "Consent was declined or not fully granted.",
    recommendedAction: "Retry Google authorization and approve the requested Gmail permissions.",
  },
  GOOGLE_OAUTH_BLOCKED_ACCESS: {
    userMessage: "Google blocked Gmail access for this app configuration.",
    devMessage: "Google blocked the OAuth flow because the app is unverified or restricted.",
    probableCause: "The Google OAuth app is still restricted, in testing, or lacks the right verification.",
    recommendedAction: "Verify the Google OAuth app and approved test users or move the app to production.",
  },
  GOOGLE_OAUTH_SERVER_ERROR: {
    userMessage: "Google authorization hit a temporary provider issue.",
    devMessage: "Google or an OAuth intermediary returned a server-side failure during handoff.",
    probableCause: "Google returned a 5xx or transient OAuth failure.",
    recommendedAction: "Retry later and inspect provider-side errors if the failure persists.",
  },
  GOOGLE_OAUTH_TOKEN_MISSING: {
    userMessage: "Google authorization finished, but Gmail access was not attached to this session.",
    devMessage: "Mailbox setup could not find a usable Google OAuth token.",
    probableCause: "The token was never issued, was dropped, or could not be selected.",
    recommendedAction: "Reconnect Google and verify Gmail scopes are requested.",
  },
  MICROSOFT_TOKEN_MISSING: {
    userMessage: "Outlook access is not attached to this session yet.",
    devMessage: "No usable Microsoft OAuth token was available for the connected Outlook account.",
    probableCause: "The Outlook OAuth token was never issued, was dropped, or could not be refreshed.",
    recommendedAction: "Reconnect Outlook and verify the Microsoft OAuth configuration.",
  },
  MICROSOFT_SCOPE_MISSING: {
    userMessage: "Outlook permission was not granted for this mailbox.",
    devMessage: "The available Microsoft token is missing one or more required Graph scopes.",
    probableCause: "The consent flow omitted Graph scopes or the wrong Microsoft token was selected.",
    recommendedAction: "Reconnect Outlook and approve the requested Microsoft mail permissions.",
  },
  MICROSOFT_ADMIN_CONSENT_REQUIRED: {
    userMessage: "Outlook access needs approval before this mailbox can load.",
    devMessage: "Microsoft Graph requires admin consent for one or more requested scopes.",
    probableCause: "The Microsoft tenant blocks the requested Graph scopes until an administrator approves them.",
    recommendedAction: "Ask a Microsoft 365 admin to grant consent for the required Graph scopes.",
  },
  MICROSOFT_RECONNECT_REQUIRED: {
    userMessage: "Outlook needs to be reconnected before this mailbox can load.",
    devMessage: "Microsoft Graph rejected the current Outlook grant and a fresh connection is required.",
    probableCause: "The stored Microsoft grant is stale, revoked, or no longer valid for the requested mailbox access.",
    recommendedAction: "Reconnect Outlook and approve the requested Microsoft permissions again.",
  },
  GMAIL_SCOPES_MISSING: {
    userMessage: "Google authorization succeeded, but Gmail permission was not granted.",
    devMessage: "The available Google token is missing one or more required Gmail scopes.",
    probableCause: "The consent flow omitted Gmail scopes or the token came from the wrong provider.",
    recommendedAction: "Reconnect Google and approve the requested Gmail scopes.",
  },
  GMAIL_SCOPE_MISSING: {
    userMessage: "Google authorization succeeded, but Gmail permission was not granted.",
    devMessage: "The available Google token is missing one or more required Gmail scopes.",
    probableCause: "The consent flow omitted Gmail scopes or the token came from the wrong provider.",
    recommendedAction: "Reconnect Google and approve the requested Gmail scopes.",
  },
  GMAIL_API_DISABLED: {
    userMessage: "The Gmail API is unavailable for this Google configuration.",
    devMessage: "The Gmail API is disabled or inaccessible for the current Google project.",
    probableCause: "The Google Cloud project does not have Gmail API access enabled.",
    recommendedAction: "Enable Gmail API in the Google Cloud project and retry Google authorization.",
  },
  GMAIL_API_CALL_FAILED: {
    userMessage: "Inbox could not load Gmail for this mailbox.",
    devMessage: "A Gmail API request failed after authentication completed.",
    probableCause: "Gmail returned an unexpected non-scope, non-auth error.",
    recommendedAction: "Inspect the Gmail API response and retry the request.",
  },
  GOOGLE_TOKEN_REFRESH_FAILED: {
    userMessage: "The Google connection needs to be refreshed before Gmail can load.",
    devMessage: "Google rejected the token as expired, revoked, or not refreshable.",
    probableCause: "The token expired or was revoked after authorization.",
    recommendedAction: "Reconnect Google to obtain a fresh Gmail token.",
  },
  GMAIL_PROFILE_FAILED: {
    userMessage: "Inbox could not confirm the Gmail mailbox profile for this session.",
    devMessage: "The Gmail profile lookup failed before mailbox persistence.",
    probableCause: "Gmail profile fetch failed due to auth, provider, or Gmail API issues.",
    recommendedAction: "Inspect the Gmail profile request and retry after reconnecting Google if needed.",
  },
  GMAIL_PROFILE_FETCH_FAILED: {
    userMessage: "Inbox could not confirm the Gmail mailbox profile for this session.",
    devMessage: "The Gmail profile lookup failed before mailbox persistence.",
    probableCause: "Gmail profile fetch failed due to auth, provider, or Gmail API issues.",
    recommendedAction: "Inspect the Gmail profile request and retry after reconnecting Google if needed.",
  },
  MAILBOX_UPSERT_FAILED: {
    userMessage: "Inbox could not store the mailbox connection state.",
    devMessage: "Persisting the mailbox account row failed.",
    probableCause: "The mailbox upsert payload or Prisma write failed before the mailbox could be stored.",
    recommendedAction: "Inspect the Prisma upsert payload, database schema, and write error details.",
  },
  MAILBOX_ACCOUNT_CREATE_FAILED: {
    userMessage: "Inbox could not store the mailbox connection state.",
    devMessage: "Creating the mailbox account row failed.",
    probableCause: "The initial mailbox record insert hit a Prisma or schema error.",
    recommendedAction: "Inspect the create payload and validate the mailbox schema.",
  },
  MAILBOX_ACCOUNT_UPDATE_FAILED: {
    userMessage: "Inbox could not store the mailbox connection state.",
    devMessage: "Updating the mailbox account row failed.",
    probableCause: "The mailbox record update hit a Prisma or schema error.",
    recommendedAction: "Inspect the update payload and validate unique keys and schema.",
  },
  MISSING_MAILBOX_ENCRYPTION_KEY: {
    userMessage: "Inbox could not store the mailbox connection state.",
    devMessage: "MAILBOX_ENCRYPTION_KEY is missing for this runtime.",
    probableCause: "The deployment does not define MAILBOX_ENCRYPTION_KEY.",
    recommendedAction: "Add MAILBOX_ENCRYPTION_KEY to the deployment and retry mailbox setup.",
  },
  INVALID_MAILBOX_ENCRYPTION_KEY: {
    userMessage: "Inbox could not store the mailbox connection state.",
    devMessage: "MAILBOX_ENCRYPTION_KEY is present but could not be used for mailbox token encryption.",
    probableCause: "The configured MAILBOX_ENCRYPTION_KEY is malformed or incompatible with the current crypto routine.",
    recommendedAction: "Replace MAILBOX_ENCRYPTION_KEY with a valid value and retry mailbox setup.",
  },
  MAILBOX_TOKEN_ENCRYPT_FAILED: {
    userMessage: "Inbox could not store the mailbox connection state.",
    devMessage: "Encrypting the mailbox access token failed before persistence.",
    probableCause: "MAILBOX_ENCRYPTION_KEY is missing, invalid, or incompatible.",
    recommendedAction: "Verify MAILBOX_ENCRYPTION_KEY and retry mailbox setup.",
  },
  MAILBOX_SYNC_BOOTSTRAP_FAILED: {
    userMessage: "Inbox could not finish mailbox setup.",
    devMessage: "Mailbox bootstrap failed after account persistence but before initial shell readiness.",
    probableCause: "The initial mailbox bootstrap step failed or returned incomplete setup state.",
    recommendedAction: "Retry mailbox setup and inspect bootstrap logs for the failing step.",
  },
  MAILBOX_LIST_FETCH_FAILED: {
    userMessage: "Inbox could not load Gmail messages for this mailbox view.",
    devMessage: "The initial mailbox list fetch failed after shell render began.",
    probableCause: "The Gmail list query failed or returned an unexpected API error.",
    recommendedAction: "Inspect the Gmail list call and retry the mailbox view.",
  },
  MAILBOX_SYNC_FAILED: {
    userMessage: "Mailbox sync did not finish successfully.",
    devMessage: "The mailbox sync operation failed before the latest data could be loaded.",
    probableCause: "A provider sync request failed or returned incomplete mailbox data.",
    recommendedAction: "Inspect provider logs and retry mailbox sync.",
  },
  UNSUPPORTED_PROVIDER: {
    userMessage: "This mailbox provider is not supported in Inbox.",
    devMessage: "A mailbox provider outside the active product allowlist was requested.",
    probableCause: "A legacy provider value or unsupported mailbox route was reached.",
    recommendedAction: "Limit mailbox operations to the supported provider allowlist.",
  },
  ACTIVE_MAILBOX_SELECTION_FAILED: {
    userMessage: "Inbox could not select the active mailbox.",
    devMessage: "The stored active mailbox selection did not match an available connected mailbox.",
    probableCause: "The selected mailbox id is stale, disconnected, or invalid for this user.",
    recommendedAction: "Select another mailbox or reconnect the missing account.",
  },
  MAILBOX_SYNC_TIMEOUT: {
    userMessage: "Mailbox sync is taking longer than expected.",
    devMessage: "Mailbox setup or mailbox data fetch exceeded the allowed timeout.",
    probableCause: "The database or Gmail provider is responding too slowly.",
    recommendedAction: "Retry the mailbox step and inspect latency of upstream services.",
  },
  UNKNOWN_MAILBOX_SETUP_FAILURE: {
    userMessage: "Inbox hit an unexpected mailbox error before the inbox could load.",
    devMessage: "The failure did not match a known mailbox setup diagnostic.",
    probableCause: "An unclassified error escaped the current mailbox diagnostics mapping.",
    recommendedAction: "Inspect the sanitized error details and add a dedicated diagnostic mapping.",
  },
};

export function getMailboxSetupDiagnostic(
  code: MailboxSetupCode,
  step: string,
  metadata?: Record<string, unknown>,
): MailboxSetupDiagnostic {
  const definition = DIAGNOSTICS[code];

  return {
    code,
    step,
    ...definition,
    metadata,
  };
}

export function logMailboxStep(input: {
  step: string;
  status: "start" | "ok" | "fail";
  code?: MailboxSetupCode;
  metadata?: Record<string, unknown>;
  recommendedAction?: string;
}) {
  const safeMetadata = input.metadata ? sanitizeDebugData(input.metadata) : undefined;
  const parts = [
    "[troninbox-mailbox]",
    `step=${input.step}`,
    `status=${input.status}`,
    `code=${input.code ?? "NONE"}`,
  ];

  if (input.recommendedAction) {
    parts.push(`recommendedAction="${input.recommendedAction}"`);
  }

  if (safeMetadata && Object.keys(safeMetadata).length) {
    parts.push(`meta=${JSON.stringify(safeMetadata)}`);
  }

  console.log(parts.join(" "));
}

export function classifyMailboxSetupError(error: unknown, step: string): MailboxSetupDiagnostic {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();
  const code = getMailboxSetupCodeFromError(error, normalized);

  return getMailboxSetupDiagnostic(code, step, {
    errorName: error instanceof Error ? error.name : typeof error,
    errorMessage: message,
  });
}

export function getMailboxSetupCodeFromError(
  error: unknown,
  normalizedMessage = getNormalizedMessage(error),
): MailboxSetupCode {
  const code = getPrismaErrorCode(error);
  const numericStatus = getNumericStatus(error);

  if (normalizedMessage.includes("invalid url") || normalizedMessage.includes("invalid connection string")) {
    return "DATABASE_URL_MALFORMED";
  }

  if (normalizedMessage.includes("railway.internal") && Boolean(process.env.VERCEL)) {
    return "DATABASE_URL_PRIVATE_HOST_ON_VERCEL";
  }

  if (
    normalizedMessage.includes("authentication failed") ||
    normalizedMessage.includes("password authentication failed") ||
    code === "P1000"
  ) {
    return "DATABASE_AUTH_FAILED";
  }

  if (normalizedMessage.includes("ssl") && (normalizedMessage.includes("required") || normalizedMessage.includes("unsupported"))) {
    return "DATABASE_SSL_REQUIRED";
  }

  if (normalizedMessage.includes("timed out") || normalizedMessage.includes("timeout") || code === "P1002") {
    return "DATABASE_CONNECT_TIMEOUT";
  }

  if (code === "P1001" || code === "P1017" || normalizedMessage.includes("can't reach database server")) {
    return "DATABASE_CONNECT_FAILED";
  }

  if (normalizedMessage.includes("prisma") && normalizedMessage.includes("initialization")) {
    return "PRISMA_CLIENT_INIT_FAILED";
  }

  if (normalizedMessage.includes("not implemented yet") || normalizedMessage.includes("not a supported mailbox provider")) {
    return "UNSUPPORTED_PROVIDER";
  }

  if (code === "P2021" || code === "P2022" || normalizedMessage.includes("relation") || normalizedMessage.includes("does not exist")) {
    return "PRISMA_SCHEMA_NOT_DEPLOYED";
  }

  if (numericStatus === 401 || normalizedMessage.includes("invalid credentials") || normalizedMessage.includes("invalid_grant")) {
    return "GOOGLE_TOKEN_REFRESH_FAILED";
  }

  if (numericStatus === 403 && normalizedMessage.includes("insufficient")) {
    return normalizedMessage.includes("mail.send") || normalizedMessage.includes("mail.readwrite")
      ? "MICROSOFT_SCOPE_MISSING"
      : "GMAIL_SCOPE_MISSING";
  }

  if (numericStatus === 403 && normalizedMessage.includes("admin consent")) {
    return "MICROSOFT_ADMIN_CONSENT_REQUIRED";
  }

  if ((numericStatus === 403 || numericStatus === 400) && normalizedMessage.includes("api") && normalizedMessage.includes("disabled")) {
    return "GMAIL_API_DISABLED";
  }

  if (numericStatus === 500 && normalizedMessage.includes("oauth")) {
    return "GOOGLE_OAUTH_SERVER_ERROR";
  }

  if (normalizedMessage.includes("access_denied") || normalizedMessage.includes("access denied")) {
    return "GOOGLE_OAUTH_ACCESS_DENIED";
  }

  if (normalizedMessage.includes("app isn't verified") || normalizedMessage.includes("access blocked") || normalizedMessage.includes("blocked this app")) {
    return "GOOGLE_OAUTH_BLOCKED_ACCESS";
  }

  return "UNKNOWN_MAILBOX_SETUP_FAILURE";
}

function getPrismaErrorCode(error: unknown) {
  if (!error || typeof error !== "object") {
    return undefined;
  }

  return "code" in error && typeof error.code === "string" ? error.code : undefined;
}

function getNumericStatus(error: unknown) {
  if (!error || typeof error !== "object") {
    return undefined;
  }

  const candidate = error as {
    status?: number;
    statusCode?: number;
    code?: number | string;
    response?: { status?: number };
  };

  return candidate.status ?? candidate.statusCode ?? candidate.response?.status ?? (typeof candidate.code === "number" ? candidate.code : undefined);
}

function getNormalizedMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message.toLowerCase();
  }

  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message.toLowerCase();
  }

  try {
    return JSON.stringify(error).toLowerCase();
  } catch {
    return String(error).toLowerCase();
  }
}

function sanitizeDebugData(data: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(data).map(([key, value]) => [key, sanitizeDebugValue(key, value)]));
}

function sanitizeDebugValue(key: string | undefined, value: unknown): unknown {
  const forbidden = ["token", "secret", "authorization", "cookie", "databaseurl", "key"];

  if (key && forbidden.some((word) => key.toLowerCase().includes(word))) {
    return "[REDACTED]";
  }

  if (typeof value === "string") {
    return value.length > 160 ? `${value.slice(0, 60)}...[truncated:${value.length}]` : value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeDebugValue(undefined, entry));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([nestedKey, nestedValue]) => [nestedKey, sanitizeDebugValue(nestedKey, nestedValue)]),
    );
  }

  return value;
}
