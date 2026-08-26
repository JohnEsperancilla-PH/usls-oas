"use client";

import { useState } from "react";
import { IdentityForm } from "@/components/forms/IdentityForm";
import { AppointmentForm } from "@/components/forms/AppointmentForm";

export interface BookingData {
  fullName: string;
  phone: string;
  email: string;
  idImage: File | null;
  idImageUrl: string;
  officeId: string;
  date: string;
  timeSlot: string;
  duration: 30 | 60;
}

const initialData: BookingData = {
  fullName: "",
  phone: "",
  email: "",
  idImage: null,
  idImageUrl: "",
  officeId: "",
  date: "",
  timeSlot: "",
  duration: 30,
};

export default function BookPage() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<BookingData>(initialData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      if (finalData.idImage) {
        const formDataObj = new FormData();
        formDataObj.append("file", finalData.idImage);
        const uploadResponse = await fetch("/api/upload", { method: "POST", body: formDataObj });
        if (!uploadResponse.ok) throw new Error("Failed to upload ID image");
        const { url } = await uploadResponse.json();
        finalData.idImageUrl = url;
      }
      const response = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: finalData.fullName,
          phone: finalData.phone,
          email: finalData.email,
          idImageUrl: finalData.idImageUrl,
          officeId: finalData.officeId,
          date: finalData.date,
          timeSlot: finalData.timeSlot,
          duration: finalData.duration,
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
            Your appointment request has been received and is pending review.
          </p>
          <p className="text-sm text-gray-400 mb-8">
            You will receive a confirmation email at <strong className="text-gray-600">{formData.email}</strong>.
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

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 py-4">
        <div className="container mx-auto px-4 flex items-center gap-3">
          <img src="/oas.svg" alt="USLS OAS" className="h-6 w-auto" />
          <a href="/" className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </a>
          <h1 className="text-lg font-bold text-gray-900">Book an Appointment</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          {/* Stepper */}
          <div className="mb-8">
            <div className="flex items-center justify-center gap-0">
              {[
                { num: 1, label: "Identity Info" },
                { num: 2, label: "Appointment Details" },
              ].map((s, i) => (
                <div key={s.num} className="flex items-center">
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300 ${
                      step > s.num ? "bg-primary text-white" : step === s.num ? "bg-primary text-white ring-4 ring-primary/20" : "bg-gray-200 text-gray-500"
                    }`}>
                      {step > s.num ? (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : s.num}
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
    </div>
  );
}
