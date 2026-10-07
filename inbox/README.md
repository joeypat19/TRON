# TRON Mail Inbox

Inbox is the standalone TRON mailbox interface with database-backed TRON accounts.

Users create an account with an email, password, and a personal 4-, 6-, 8-, or 10-digit login code. Login requires the email/password step followed by the personal code. Passwords, codes, and session tokens are hashed; the browser only receives an HTTP-only session cookie. Every TRON account receives a private `user-<id>@tronxvi.com` mailbox.

Google and Microsoft mailbox connections are not part of the runtime. The old connector routes remain only as compatibility entry points for the unchanged interface; they provision/select the local TRON mailbox and never start external OAuth or call Gmail, Microsoft Graph, SMTP, or IMAP.

## Runtime architecture

- Vercel hosts the Next.js Inbox interface.
- Railway PostgreSQL stores TRON mailbox accounts and messages.
- `MailboxProvider.TRON` is the only supported runtime provider.
- The Inbox UI is preserved while the TRON mail transport is built separately.

## Local TRON address

When a TRON account is created, it provisions a private local address in the form:

```text
user-<account-id>@tronxvi.com
```

This creates the local mailbox record and keeps the Inbox UI operational. Actual internet mail delivery still requires the future TRON mail transport service: inbound SMTP, outbound delivery, spam filtering, attachment storage, DNS authentication, and abuse controls.

## Account recovery email

Recovery routes are implemented with single-use, expiring database tokens. Configure `AUTH_EMAIL_API_KEY` and `AUTH_EMAIL_FROM` (and optionally `AUTH_EMAIL_API_URL`) in the deployment environment to send recovery links through the configured email API. Environment files are intentionally not changed by repository work.

## Production environment

Required values remain:

- `APP_URL`
- `NEXT_PUBLIC_APP_URL`
- `DATABASE_URL`
- `MAILBOX_ENCRYPTION_KEY`

Deploy the committed Prisma migrations before serving production Inbox traffic:

```bash
npm run prisma:migrate:deploy
```

The migration adds the TRON provider value while preserving old database enum values for safe migration compatibility. Old Gmail/Microsoft rows are not selected or used by the TRON runtime.
