import type { Metadata } from "next";
import LegalPage from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Consent to Forms",
  description: "The consent you provide when submitting a form on the USLS Online Appointment System.",
};

export default function ConsentPage() {
  return (
    <LegalPage title="Consent to Forms" updated="September 8, 2026">
      <section>
        <p>
          When you submit the USLS OAS booking form, you are asked to give your <strong>consent</strong> to
          the processing of your personal data. This page explains, in plain terms, exactly what you are
          consenting to. This consent is required by the Philippine{" "}
          <strong>Data Privacy Act of 2012 (RA 10173)</strong>.
        </p>
      </section>

      <section>
        <h2>1. The consent statement</h2>
        <p>On the booking form you will be asked to agree to the following:</p>
        <div className="note">
          &quot;I consent to the collection, use, and storage of my personal data (name, contact details,
          valid ID type, and appointment information) for the purpose of processing my appointment request
          and verifying my identity at the campus gate, in accordance with RA 10173 (Data Privacy Act of 2012)
          and the USLS OAS Privacy Policy.&quot;
        </div>
        <p>
          By ticking the consent box and submitting the form, you confirm that you have read and understood
          this statement and that you agree to the processing described here and in our{" "}
          <a href="/privacy" className="text-primary hover:underline">Privacy Policy</a>.
        </p>
      </section>

      <section>
        <h2>2. What you are consenting to</h2>
        <ul>
          <li>
            <strong>Collection</strong> of the data on the form: your name, phone number (backup contact),
            email address (notifications and delivery of your gate entry code), the type of valid ID you will
            present, your visitor category, and your appointment details (office, date, time, duration, and an
            optional purpose note).
          </li>
          <li>
            <strong>Use</strong> of that data to process, approve or decline, and manage your appointment, and
            to notify you by email at each step.
          </li>
          <li>
            <strong>Storage</strong> of that data in the Service&apos;s live database and in its backup
            (mirror) database, as described in the Privacy Policy.
          </li>
          <li>
            <strong>Disclosure</strong> of that data to the authorized USLS offices and gate personnel who need
            it to handle your visit.
          </li>
        </ul>
      </section>

      <section>
        <h2>3. What we do NOT collect</h2>
        <p>
          We do not collect or store a photo of your ID, your ID number, or any other sensitive personal data
          beyond the type of valid ID you choose to present. Only the type of ID is recorded (for example,
          &quot;Passport&quot; or &quot;Student / School ID&quot;).
        </p>
      </section>

      <section>
        <h2>4. Consent is voluntary</h2>
        <p>
          Giving consent is your choice. However, without it we cannot process your appointment request, because
          the data is necessary to schedule the visit and verify your identity at the gate. If you do not wish
          to consent, please do not submit the form.
        </p>
      </section>

      <section>
        <h2>5. How your consent is recorded</h2>
        <p>
          Your consent is given by ticking the consent box on the booking form before submission. The time and
          details of your submission are kept as part of the appointment record, and administrative actions on
          your appointment are recorded in the Service&apos;s audit log.
        </p>
      </section>

      <section>
        <h2>6. Withdrawing your consent</h2>
        <p>
          You may withdraw your consent at any time by contacting the office handling your appointment (see
          the Privacy Policy for contact details). Withdrawal will not affect the lawfulness of processing that
          already took place before you withdrew. Withdrawal may mean we can no longer process or continue your
          appointment.
        </p>
        <p>
          To ask that your data be corrected or deleted, request access to your data, or raise a concern, contact
          us using the details in the{" "}
          <a href="/privacy" className="text-primary hover:underline">Privacy Policy</a>. You may also file a
          complaint with the National Privacy Commission (NPC).
        </p>
      </section>

      <section>
        <h2>7. Consent for minors</h2>
        <p>
          If an appointment is booked for a minor student, the person submitting the form confirms that they are
          authorized to provide the minor&apos;s information and consent on their behalf.
        </p>
      </section>

      <section>
        <h2>8. Where to learn more</h2>
        <p>
          For full details on how your data is collected, used, protected, and stored, please read our{" "}
          <a href="/privacy" className="text-primary hover:underline">Privacy Policy</a>. For the rules
          governing your use of the Service, see the{" "}
          <a href="/terms" className="text-primary hover:underline">Terms of Service</a>.
        </p>
      </section>
    </LegalPage>
  );
}