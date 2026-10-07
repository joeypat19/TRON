export class AuthenticationRequiredError extends Error {
  constructor() {
    super("Authentication is required.");
    this.name = "AuthenticationRequiredError";
  }
}

export class AuthValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthValidationError";
  }
}

export class AuthEmailNotConfiguredError extends Error {
  constructor() {
    super("Account recovery email delivery is not configured.");
    this.name = "AuthEmailNotConfiguredError";
  }
}
