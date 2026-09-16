"use client";

import { useState } from "react";
import { VALID_IDS } from "@/lib/valid-ids";
import type { BookingData } from "@/app/page";

const VISITOR_CATEGORIES = [
  { value: "general_public", label: "General Public" },
  { value: "student", label: "Student" },
  { value: "faculty", label: "Faculty / Staff" },
  { value: "alumni", label: "Alumni" },
  { value: "vendor", label: "Vendor / Supplier" },
] as const;

interface IdentityFormProps {
  data: BookingData;
  onNext: (data: Partial<BookingData>) => void;
}

export function IdentityForm({ data, onNext }: IdentityFormProps) {
  const [formData, setFormData] = useState({ fullName: data.fullName, phone: data.phone, email: data.email });
  const [visitorCategory, setVisitorCategory] = useState(data.visitorCategory || "general_public");
  const [validId, setValidId] = useState(data.validId || "");
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.fullName.trim()) newErrors.fullName = "Full name is required";
    if (!formData.phone.trim()) newErrors.phone = "Phone number is required";
    else if (!/^[\d\s\-\+\(\)]{10,}$/.test(formData.phone)) newErrors.phone = "Enter a valid phone number";
    if (!formData.email.trim()) newErrors.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) newErrors.email = "Enter a valid email";
    if (!validId) newErrors.validId = "Please select the valid ID you will present at the gate";
    if (!consent) newErrors.consent = "You must consent to data collection to proceed";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) onNext({ ...formData, visitorCategory, validId });
  };

  return (
    <div className="card">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">Identity Information</h2>
        <p className="text-sm text-gray-500 mt-1">Tell us who you are so we can process your appointment.</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="fullName" className="label">Full Name</label>
          <input type="text" id="fullName" name="fullName" value={formData.fullName} onChange={handleInputChange}
            className={`input ${errors.fullName ? "input-error" : ""}`} placeholder="e.g. Juan Dela Cruz" />
          {errors.fullName && <p className="error-text">{errors.fullName}</p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="phone" className="label">Phone Number</label>
            <input type="tel" id="phone" name="phone" value={formData.phone} onChange={handleInputChange}
              className={`input ${errors.phone ? "input-error" : ""}`} placeholder="e.g. 0917 123 4567" />
            {errors.phone && <p className="error-text">{errors.phone}</p>}
          </div>
          <div>
            <label htmlFor="email" className="label">Email Address</label>
            <input type="email" id="email" name="email" value={formData.email} onChange={handleInputChange}
              className={`input ${errors.email ? "input-error" : ""}`} placeholder="e.g. juan.delacruz@email.com" />
            {errors.email && <p className="error-text">{errors.email}</p>}
          </div>
        </div>

        <div>
          <label htmlFor="visitorCategory" className="label">Visitor Category</label>
          <select id="visitorCategory" value={visitorCategory} onChange={(e) => setVisitorCategory(e.target.value)}
            className="input">
            {VISITOR_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="validId" className="label">Valid IDs to Present at the Guard</label>
          <select id="validId" value={validId} onChange={(e) => { setValidId(e.target.value); if (errors.validId) setErrors((p) => ({ ...p, validId: "" })); }}
            className={`input ${errors.validId ? "input-error" : ""}`}>
            <option value="">Select a government-issued ID...</option>
            {VALID_IDS.map((id) => (
              <option key={id} value={id}>{id}</option>
            ))}
          </select>
          <p className="text-xs text-gray-400 mt-1.5">
            Choose the government-issued ID you will bring on your appointment day. You will need to present it at the guard to get your visitor&apos;s pass.
          </p>
          {errors.validId && <p className="error-text mt-1">{errors.validId}</p>}
        </div>

        {/* Consent */}
        <div className="border border-gray-200 rounded-lg p-3 bg-gray-50/50">
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input type="checkbox" checked={consent} onChange={(e) => { setConsent(e.target.checked); if (errors.consent) setErrors((p) => ({ ...p, consent: "" })); }}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary shrink-0" />
            <div>
              <span className="text-sm font-medium text-gray-700 leading-snug">
                I consent to the collection, use, and storage of my personal data (name, contact details, valid ID type, and appointment information) for the purpose of processing my appointment request and verifying my identity at the campus gate, in accordance with RA 10173 (Data Privacy Act of 2012) and the USLS OASYS Privacy Policy.
              </span>
              <p className="text-xs text-gray-400 mt-0.5 leading-snug">
                Learn more in our <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Privacy Policy</a>.
              </p>
            </div>
          </label>
          {errors.consent && <p className="error-text mt-1.5">{errors.consent}</p>}
        </div>

        <div className="flex justify-end pt-2">
          <button type="submit" className="btn-primary">
            Next: Appointment Details
            <svg className="w-4 h-4 ml-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
}