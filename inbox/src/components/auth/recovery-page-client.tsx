"use client";

import { useState } from "react";
import { BrandButton } from "@/components/ui/brand-button";
import { BrandCard } from "@/components/ui/brand-card";
import { BrandInput } from "@/components/ui/brand-input";
import { appPath } from "@/lib/app-path";
import { LOGIN_CODE_LENGTHS } from "@/lib/auth/constants";

type RecoveryType = "password" | "login_code";

export function RecoveryPageClient({ initialToken, initialType }: { initialToken: string; initialType: RecoveryType }) {
  const [type, setType] = useState<RecoveryType>(initialType);
  const [email, setEmail] = useState("");
  const [token] = useState(initialToken);
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [loginCodeLength, setLoginCodeLength] = useState(6);
  const [loginCode, setLoginCode] = useState("");
  const [loginCodeConfirmation, setLoginCodeConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function requestRecovery(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(appPath("/api/auth/recovery/request"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, type }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to send recovery instructions.");
      setMessage(result.message);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to send recovery instructions.");
    } finally {
      setPending(false);
    }
  }

  async function completeRecovery(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(appPath("/api/auth/recovery/complete"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, type, password, passwordConfirmation, loginCode, loginCodeConfirmation }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to update account credentials.");
      setMessage(result.message);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update account credentials.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-[var(--bg)] px-4 py-10 text-[var(--text)]">
      <BrandCard className="w-full max-w-lg border-[var(--line)] bg-[var(--surface-overlay)] p-7 md:p-9" tone="strong">
        <div className="mb-7 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[var(--accent)]">TRON ACCOUNT RECOVERY</p>
          <h1 className="mt-3 text-3xl font-semibold">Recover access</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">Use the secure link sent to your account email, then choose new credentials.</p>
        </div>

        {!token ? (
          <form className="grid gap-4" onSubmit={requestRecovery}>
            <label className="grid gap-2 text-sm font-medium">
              Recovery type
              <select className="w-full rounded-[20px] border border-[var(--line)] bg-[var(--surface-overlay)] px-4 py-3 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]" onChange={(event) => setType(event.target.value as RecoveryType)} value={type}>
                <option value="password">Reset password</option>
                <option value="login_code">Reset login code</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Account email
              <BrandInput autoComplete="email" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} />
            </label>
            <BrandButton disabled={pending} type="submit">{pending ? "Sending…" : "Send recovery link"}</BrandButton>
          </form>
        ) : (
          <form className="grid gap-4" onSubmit={completeRecovery}>
            {type === "password" ? (
              <>
                <label className="grid gap-2 text-sm font-medium">New password<BrandInput minLength={8} onChange={(event) => setPassword(event.target.value)} required type="password" value={password} /></label>
                <label className="grid gap-2 text-sm font-medium">Confirm new password<BrandInput minLength={8} onChange={(event) => setPasswordConfirmation(event.target.value)} required type="password" value={passwordConfirmation} /></label>
              </>
            ) : (
              <>
                <label className="grid gap-2 text-sm font-medium">
                  New login code
                  <select className="w-full rounded-[20px] border border-[var(--line)] bg-[var(--surface-overlay)] px-4 py-3 text-sm text-[var(--text)]" onChange={(event) => { const length = Number(event.target.value); setLoginCodeLength(length); setLoginCode(""); setLoginCodeConfirmation(""); }} value={loginCodeLength}>
                    {LOGIN_CODE_LENGTHS.map((length) => <option key={length} value={length}>{length} digits</option>)}
                  </select>
                  <BrandInput inputMode="numeric" maxLength={loginCodeLength} onChange={(event) => setLoginCode(event.target.value.replace(/\D/g, ""))} required type="password" value={loginCode} />
                </label>
                <label className="grid gap-2 text-sm font-medium">Confirm new login code<BrandInput inputMode="numeric" maxLength={loginCodeLength} onChange={(event) => setLoginCodeConfirmation(event.target.value.replace(/\D/g, ""))} required type="password" value={loginCodeConfirmation} /></label>
              </>
            )}
            <BrandButton disabled={pending} type="submit">{pending ? "Updating…" : "Update credentials"}</BrandButton>
          </form>
        )}

        {error ? <p className="mt-4 rounded-2xl border border-red-400/40 bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</p> : null}
        {message ? <p className="mt-4 rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--text-muted)]">{message}</p> : null}
        <a className="mt-6 block text-center text-sm text-[var(--accent)] hover:underline" href={appPath("/auth")}>Back to login</a>
      </BrandCard>
    </main>
  );
}
