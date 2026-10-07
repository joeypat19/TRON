"use client";

import { useState } from "react";
import { BrandButton } from "@/components/ui/brand-button";
import { BrandCard } from "@/components/ui/brand-card";
import { BrandInput } from "@/components/ui/brand-input";
import { appPath } from "@/lib/app-path";
import { LOGIN_CODE_LENGTHS } from "@/lib/auth/constants";

type AuthMode = "login" | "signup";

export function AuthPageClient() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [loginStep, setLoginStep] = useState<"credentials" | "code">("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [loginCode, setLoginCode] = useState("");
  const [loginCodeConfirmation, setLoginCodeConfirmation] = useState("");
  const [loginCodeLength, setLoginCodeLength] = useState("6");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setLoginStep("credentials");
    setError(null);
    setMessage(null);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setPending(true);

    try {
      const payload = mode === "signup"
        ? { email, password, passwordConfirmation, loginCode, loginCodeConfirmation }
        : loginStep === "credentials"
          ? { email, password }
          : { code: loginCode };

      const response = await fetch(appPath(`/api/auth/${mode === "signup" ? "signup" : "login"}`), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.error ?? "Authentication failed.");
      }

      if (mode === "signup") {
        window.location.assign(appPath("/mail/inbox"));
        return;
      }

      if (result.requiresCode) {
        setLoginStep("code");
        setMessage(`Enter your ${result.loginCodeLength}-digit login code.`);
        return;
      }

      window.location.assign(appPath("/mail/inbox"));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Authentication failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--bg)] px-4 py-10 text-[var(--text)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,var(--accent-glow),transparent_42%),radial-gradient(circle_at_bottom_right,var(--accent-glow),transparent_34%)]" />
      <BrandCard className="relative w-full max-w-lg border-[var(--line)] bg-[var(--surface-overlay)] p-7 shadow-[0_24px_80px_var(--shadow-color)] md:p-9" tone="strong">
        <div className="mb-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[var(--accent)]">TRON</p>
          <h1 className="mt-3 text-3xl font-semibold">{mode === "login" ? "Welcome back" : "Create your TRON account"}</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
            {mode === "login" ? "Sign in with your email, password, and personal login code." : "Your personal code is required every time you sign in."}
          </p>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-2 rounded-full border border-[var(--line)] bg-[var(--surface)] p-1">
          {(["login", "signup"] as const).map((value) => (
            <button
              className={`rounded-full px-4 py-2.5 text-sm font-medium transition ${mode === value ? "bg-[var(--accent)] text-[var(--accent-contrast)]" : "text-[var(--text-muted)] hover:text-[var(--text)]"}`}
              key={value}
              onClick={() => switchMode(value)}
              type="button"
            >
              {value === "login" ? "Log in" : "Create account"}
            </button>
          ))}
        </div>

        <form className="grid gap-4" onSubmit={submit}>
          {mode === "login" && loginStep === "code" ? (
            <>
              <label className="grid gap-2 text-sm font-medium">
                Personal login code
                <BrandInput
                  autoComplete="one-time-code"
                  autoFocus
                  inputMode="numeric"
                  maxLength={10}
                  onChange={(event) => setLoginCode(event.target.value.replace(/\D/g, ""))}
                  placeholder="Enter your code"
                  required
                  type="password"
                  value={loginCode}
                />
              </label>
              <button className="text-left text-sm text-[var(--accent)] hover:underline" onClick={() => { setLoginStep("credentials"); setMessage(null); }} type="button">
                Back to email and password
              </button>
            </>
          ) : (
            <>
              <label className="grid gap-2 text-sm font-medium">
                Email
                <BrandInput autoComplete="email" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Password
                <BrandInput autoComplete={mode === "signup" ? "new-password" : "current-password"} onChange={(event) => setPassword(event.target.value)} required type="password" value={password} />
              </label>

              {mode === "signup" ? (
                <>
                  <label className="grid gap-2 text-sm font-medium">
                    Confirm password
                    <BrandInput autoComplete="new-password" onChange={(event) => setPasswordConfirmation(event.target.value)} required type="password" value={passwordConfirmation} />
                  </label>
                  <label className="grid gap-2 text-sm font-medium">
                    Personal code length
                    <select className="w-full rounded-[20px] border border-[var(--line)] bg-[var(--surface-overlay)] px-4 py-3 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]" onChange={(event) => setLoginCodeLength(event.target.value)} value={loginCodeLength}>
                      {LOGIN_CODE_LENGTHS.map((length) => <option key={length} value={length}>{length} digits</option>)}
                    </select>
                  </label>
                  <label className="grid gap-2 text-sm font-medium">
                    Personal login code
                    <BrandInput inputMode="numeric" maxLength={Number(loginCodeLength)} onChange={(event) => setLoginCode(event.target.value.replace(/\D/g, ""))} required type="password" value={loginCode} />
                  </label>
                  <label className="grid gap-2 text-sm font-medium">
                    Confirm personal login code
                    <BrandInput inputMode="numeric" maxLength={Number(loginCodeLength)} onChange={(event) => setLoginCodeConfirmation(event.target.value.replace(/\D/g, ""))} required type="password" value={loginCodeConfirmation} />
                  </label>
                </>
              ) : null}
            </>
          )}

          {error ? <p className="rounded-2xl border border-red-400/40 bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</p> : null}
          {message ? <p className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--text-muted)]">{message}</p> : null}

          <BrandButton className="mt-2 min-h-12" disabled={pending} type="submit">
            {pending ? "Please wait…" : mode === "signup" ? "Create account" : loginStep === "code" ? "Complete login" : "Continue"}
          </BrandButton>
          {mode === "login" && loginStep === "credentials" ? <a className="text-center text-sm text-[var(--accent)] hover:underline" href={appPath("/auth/recover")}>Forgot your password or login code?</a> : null}
        </form>
      </BrandCard>
    </main>
  );
}
