# TRON Mail Inbox

Inbox is the standalone TRON mailbox interface. It currently runs as a public local mailbox while the account system is being built.

Google and Microsoft mailbox connections are not part of the runtime. The old connector routes remain only as compatibility entry points for the unchanged interface; they provision/select the local TRON mailbox and never start external OAuth or call Gmail, Microsoft Graph, SMTP, or IMAP.

## Runtime architecture

- Vercel hosts the Next.js Inbox interface.
- Railway PostgreSQL stores TRON mailbox accounts and messages.
- `MailboxProvider.TRON` is the only supported runtime provider.
- The Inbox UI is preserved while the TRON mail transport is built separately.

## Local TRON address

When Inbox first opens, it provisions a shared local address in the form:

```text
user-<account-id>@tronxvi.com
```

This creates the local mailbox record and keeps the Inbox UI operational. Actual internet mail delivery still requires the future TRON mail transport service: inbound SMTP, outbound delivery, spam filtering, attachment storage, DNS authentication, and abuse controls.

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
