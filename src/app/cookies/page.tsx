import type { Metadata } from "next";
import LegalPage from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Cookie Policy",
  description: "How the USLS Online Appointment System uses cookies.",
};

export default function CookiesPage() {
  return (
    <LegalPage title="Cookie Policy" updated="September 8, 2026">
      <section>
        <p>
          This Cookie Policy explains what cookies are, which cookies the{" "}
          <strong>USLS Online Appointment System (OAS)</strong> uses, and how you can control them.
        </p>
      </section>

      <section>
        <h2>1. What are cookies?</h2>
        <p>
          Cookies are small text files placed on your device by a website when you visit it. They help a
          website remember information about your visit, such as your sign-in status, so it can work
          correctly.
        </p>
      </section>

      <section>
        <h2>2. Cookies we use</h2>
        <p>
          The OAS website uses only <strong>strictly necessary</strong> cookies and similar technologies
          needed for the Service to function. We use <strong>no</strong> advertising cookies, tracking
          cookies, or third-party analytics cookies.
        </p>
        <table>
          <thead>
            <tr>
              <th>Type</th>
              <th>Purpose</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Authentication session cookies</td>
              <td>
                Required for the USLS staff (admin) area. They identify a signed-in staff member so that
                administrative pages can be accessed securely. These are set by our authentication provider
                and are HTTP-only.
              </td>
            </tr>
            <tr>
              <td>Essential platform cookies</td>
              <td>
                Small technical cookies that keep the site stable and secure while you browse the public
                booking pages. They do not collect information for advertising or marketing.
              </td>
            </tr>
          </tbody>
        </table>
        <p>
          We do not use cookies to build a profile of you, to track you across other websites, or to deliver
          targeted advertising.
        </p>
      </section>

      <section>
        <h2>3. Local storage</h2>
        <p>
          We do not rely on browser local storage to collect personal data. The public booking experience
          works without storing personal information on your device.
        </p>
      </section>

      <section>
        <h2>4. How to control cookies</h2>
        <p>
          You can set your browser to refuse all or some cookies, or to alert you before a cookie is set.
          Because the cookies we use are necessary for the Service, disabling cookies may prevent parts of
          the Service from working correctly — for example, the USLS staff area may not be able to keep you
          signed in.
        </p>
        <p>
          To manage cookies, use your browser&apos;s settings (usually under Privacy or Security). Help pages
          for common browsers describe how to clear or block cookies.
        </p>
      </section>

      <section>
        <h2>5. Third-party services</h2>
        <p>
          The Service is hosted with the help of providers that may set their own necessary cookies as part
          of delivering the platform. These cookies are functional, not for advertising. Personal data handled
          through these providers is governed by our{" "}
          <a href="/privacy" className="text-primary hover:underline">Privacy Policy</a>.
        </p>
      </section>

      <section>
        <h2>6. Changes to this policy</h2>
        <p>
          We may update this Cookie Policy from time to time. The &quot;Last updated&quot; date at the top
          shows when it was last revised.
        </p>
      </section>

      <section>
        <h2>7. Contact us</h2>
        <p>
          If you have questions about cookies or this policy, contact the university through the contact
          details shown in your appointment emails or on the university website (
          <a href="https://www.usls.edu.ph" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">usls.edu.ph</a>).
        </p>
      </section>
    </LegalPage>
  );
}