"use client";

import { useState, useEffect } from "react";
import { IdentityForm } from "@/components/forms/IdentityForm";
import { AppointmentForm } from "@/components/forms/AppointmentForm";
import WelcomeModal from "@/components/WelcomeModal";
import { formatTimeSlot } from "@/lib/time";
import type { Office } from "@/types/database";

export interface BookingData {
  fullName: string;
  phone: string;
  email: string;
  validId: string;
  visitorCategory: string;
  officeId: string;
  date: string;
  timeSlot: string;
  duration: 30 | 60;
  purposeOfVisit: string;
}

const initialData: BookingData = {
  fullName: "",
  phone: "",
  email: "",
  validId: "",
  visitorCategory: "general_public",
  officeId: "",
  date: "",
  timeSlot: "",
  duration: 30,
  purposeOfVisit: "",
};

export default function BookPage() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<BookingData>(initialData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offices, setOffices] = useState<Office[]>([]);

  useEffect(() => {
    fetch("/api/offices")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setOffices(data))
      .catch(() => setOffices([]));
  }, []);

  const handleNext = (data: Partial<BookingData>) => {
    setFormData((prev) => ({ ...prev, ...data }));
    setStep(2);
  };

  const handleBack = (data: Partial<BookingData>) => {
    setFormData((prev) => ({ ...prev, ...data }));
    setStep(1);
  };

  const handleSubmit = async (data: Partial<BookingData>) => {
    setIsSubmitting(true);
    setError(null);
    try {
      const finalData = { ...formData, ...data };
      setFormData(finalData);
      const response = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: finalData.fullName,
          phone: finalData.phone,
          email: finalData.email,
          validId: finalData.validId,
          visitorCategory: finalData.visitorCategory,
          officeId: finalData.officeId,
          date: finalData.date,
          timeSlot: finalData.timeSlot,
          duration: finalData.duration,
          purposeOfVisit: finalData.purposeOfVisit,
        }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to submit appointment");
      }
      setSubmitSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitSuccess) {
    const office = offices.find((o) => o.id === formData.officeId);
    const overviewRows = [
      { label: "Office", value: office?.name || formData.officeId },
      {
        label: "Date",
        value: new Date(formData.date + "T00:00:00").toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        }),
      },
      { label: "Time", value: formatTimeSlot(formData.timeSlot) },
      { label: "Duration", value: `${formData.duration} minutes` },
      { label: "Visitor", value: formData.fullName },
    ];
    const officeEmail = office?.contact_email || office?.email;

    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="card max-w-md w-full text-center animate-fade-in">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Appointment Submitted</h1>
          <p className="text-gray-500 mb-3">
            Your appointment has been submitted and is pending review by the <strong className="text-gray-700">{office?.name || "office"}</strong>.
          </p>
          <p className="text-sm text-gray-400 mb-6">
            You will be updated by email once your appointment has been approved or declined. Updates will be sent to{" "}
            <strong className="text-gray-600">{formData.email}</strong>.
          </p>

          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-left mb-6">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Appointment Overview</h2>
            <div className="space-y-2 text-sm">
              {overviewRows.map((row) => (
                <div key={row.label} className="flex items-center justify-between gap-4">
                  <span className="text-gray-500">{row.label}</span>
                  <span className="font-medium text-gray-900 text-right">{row.value}</span>
                </div>
              ))}
              {formData.purposeOfVisit && (
                <div className="flex items-start justify-between gap-4">
                  <span className="text-gray-500">Purpose</span>
                  <span className="font-medium text-gray-900 text-right">{formData.purposeOfVisit}</span>
                </div>
              )}
            </div>
          </div>

          <p className="text-sm text-gray-500 mb-8">
            If you have other questions, kindly send a message to{" "}
            <strong className="text-gray-600">{officeEmail || "the office"}</strong> or{" "}
            <strong className="text-gray-600">appointments@usls.edu.ph</strong>.
          </p>
          <button
            onClick={() => { setSubmitSuccess(false); setFormData(initialData); setStep(1); }}
            className="btn-primary"
          >
            Book Another Appointment
          </button>
        </div>
      </div>
    );
  }

  const year = new Date().getFullYear();

  return (
    <div className="min-h-screen bg-gray-50">
      <WelcomeModal />

      <header className="bg-white border-b border-gray-100 py-5 overflow-hidden">
        <div className="container mx-auto px-4 flex items-center justify-center">
          <img src="/usls-oas.png" alt="USLS OAS" className="h-16 sm:h-20 w-auto" />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          {/* Stepper */}
          <div className="mb-8">
            <div className="flex items-center justify-center gap-0">
              {[
                { num: 1, label: "Personal Information" },
                { num: 2, label: "Appointment Request" },
              ].map((s, i) => (
                <div key={s.num} className="flex items-center">
                  <div className="flex items-center gap-2">
                    <div className={`px-3 py-1.5 rounded-full text-sm font-semibold transition-all duration-300 ${
                      step > s.num ? "bg-primary text-white" : step === s.num ? "bg-primary text-white ring-4 ring-primary/20" : "bg-gray-200 text-gray-500"
                    }`}>
                      {step > s.num ? (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : `Step ${s.num}`}
                    </div>
                    <span className={`text-sm font-medium hidden sm:inline ${step >= s.num ? "text-gray-900" : "text-gray-400"}`}>{s.label}</span>
                  </div>
                  {i === 0 && <div className={`w-12 sm:w-20 h-0.5 mx-3 transition-colors duration-300 ${step >= 2 ? "bg-primary" : "bg-gray-200"}`} />}
                </div>
              ))}
            </div>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-3">
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
          )}

          <div className="animate-fade-in" key={step}>
            {step === 1 ? (
              <IdentityForm data={formData} onNext={handleNext} />
            ) : (
              <AppointmentForm data={formData} onBack={handleBack} onSubmit={handleSubmit} isSubmitting={isSubmitting} />
            )}
          </div>
        </div>
      </main>

      <footer className="border-t border-gray-200 bg-white py-6">
        <div className="container mx-auto px-4 text-center text-xs text-gray-400">
          <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 mb-3">
            <a href="/privacy" className="text-gray-500 hover:text-primary hover:underline">Privacy Policy</a>
            <a href="/terms" className="text-gray-500 hover:text-primary hover:underline">Terms of Service</a>
            <a href="/consent" className="text-gray-500 hover:text-primary hover:underline">Consent to Forms</a>
            <a href="/cookies" className="text-gray-500 hover:text-primary hover:underline">Cookie Policy</a>
          </nav>
          <div className="space-y-0.5">
            <p>&copy; {year} OAS &mdash; Online Appointment System</p>
            <p><a href="https://www.usls.edu.ph/cmc" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Center for Marketing and Communications</a></p>
            <p><a href="https://www.usls.edu.ph" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">University of St. La Salle</a></p>
          </div>
        </div>
      </footer>
    </div>
  );
}
