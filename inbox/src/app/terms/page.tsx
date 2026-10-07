import type { Metadata } from "next";
import { LegalPage } from "@/components/site/legal-page";
import { SUPPORT_EMAIL } from "@/components/site/site-footer";

export const metadata: Metadata = {
  title: "Terms of Service",
};

export default function TermsPage() {
  return (
    <LegalPage
      summary="These Terms of Service describe the rules for using Inbox and the responsibilities that come with connecting your own email account."
      title="Terms of Service"
    >
      {/* TODO: Have a lawyer review these terms before public launch. */}
      <p>Inbox is an email productivity and mailbox access application.</p>

      <h2>Using the Service</h2>
      <p>
        To use mailbox features, you must connect your own supported account through the relevant provider OAuth flow. You may only
        connect and access accounts that you are authorized to use.
      </p>

      <h2>User Responsibilities</h2>
      <p>You are responsible for the emails, drafts, and other actions you send or perform through Inbox.</p>

      <h2>Prohibited Conduct</h2>
      <p>You may not use Inbox for abuse or unlawful activity, including:</p>
      <ul>
        <li>spam</li>
        <li>phishing</li>
        <li>malware distribution</li>
        <li>unauthorized access to accounts, systems, or data</li>
        <li>illegal activity</li>
      </ul>

      <h2>Service Availability and Changes</h2>
      <p>
        Inbox may change, suspend, or discontinue features at any time. The service may also be unavailable from
        time to time due to maintenance, third-party issues, or technical problems.
      </p>

      <h2>No Warranty</h2>
      <p>
        Inbox is provided on an &quot;as is&quot; and &quot;as available&quot; basis without warranties of any kind,
        whether express or implied.
      </p>

      <h2>Limitation of Liability</h2>
      <p>
        To the maximum extent permitted by law, Inbox and its operator will not be liable for indirect, incidental,
        special, consequential, exemplary, or punitive damages, or for loss of data, profits, business, or goodwill
        arising from or related to your use of the service.
      </p>

      <h2>Suspension and Termination</h2>
      <p>
        Inbox may suspend or terminate access to the service if it reasonably believes the service is being used in
        violation of these terms or in a way that creates risk for the service, users, or third parties.
      </p>

      <h2>Stopping Use</h2>
      <p>
        You may stop using Inbox at any time and may revoke mailbox access through your provider permissions.
      </p>

      <h2>Governing Law</h2>
      <p>These terms are governed by the laws of the applicable jurisdiction where the service operator is located.</p>

      <h2>Contact</h2>
      <p>
        Questions about these terms can be sent to <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
      </p>
    </LegalPage>
  );
}
