import MaintenanceCountdown from "@/components/landing/MaintenanceCountdown";
import { formatManilaDateTime, type MaintenanceState } from "@/lib/maintenance";

export default function MaintenanceNotice({ state }: { state: MaintenanceState }) {
  const year = new Date().getFullYear();
  const startsAt = formatManilaDateTime(state.startAt);
  const endsAt = formatManilaDateTime(state.endAt);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-100 py-5 overflow-hidden">
        <div className="container mx-auto px-4 flex items-center justify-center">
          <img src="/usls-oas.png" alt="USLS OASYS" className="h-16 sm:h-20 w-auto" />
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8 sm:py-10 flex">
        <div className="w-full max-w-xl mx-auto my-auto text-center animate-fade-in">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{state.headline}</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-3 leading-relaxed whitespace-pre-line">
            {state.message}
          </p>

          {(startsAt || endsAt) && (
            <div className="mt-7 bg-white border border-gray-200 rounded-xl p-5 text-left">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">
                Maintenance window
              </h2>
              <div className="space-y-2 text-sm">
                {startsAt && (
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-gray-500">Started</span>
                    <span className="font-medium text-gray-900 text-right">{startsAt}</span>
                  </div>
                )}
                {endsAt && (
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-gray-500">Expected back online</span>
                    <span className="font-medium text-gray-900 text-right">{endsAt}</span>
                  </div>
                )}
                {state.endAt && (
                  <div className="flex items-center justify-between gap-4 border-t border-gray-100 pt-2 mt-1">
                    <span className="text-gray-500">Time remaining</span>
                    <MaintenanceCountdown
                      endsAt={state.endAt}
                      initialRemaining={state.remainingMs ?? 0}
                    />
                  </div>
                )}
              </div>
              <p className="text-[11px] text-gray-400 mt-3">
                Times shown in Philippine Time (Asia/Manila).
              </p>
            </div>
          )}

          {state.contactEmail && (
            <p className="text-sm text-gray-500 mt-6">
              Need assistance? Email{" "}
              <a href={`mailto:${state.contactEmail}`} className="text-primary hover:underline">
                {state.contactEmail}
              </a>
              .
            </p>
          )}
        </div>
      </main>

      <footer className="border-t border-gray-200 bg-white py-6 mt-auto">
        <div className="container mx-auto px-4 text-center text-xs text-gray-400">
          <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 mb-3">
            <a href="/offices" className="text-gray-500 hover:text-primary hover:underline">University Offices</a>
            <a href="/privacy" className="text-gray-500 hover:text-primary hover:underline">Privacy Policy</a>
            <a href="/terms" className="text-gray-500 hover:text-primary hover:underline">Terms of Service</a>
            <a href="/consent" className="text-gray-500 hover:text-primary hover:underline">Consent to Forms</a>
            <a href="/cookies" className="text-gray-500 hover:text-primary hover:underline">Cookie Policy</a>
          </nav>
          <div className="space-y-0.5">
            <p>&copy; {year} OASYS &mdash; Online Appointment System</p>
            <p>
              <a href="https://www.usls.edu.ph/cmc" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                Center for Marketing and Communications
              </a>
            </p>
            <p>
              <a href="https://www.usls.edu.ph" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                University of St. La Salle
              </a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
