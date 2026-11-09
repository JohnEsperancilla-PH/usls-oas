import type { ReactNode } from "react";
import type { EntryWindow } from "@/lib/entry-window";
import { describeEntryOpening, describeMinutes, getArrivalNote, getEntryRuleNote } from "@/lib/entry-window";
import { InfographicViewer } from "@/components/help/InfographicViewer";

// e.g. "30 minutes before the scheduled time until 1 hour after the scheduled time"
function entryRange(w: EntryWindow) {
  return `${describeEntryOpening(w)} until ${w.lateMinutes > 0 ? `${describeMinutes(w.lateMinutes)} after the scheduled time` : "the scheduled time"}`;
}

// Guide sections for /guide. Plain server components; styling comes from .legal-content.

function Contents({ items }: { items: [string, string][] }) {
  return (
    <nav aria-label="On this page" className="rounded-lg bg-gray-50 border border-gray-100 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">On this page</p>
      <ol className="!list-none !pl-0 grid grid-cols-1 sm:grid-cols-2 gap-x-4 !space-y-1">
        {items.map(([id, label], i) => (
          <li key={id}><a href={`#${id}`} className="text-primary hover:underline">{i + 1}. {label}</a></li>
        ))}
      </ol>
    </nav>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-6 space-y-3">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

const Tip = ({ children }: { children: ReactNode }) => <p className="note">{children}</p>;

export function VisitorGuide({ entryWindow }: { entryWindow: EntryWindow }) {
  return (
    <>
      <p>
        No account is needed to book. You fill in a short form, the office reviews it, and you get an email with your
        <strong> reference number</strong>, which is your pass at the gate.
      </p>
      <InfographicViewer />
      <Contents items={[["book", "Book an appointment"], ["dates", "Picking a date and time"], ["after", "After you book"], ["visit", "On your visit day"], ["statuses", "Appointment statuses"], ["help", "Need help?"]]} />

      <Section id="book" title="1. Book an appointment">
        <ol>
          <li>Open the booking page and click <strong>Book an Appointment</strong>.</li>
          <li><strong>Your details:</strong> full name, phone, email (your updates go here), visitor category, and the valid ID you&apos;ll show the guard.</li>
          <li>Coming as a group? Choose <strong>Multiple Visitors</strong> (up to 10) and enter each person&apos;s name and ID. Bringing a vehicle? Add the plate numbers (up to 5).</li>
          <li>Tick the consent box and continue.</li>
          <li><strong>Appointment details:</strong> pick the office (grouped by department, or search by name) and the person you&apos;re meeting.</li>
          <li>Pick a date, a time, and a duration (30 or 60 minutes), then type the purpose of your visit.</li>
          <li>Check the booking summary and click <strong>Submit Appointment</strong>.</li>
        </ol>
      </Section>

      <Section id="dates" title="2. Picking a date and time">
        <ul>
          <li>Coloured dots show how open a day is: <strong>green</strong> available, <strong>amber</strong> limited, <strong>red</strong> full.</li>
          <li>Weekends, past days, and days outside the booking window can&apos;t be picked.</li>
          <li>Days marked <strong>Closed</strong> are holidays or campus closures. The reason is listed under the calendar.</li>
          <li>Time slots show how many spots are left. <em>Full</em>, <em>Blocked</em> (the office is unavailable), and <em>Passed</em> slots can&apos;t be picked.</li>
          <li>Some offices don&apos;t show times. In that case, pick a date and the office will contact you with a time.</li>
        </ul>
        <Tip>The time you pick is a <strong>preferred time</strong>. It&apos;s only confirmed when the office approves your request.</Tip>
      </Section>

      <Section id="after" title="3. After you book">
        <p>You get a confirmation email right away (status <strong>Pending</strong>). When the office reviews it, you&apos;ll get one of these:</p>
        <table>
          <thead><tr><th>Email</th><th>What it means</th></tr></thead>
          <tbody>
            <tr><td>Approved</td><td>Your visit is confirmed. The email has your <strong>reference number</strong> and QR code.</td></tr>
            <tr><td>Postponed</td><td>The office moved your visit. The email shows the new date and time.</td></tr>
            <tr><td>Declined</td><td>The office couldn&apos;t accept it. You can book another time.</td></tr>
          </tbody>
        </table>
        <Tip>Please wait for the approval email before going to campus. Keep it: the reference number is your gate pass.</Tip>
      </Section>

      <Section id="visit" title="4. On your visit day">
        <ul>
          <li>{getArrivalNote(entryWindow)} {getEntryRuleNote(entryWindow)}</li>
          <li>Show the guard your <strong>reference number or QR code</strong> and the <strong>valid ID</strong> you chose when booking.</li>
          <li>Groups enter together using the booking person&apos;s reference number.</li>
          <li>A reference number works once, on the day and time of your visit only.</li>
        </ul>
      </Section>

      <Section id="statuses" title="5. Appointment statuses">
        <table>
          <thead><tr><th>Status</th><th>Meaning</th></tr></thead>
          <tbody>
            <tr><td>Pending</td><td>The office hasn&apos;t reviewed it yet.</td></tr>
            <tr><td>Approved</td><td>Confirmed. You can enter at the gate.</td></tr>
            <tr><td>Postponed</td><td>Moved to a new date or time.</td></tr>
            <tr><td>Declined</td><td>Not accepted.</td></tr>
            <tr><td>Completed</td><td>You&apos;ve entered campus.</td></tr>
            <tr><td>Expired</td><td>The entry time passed without the pass being used.</td></tr>
          </tbody>
        </table>
      </Section>

      <Section id="help" title="6. Need help?">
        <p>Contact the office you booked. Their email and phone number are in your booking emails and on the University Offices page.</p>
      </Section>
    </>
  );
}

export function OfficeAdminGuide() {
  return (
    <>
      <p>
        Office admins review their office&apos;s appointments, invite visitors, and manage their schedule and contacts.
        You only see your own office (and its sub-offices, if it has any).
      </p>
      <Contents items={[["signin", "Signing in"], ["dashboard", "Your calendar"], ["review", "Approve, decline, postpone"], ["email-actions", "Acting from email"], ["invite", "New invitations"], ["block", "Blocking time slots"], ["closed", "Closed dates"], ["contacts", "Office contacts"], ["office-settings", "Office settings"], ["sub-offices", "Sub-offices"], ["analytics", "Analytics"]]} />

      <Section id="signin" title="1. Signing in">
        <ol>
          <li>Go to <strong>/admin/login</strong> and sign in with your email and password.</li>
          <li>New here? Use <strong>Register Office Admin</strong> on the login page. A super admin has to approve your account before you can sign in.</li>
          <li>Forgot your password? Use <strong>Forgot password</strong> on the login page.</li>
        </ol>
      </Section>

      <Section id="dashboard" title="2. Your calendar">
        <ul>
          <li><strong>Appointments</strong> opens your office&apos;s calendar. Switch between <strong>Calendar</strong> and <strong>List</strong> at the top.</li>
          <li>Filter by <em>Pending</em>, <em>Approved</em>, <em>Postponed</em>, <em>Declined</em>, or <em>All</em>.</li>
          <li>Past days are greyed out. Blocked slots show as &quot;N blocked&quot;, and campus closures show a red <strong>Closed</strong> label.</li>
          <li>Click an appointment to open its details. In calendar view, &quot;+N more&quot; opens that day in the list.</li>
        </ul>
      </Section>

      <Section id="review" title="3. Approve, decline, or postpone">
        <ol>
          <li>Open the appointment and read the visitor&apos;s details.</li>
          <li><strong>Approve</strong> confirms it. The visitor gets the approval email with their reference number, and a calendar event is created. If your office hides time slots, set the time first.</li>
          <li><strong>Decline</strong> with an optional reason. The visitor gets an email with a link to book again.</li>
          <li><strong>Postpone</strong> to a new date and time. The visitor gets an email showing the old and new schedule. Closed dates can&apos;t be picked.</li>
          <li>For a completed visit, <strong>Re-issue Reference &amp; Re-send Email</strong> gives the visitor a new pass (e.g. they&apos;re coming back).</li>
        </ol>
      </Section>

      <Section id="email-actions" title="4. Acting from email">
        <p>New-booking alert emails have <strong>Approve</strong> and <strong>Deny</strong> buttons. They work without signing in for 72 hours.</p>
      </Section>

      <Section id="invite" title="5. New invitations (pre-approved passes)">
        <p>Use this for visitors you&apos;ve already cleared. The pass is approved right away.</p>
        <ol>
          <li>Click <strong>+ New Invitation</strong> on the calendar or the Invitations page.</li>
          <li>Pick the <strong>date</strong> on the calendar, then a <strong>time</strong> slot, then <strong>30 or 60 minutes</strong>. Full or blocked slots can still be picked; you&apos;ll see a warning.</li>
          <li>Enter the visitor&apos;s name. Email, phone, category, valid ID, person to meet, and purpose are optional.</li>
          <li>Optional: more visitors, vehicles, <strong>tagged contacts</strong> (they get the calendar invite), and tagged sub-offices.</li>
          <li>Click <strong>Create Invitation</strong>. If you gave an email, the visitor gets the invitation with a PDF ticket. You can also download the ticket.</li>
        </ol>
        <Tip>To download a ticket again later, go to <strong>Invitations</strong> and click <strong>Ticket PDF</strong>.</Tip>
      </Section>

      <Section id="block" title="6. Blocking time slots">
        <ol>
          <li>In calendar view, hover over a day and click <strong>+</strong> (or <strong>Block slots</strong> in list view).</li>
          <li>Click a time to block it, with an optional reason. Click a blocked slot again to unblock it.</li>
        </ol>
        <p>Blocked slots stop showing as available to visitors.</p>
      </Section>

      <Section id="closed" title="7. Closed dates">
        <p>Holidays and campus closures are set by super admins for every office. They appear on your calendar as <strong>Closed</strong>, and nobody can book, invite, or postpone to them. Appointments that were already booked on those days stay, so review them and postpone or decline as needed.</p>
      </Section>

      <Section id="contacts" title="8. Office contacts">
        <ul>
          <li>Go to <strong>Contacts</strong> and click <strong>Add Contact</strong> (name, email, position).</li>
          <li>Contacts can be picked as the &quot;person to meet&quot; and tagged on invitations.</li>
          <li>Use <strong>Edit</strong> or <strong>Remove</strong> on a contact to change it.</li>
        </ul>
      </Section>

      <Section id="office-settings" title="9. Office settings">
        <p>Under <strong>Office Settings</strong> you can change your office&apos;s contact details, hide time slots from visitors, and set your own booking limits (how far ahead people can book and the minimum notice).</p>
      </Section>

      <Section id="sub-offices" title="10. Sub-offices">
        <p>If a super admin has allowed it, a <strong>Sub-offices</strong> tab lets you create sub-offices with their own schedule and accounts. You can see and act on your sub-offices&apos; appointments.</p>
      </Section>

      <Section id="analytics" title="11. Analytics">
        <p><strong>Analytics</strong> shows booking and visitor totals for your office over time.</p>
      </Section>
    </>
  );
}

export function GuardGuide({ entryWindow, showGuardAdmin = false }: { entryWindow: EntryWindow; showGuardAdmin?: boolean }) {
  return (
    <>
      <p>Guards check visitors in and out at the gate using the <strong>Gate Entry</strong> page.</p>
      <Contents items={[["gate-signin", "Signing in"], ["screen", "The gate screen"], ["verify", "Verifying a visitor"], ["allow", "Allowing or denying entry"], ["checkout", "Checking visitors out"], ["messages", "Common messages"], ["outage", "Power or internet outage"], ["device", "Device care"], ...(showGuardAdmin ? [["guard-admin", "For guard admins"] as [string, string]] : [])]} />

      <Section id="gate-signin" title="1. Signing in">
        <ol>
          <li>Open <strong>/entry</strong> on the gate device.</li>
          <li>Enter your <strong>username</strong> and password, then sign in.</li>
          <li>At the end of your shift, click <strong>Sign Out</strong>.</li>
        </ol>
      </Section>

      <Section id="screen" title="2. The gate screen">
        <ul>
          <li><strong>Today&apos;s expected visitors</strong> lists everyone approved for today. Click a name to fill in their reference.</li>
          <li><strong>Gate Entry</strong> has the camera (<strong>Start Camera</strong>) and a keypad for typing a reference number.</li>
        </ul>
      </Section>

      <Section id="verify" title="3. Verifying a visitor">
        <ol>
          <li>Scan the visitor&apos;s <strong>QR code</strong>, or type their reference number and click <strong>Verify Reference Number</strong>.</li>
          <li>Check the details on screen: name, office, person to meet, date and time, and the <strong>valid ID to present</strong>.</li>
          <li>Ask for that ID and make sure it matches. For groups, check each listed visitor and any registered vehicles.</li>
        </ol>
        <Tip>The camera needs a secure (HTTPS) connection and camera permission. If it won&apos;t start, type the reference number instead.</Tip>
      </Section>

      <Section id="allow" title="4. Allowing or denying entry">
        <ul>
          <li><strong>Allow Entry</strong> records the entry time. The appointment becomes Completed.</li>
          <li><strong>Deny Entry</strong> asks for a reason, then records the denial.</li>
          <li>Entry is accepted from <strong>{entryRange(entryWindow)}</strong>.</li>
        </ul>
      </Section>

      <Section id="checkout" title="5. Checking visitors out">
        <p>When a visitor leaves, verify their reference again and click <strong>Record Visitor Checkout</strong>.</p>
      </Section>

      <Section id="messages" title="6. Common messages">
        <table>
          <thead><tr><th>Message</th><th>What to do</th></tr></thead>
          <tbody>
            <tr><td>Too early / too late</td><td>Outside the entry time. Ask them to wait, or don&apos;t admit if it&apos;s past the cutoff.</td></tr>
            <tr><td>Already used</td><td>The pass was already scanned. Don&apos;t admit.</td></tr>
            <tr><td>Wrong date / expired</td><td>Not their visit day. Don&apos;t admit.</td></tr>
            <tr><td>Pending</td><td>Not approved yet. The office has to approve it first.</td></tr>
            <tr><td>Not found</td><td>Type it again. If it still fails, call the office.</td></tr>
            <tr><td>Denied</td><td>The office declined it. Don&apos;t admit.</td></tr>
          </tbody>
        </table>
      </Section>

      <Section id="outage" title="7. Power or internet outage">
        <p>Use the <strong>paper gate log</strong>. Write down the reference number, visitor name, time, ID shown, and office, and admit based on that. Admins reconcile the log when the system is back.</p>
      </Section>

      <Section id="device" title="8. Device care">
        <ul>
          <li>Charge the device at the end of every shift and keep it at the post.</li>
          <li>Sign out before handing it to the next guard.</li>
          <li>Report damage or loss to your supervisor right away.</li>
        </ul>
      </Section>

      {showGuardAdmin && (
        <Section id="guard-admin" title="9. For guard admins">
          <ul>
            <li>Sign in at <strong>/admin/login</strong> with your email. You land on <strong>Today&apos;s Visitors</strong>: every office&apos;s appointments for the day, with counts at the top.</li>
            <li>Search or filter the list, or pick another date. Click <strong>View</strong> to see an appointment&apos;s full details (read-only).</li>
            <li>Open <strong>Guard Accounts</strong> in the sidebar and click <strong>Add Guard</strong> to create a guard login (name, username, password). You can only create guard accounts.</li>
          </ul>
        </Section>
      )}
    </>
  );
}

export function SuperAdminGuide() {
  return (
    <>
      <p>Super admins can do everything an office admin can, for every office, plus manage the system itself.</p>
      <Contents items={[["sa-dashboard", "Dashboard"], ["sa-offices", "Offices and people"], ["sa-accounts", "Accounts"], ["sa-closed", "Closed dates"], ["sa-audit", "Audit log"], ["sa-settings", "Settings"], ["sa-maintenance", "Maintenance"]]} />

      <Section id="sa-dashboard" title="1. Dashboard">
        <p>Shows appointment counts for all offices, with filters and search. The <strong>Closed dates</strong> strip at the top lists upcoming closures.</p>
      </Section>

      <Section id="sa-offices" title="2. Offices and people">
        <ul>
          <li>Create, edit, deactivate, or delete offices. Deactivated offices disappear from booking. Only deactivated offices can be deleted.</li>
          <li>Office settings include hours, capacity per slot, category, hiding time slots, booking limits, inviting for other offices, and allowing sub-offices.</li>
          <li>The <strong>People</strong> button on an office shows its <strong>Accounts</strong> (view and add office admins) and <strong>Contacts</strong>.</li>
        </ul>
      </Section>

      <Section id="sa-accounts" title="3. Accounts">
        <ul>
          <li>Create super admin, office admin, and gate user accounts. Edit names, roles, and offices, and reset passwords.</li>
          <li>Self-registered office admins wait under <strong>Pending approval</strong> until you approve or reject them.</li>
          <li>Removing an account or resetting a password asks for your own password.</li>
        </ul>
      </Section>

      <Section id="sa-closed" title="4. Closed dates">
        <ul>
          <li><strong>Close a date</strong>: one day or a range of up to 31 days, with a reason such as a holiday name.</li>
          <li><strong>Closed every week</strong>: turn on a weekday (e.g. Wednesday) to close it every week, then click <strong>Save weekly days</strong>.</li>
          <li>Closed days can&apos;t be booked, invited, or postponed to at any office. Existing appointments aren&apos;t changed; you&apos;re told how many there are.</li>
          <li>Use <strong>Reopen</strong> to undo a closure.</li>
        </ul>
      </Section>

      <Section id="sa-audit" title="5. Audit log">
        <p>Every tracked action, with filters by action and date. Click <strong>View</strong> on an entry for its details. Updates show <strong>View changes</strong> with each field&apos;s value before and after.</p>
      </Section>

      <Section id="sa-settings" title="6. Settings">
        <ul>
          <li>System information, booking rules, the gate entry window, and which emails are sent.</li>
          <li><strong>System Update Popup</strong>: a message shown to visitors, admins, and/or guards. Publishing new text also adds it to the <strong>Updates</strong> page.</li>
        </ul>
      </Section>

      <Section id="sa-maintenance" title="7. Maintenance">
        <p>Turn on maintenance mode now or schedule it. While it&apos;s on, visitors see a maintenance notice instead of the booking form.</p>
      </Section>
    </>
  );
}
