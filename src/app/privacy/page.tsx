import type { Metadata } from "next";
import LegalPage from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How the USLS Online Appointment System collects, uses, and protects your personal data.",
};

export default function PrivacyPolicyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="September 8, 2026">
      <section>
        <p>
          The <strong>USLS Online Appointment System (OAS)</strong> is operated by the{" "}
          <strong>University of St. La Salle</strong> (&quot;USLS&quot;, &quot;we&quot;, &quot;our&quot;, or &quot;us&quot;).
          This Privacy Policy explains what personal data we collect when you use the OAS website (the &quot;Service&quot;),
          why we collect it, how it is used and protected, and the rights you have over your data.
        </p>
        <p>
          We handle personal data in accordance with the Philippine <strong>Data Privacy Act of 2012
          (Republic Act No. 10173)</strong> and its Implementing Rules and Regulations.
        </p>
      </section>

      <section>
        <h2>1. What this policy covers</h2>
        <p>
          This policy applies to all personal data processed through the OAS booking website, including
          data you enter on the public booking form and data processed in the USLS admin area when offices
          review and manage appointments.
        </p>
      </section>

      <section>
        <h2>2. Personal data we collect and why</h2>
        <p>We collect only the information needed to schedule, verify, and manage campus appointments:</p>
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Why we collect it</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Full name</td>
              <td>To identify you in appointment records and to address you in email notifications.</td>
            </tr>
            <tr>
              <td>Phone number</td>
              <td>Backup contact information. Used only when an office needs to reach you and email is not
                  possible (for example, a bounced email or an urgent change to your appointment).</td>
            </tr>
            <tr>
              <td>Email address</td>
              <td>Primary channel for notifications: booking confirmation, approval/decline notices, and the
                  email that carries your gate entry code (reference number).</td>
            </tr>
            <tr>
              <td>Valid ID type</td>
              <td>The type of valid ID you will present at the gate (for example, Driver&apos;s License or
                  Student / School ID) so gate personnel can verify your identity. We do not store a photo,
                  a copy, or the ID number.</td>
            </tr>
            <tr>
              <td>Visitor category</td>
              <td>To understand who is visiting (student, faculty/staff, general public, alumni, vendor) so
                  offices can serve them appropriately.</td>
            </tr>
            <tr>
              <td>Office, date, time, and duration</td>
              <td>The schedule of your visit, including which office(s) will prepare for your arrival and how
                  capacity per time slot is managed.</td>
            </tr>
            <tr>
              <td>Purpose of visit (optional)</td>
              <td>A short note you may add so the office can prepare for your visit. Leave blank if preferred.</td>
            </tr>
            <tr>
              <td>Technical data</td>
              <td>Basic server logs (such as IP address, browser, and timestamps) generated automatically when
                  you visit the website, used to keep the service secure and reliable.</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <h2>3. How we use your data</h2>
        <ul>
          <li>To process and manage your appointment requests.</li>
          <li>To send appointment notifications, including your gate entry code (reference number).</li>
          <li>To verify your identity at the gate using the ID type you selected.</li>
          <li>To maintain office schedules, capacity, and appointment records.</li>
          <li>To keep the service secure and to maintain an audit trail of administrative actions.</li>
          <li>
            To keep a backup of appointment records so that the service remains available even if a
            database experiences an issue.
          </li>
        </ul>
        <p>
          We do <strong>not</strong> use your data for advertising, marketing, or profiling, and we do{" "}
          <strong>not</strong> sell or rent your personal data to anyone.
        </p>
      </section>

      <section>
        <h2>4. Legal basis for processing</h2>
        <p>
          We process your data based on <strong>your consent</strong>, which you give by ticking the consent
          box on the booking form, and on the legitimate processing needed to operate the university&apos;s
          official appointment service. Processing is limited to what is necessary for the purposes described
          in this policy, as required by RA 10173.
        </p>
      </section>

      <section>
        <h2>5. Where your data is stored</h2>
        <ul>
          <li>
            <strong>Live database:</strong> your appointment record is stored in our Supabase (PostgreSQL)
            database, which powers the website&apos;s real-time features.
          </li>
          <li>
            <strong>Backup (mirror) database:</strong> a copy of each appointment record is maintained in a
            separate cPanel MySQL database hosted on the university&apos;s hosting, written in parallel each
            time a record is created or updated.
          </li>
        </ul>
        <p>
          Access to both databases is restricted to authorized USLS personnel and systems, protected by
          strong credentials and role-based access controls.
        </p>
      </section>

      <section>
        <h2>6. Who we share your data with</h2>
        <ul>
          <li>
            <strong>USLS offices and personnel</strong> who need it to process your appointment, including
            office staff who review requests and gate personnel who verify your entry.
          </li>
          <li>
            <strong>Service providers</strong> that host and deliver the Service (for example, web hosting
            and email delivery providers), who process data only on our instructions and for the purposes
            described here.
          </li>
        </ul>
        <p>
          We do not share your data with unrelated third parties, and we never transfer it outside the
          scope of this policy.
        </p>
      </section>

      <section>
        <h2>7. How long we keep your data</h2>
        <p>
          Appointment records are retained for as long as needed to operate the Service, to respond to
          follow-up questions, and to maintain the university&apos;s audit trail. When a record is no longer
          needed for these purposes, it is removed. Individual data retention periods are set and reviewed
          by the university&apos;s system administrator.
        </p>
      </section>

      <section>
        <h2>8. How we protect your data</h2>
        <ul>
          <li>Role-based access controls, enforced on the server for every request.</li>
          <li>Password-protected staff accounts with hashed passwords.</li>
          <li>Tamper-proof, expiring links for email-based approvals and declines.</li>
          <li>Secure single-use gate entry codes.</li>
          <li>A logged audit trail of administrative actions.</li>
          <li>Encryption in transit and restricted access to stored records.</li>
        </ul>
      </section>

      <section>
        <h2>9. Your rights</h2>
        <p>Under RA 10173, you have the right to:</p>
        <ul>
          <li><strong>Be informed</strong> of how your data is processed (this policy).</li>
          <li><strong>Access</strong> the personal data we hold about you.</li>
          <li><strong>Object</strong> to processing that is not necessary for the service.</li>
          <li><strong>Correct</strong> inaccurate information (for example, by contacting the office).</li>
          <li><strong>Erase or block</strong> data that was processed unlawfully or beyond its purpose.</li>
          <li><strong>Withdraw consent</strong> and request deletion of your data, subject to applicable
              laws and the university&apos;s record-keeping obligations.</li>
          <li><strong>Complain</strong> to the National Privacy Commission (NPC) if you believe your data
              privacy rights have been violated.</li>
        </ul>
        <p>
          You do not need an account to exercise these rights. Contact us using the details below and we
          will respond within the period required by law.
        </p>
      </section>

      <section>
        <h2>10. Children&apos;s privacy</h2>
        <p>
          The Service may be used by students of the university. We collect only the information needed for
          an appointment. If you are a parent or guardian and have concerns about a minor&apos;s data, please
          contact us using the details below.
        </p>
      </section>

      <section>
        <h2>11. Changes to this policy</h2>
        <p>
          We may update this policy from time to time. The &quot;Last updated&quot; date at the top shows
          when it was last revised. Continued use of the Service after changes takes effect means you accept
          the updated policy. Where required by law, we will notify you of significant changes.
        </p>
      </section>

      <section>
        <h2>12. Contact us</h2>
        <p>
          For questions, requests, or concerns about this policy or your personal data, contact the office
          handling your appointment, or reach the university through the contact details shown in your
          appointment emails and on the university website (<a href="https://www.usls.edu.ph" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">usls.edu.ph</a>).
        </p>
      </section>
    </LegalPage>
  );
}