import "server-only";

type RuntimeEnvironmentValidationOptions = {
  enforceProduction?: boolean;
};

const REQUIRED_PRODUCTION_ENV_VARS = ["MAILBOX_ENCRYPTION_KEY"] as const;

function getEnv(name: string) {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

export function getAppUrl() {
  return getEnv("APP_URL") ?? getEnv("NEXT_PUBLIC_APP_URL") ?? "https://troninbox.com";
}

export function getEmailAssistantConfig() {
  return {
    provider: getEnv("AI_PROVIDER") ?? "openai",
    apiKey: getEnv("OPENAI_API_KEY"),
    model: getEnv("EMAIL_ASSISTANT_MODEL") ?? "gpt-5.4-mini",
  };
}

export function getEmailAssistantConfigIssue() {
  const config = getEmailAssistantConfig();

  if (!config.provider) {
    return "Assistant is not configured. Missing AI_PROVIDER.";
  }

  if (config.provider !== "openai") {
    return `Assistant is not configured. Unsupported AI_PROVIDER "${config.provider}".`;
  }

  if (!config.apiKey) {
    return "Assistant is not configured. Missing OPENAI_API_KEY.";
  }

  if (!config.model) {
    return "Assistant model is not configured.";
  }

  return null;
}

export function isEmailAssistantConfigured() {
  return getEmailAssistantConfigIssue() === null;
}

export function isProductionDeployment() {
  return process.env.NODE_ENV === "production" && process.env.VERCEL_ENV === "production";
}

export function validateRuntimeEnvironment(options: RuntimeEnvironmentValidationOptions = {}) {
  const enforceProduction = options.enforceProduction ?? isProductionDeployment();

  if (!enforceProduction) {
    return;
  }

  const missing: string[] = REQUIRED_PRODUCTION_ENV_VARS.filter((name) => !getEnv(name));
  const appUrl = getEnv("APP_URL") ?? getEnv("NEXT_PUBLIC_APP_URL");

  if (!appUrl) {
    missing.push("APP_URL or NEXT_PUBLIC_APP_URL");
  }

  if (!getEnv("DATABASE_URL")) {
    missing.push("DATABASE_URL");
  }

  if (missing.length) {
    throw new Error(
      `Missing required production environment variables: ${missing.join(", ")}.`,
    );
  }

  // TRON Mail is public for now; there are no account checks here.
}
