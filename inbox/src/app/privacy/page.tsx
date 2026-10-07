import type { Metadata } from "next";
import { LegalPage } from "@/components/site/legal-page";
import { SUPPORT_EMAIL } from "@/components/site/site-footer";

export const metadata: Metadata = {
  title: "Privacy Policy",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      summary="This Privacy Policy explains how Inbox handles mailbox data, OAuth credentials, and related account information when you use the service."
      title="Privacy Policy"
    >
      <p>
        Inbox is an email productivity application that lets users connect supported mailbox providers and use
        mailbox features inside the Inbox interface.
      </p>

      <h2>Information We Access</h2>
      <p>
        When you connect a mailbox, Inbox may request permissions that allow the app to read, modify, compose, and
        send messages so the service can provide mailbox features that you choose to use.
      </p>
      <p>Depending on the feature, Inbox may process the following categories of data:</p>
      <ul>
        <li>your email address</li>
        <li>message metadata</li>
        <li>sender and recipient fields</li>
        <li>subject lines</li>
        <li>snippets and message body content where needed to provide the feature</li>
        <li>labels and thread identifiers</li>
        <li>draft and sent-message data if you create or send mail through Inbox</li>
      </ul>

      <h2>How Mailbox Data Is Used</h2>
      <p>
        Mailbox data is used only to provide mailbox functionality inside Inbox, such as loading inbox views,
        showing threads, supporting search, preparing drafts, and sending messages at your direction.
      </p>

      <h2>Storage and Security</h2>
      <p>
        OAuth tokens and mailbox connection data are stored securely and encrypted where applicable. Inbox uses
        technical and organizational measures designed to protect connected mailbox data.
      </p>
      <ul>
        <li>encryption is used for sensitive mailbox connection secrets where applicable</li>
        <li>access to connected mailbox data is restricted to what is needed to operate the service</li>
        <li>OAuth tokens are not intentionally exposed in any public interface</li>
      </ul>

      <h2>Data Sharing</h2>
      <p>Inbox does not sell user data and does not use mailbox data for advertising.</p>
      <p>
        Inbox does not share mailbox data except as needed to provide the service, comply with applicable law, or
        act on your direction.
      </p>

      <h2>Data Retention</h2>
      <p>
        Account and mailbox connection data may be retained while your account is active. If you disconnect a mailbox
        or request deletion, Inbox will delete relevant connection data where technically feasible.
      </p>

      <h2>Your Choices</h2>
      <p>
        You can revoke Inbox access through your Google Account permissions at any time. You can also request
        deletion of connected account data by contacting <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
      </p>

      <h2>Google API Services User Data Policy</h2>
      <p>
        Inbox&apos;s use and transfer of information received from Google APIs will adhere to the{" "}
        <a href="https://developers.google.com/terms/api-services-user-data-policy">
          Google API Services User Data Policy
        </a>
        , including the Limited Use requirements.
      </p>

      <h2>Contact</h2>
      <p>
        For privacy questions or deletion requests, contact <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
      </p>
    </LegalPage>
  );
}
