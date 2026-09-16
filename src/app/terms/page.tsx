import type { Metadata } from "next";
import LegalPage from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms and conditions for using the USLS Online Appointment System.",
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="September 8, 2026">
      <section>
        <p>
          These Terms of Service (&quot;Terms&quot;) govern your use of the{" "}
          <strong>USLS Online Appointment System (OASYS)</strong>, operated by the{" "}
          <strong>University of St. La Salle</strong> (&quot;USLS&quot;, &quot;we&quot;, &quot;our&quot;).
          By accessing or using the OASYS website (the &quot;Service&quot;), you agree to these Terms. If you
          do not agree, please do not use the Service.
        </p>
      </section>

      <section>
        <h2>1. Description of the service</h2>
        <p>
          The Service lets campus visitors schedule appointments with university offices in advance, receive
          approval or decline notices by email, and obtain a gate entry code (reference number) for entry at
          the specified campus gate on the day of their visit.
        </p>
      </section>

      <section>
        <h2>2. Eligibility and accuracy of information</h2>
        <ul>
          <li>You must provide accurate, current, and complete information when booking.</li>
          <li>
            You must provide a working email address, because notifications and your gate entry code are
            delivered by email. A valid phone number is requested as a backup contact.
          </li>
          <li>
            You must select a valid ID that you are genuinely able to present at the gate on the day of
            your visit.
          </li>
        </ul>
      </section>

      <section>
        <h2>3. Booking, review, and approval</h2>
        <ul>
          <li>Submitting a booking form is a <strong>request</strong>, not a confirmed appointment.</li>
          <li>
            Offices review requests and may approve or decline them at their discretion, for example based
            on capacity, eligibility, or office availability.
          </li>
          <li>
            A request is confirmed only when the office approves it and the approval notice is issued.
          </li>
          <li>
            Time slots are provided on a first-come, first-served basis subject to office capacity. A slot
            shown as available may be taken by another visitor between the time you view it and the time you
            submit.
          </li>
        </ul>
      </section>

      <section>
        <h2>4. Gate entry code (reference number)</h2>
        <ul>
          <li>Approved appointments receive a single-use gate entry code.</li>
          <li>The code is valid only on your scheduled appointment date and only for one entry.</li>
          <li>
            The code is delivered to the email address you provided; we are not responsible if an incorrect
            email address prevents delivery.
          </li>
          <li>
            If a code is used, lost, or expires, the office may issue a new code at its discretion. Only the
            most recently issued code is valid.
          </li>
        </ul>
      </section>

      <section>
        <h2>5. Cancellation, decline, and no-show</h2>
        <ul>
          <li>Offices may decline or cancel appointments, with or without notice, where necessary.</li>
          <li>
            If you do not arrive for an approved appointment on the scheduled date, the appointment is
            marked as expired.
          </li>
          <li>
            This is a free scheduling service. No fees, refunds, or penalties apply to cancellations or
            no-shows.
          </li>
        </ul>
      </section>

      <section>
        <h2>6. Acceptable use</h2>
        <p>You agree not to:</p>
        <ul>
          <li>Submit false, misleading, or fraudulent appointment information.</li>
          <li>Attempt to access the USLS admin area or any other unauthorized part of the Service.</li>
          <li>Use the Service in any way that disrupts, damages, or interferes with its operation.</li>
          <li>Attempt to gain unauthorized access to other users&apos; data or USLS systems.</li>
          <li>Use another person&apos;s identity or appointment code without authorization.</li>
          <li>Violate any applicable law or the university&apos;s rules and regulations.</li>
        </ul>
      </section>

      <section>
        <h2>7. Intellectual property</h2>
        <p>
          The Service, including its design, text, graphics, logos, and software, belongs to USLS and its
          licensors. You may not copy, modify, distribute, or create derivative works from the Service
          without our prior written permission.
        </p>
      </section>

      <section>
        <h2>8. Disclaimers</h2>
        <p>
          The Service is provided &quot;as is&quot; and &quot;as available&quot; without warranties of any
          kind, whether express or implied, to the fullest extent permitted by law. We do not warrant that
          the Service will operate uninterrupted, error-free, or that office schedules will not change.
          Appointment decisions are made by the offices, not by the Service.
        </p>
      </section>

      <section>
        <h2>9. Limitation of liability</h2>
        <p>
          To the fullest extent permitted by law, USLS shall not be liable for any indirect, incidental,
          special, consequential, or punitive damages arising from or related to your use of the Service.
          Nothing in these Terms limits liability that cannot be limited under applicable law.
        </p>
      </section>

      <section>
        <h2>10. Privacy and consent</h2>
        <p>
          Your use of the Service is also governed by our{" "}
          <a href="/privacy" className="text-primary hover:underline">Privacy Policy</a> and the consent you
          provide on the booking form (see{" "}
          <a href="/consent" className="text-primary hover:underline">Consent to Forms</a>). By using the
          Service, you agree to the processing of your data as described there.
        </p>
      </section>

      <section>
        <h2>11. Changes to these terms</h2>
        <p>
          We may revise these Terms from time to time. The &quot;Last updated&quot; date at the top shows
          when they were last revised. Continued use of the Service after changes take effect means you
          accept the updated Terms.
        </p>
      </section>

      <section>
        <h2>12. Governing law and disputes</h2>
        <p>
          These Terms are governed by the laws of the Republic of the Philippines. Any disputes arising from
          the Service will be resolved amicably, and where necessary, through the appropriate courts of the
          Philippines.
        </p>
      </section>

      <section>
        <h2>13. Contact</h2>
        <p>
          For questions about these Terms, contact the office handling your appointment or the university
          through the contact details provided in your appointment emails and on the university website (
          <a href="https://www.usls.edu.ph" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">usls.edu.ph</a>).
        </p>
      </section>
    </LegalPage>
  );
}