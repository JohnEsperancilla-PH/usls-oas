"use client";

import { useState } from "react";
import { VALID_IDS } from "@/lib/valid-ids";
import type { BookingData } from "@/app/page";

const VISITOR_CATEGORIES = [
  { value: "external", label: "External (Companies, Organizations, Groups)" },
  { value: "parents", label: "Parents" },
  { value: "alumni", label: "Alumni" },
  { value: "vendor", label: "Vendor / Supplier" },
] as const;

interface IdentityFormProps {
  data: BookingData;
  onNext: (data: Partial<BookingData>) => void;
}

export function IdentityForm({ data, onNext }: IdentityFormProps) {
  const [formData, setFormData] = useState({ fullName: data.fullName, phone: data.phone, email: data.email });
  const [visitorCategory, setVisitorCategory] = useState(data.visitorCategory || "external");
  const [validId, setValidId] = useState(data.validId || "");
  const [visitorCount, setVisitorCount] = useState(data.visitorCount || 1);
  const [visitorsEnabled, setVisitorsEnabled] = useState(data.additionalVisitors && data.additionalVisitors.length > 0);
  const [additionalVisitors, setAdditionalVisitors] = useState(data.additionalVisitors || []);
  const [hasVehicle, setHasVehicle] = useState(data.hasVehicle || false);
  const [vehicleCount, setVehicleCount] = useState(data.vehicleCount || 0);
  const [vehicles, setVehicles] = useState(data.vehicles || []);
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
    additionalVisitors.forEach((visitor, index) => {
      if (!visitor.fullName.trim()) newErrors[`visitor-${index}-name`] = "Name is required";
      if (!visitor.validId) newErrors[`visitor-${index}-id`] = "Please select a valid ID";
    });
    if (hasVehicle) {
      vehicles.forEach((vehicle, index) => {
        if (!vehicle.plateNumber.trim()) newErrors[`vehicle-${index}-plate`] = "Plate number is required";
      });
    }
    if (!consent) newErrors.consent = "You must consent to data collection to proceed";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) onNext({
      ...formData,
      visitorCategory,
      validId,
       visitorCount: visitorsEnabled ? visitorCount : 1,
       additionalVisitors: visitorsEnabled ? additionalVisitors : [],
      hasVehicle,
      vehicleCount: hasVehicle ? vehicleCount : 0,
      vehicles: hasVehicle ? vehicles : [],
    });
  };

  const toggleHasVehicle = (enabled: boolean) => {
    setHasVehicle(enabled);
    if (enabled) {
      setVehicleCount((previous) => previous || 1);
      setVehicles((previous) => (previous.length > 0 ? previous : [{ plateNumber: "", makeModel: "" }]));
    }
  };

  const changeVehicleCount = (nextCount: number) => {
    const count = Math.min(5, Math.max(1, nextCount));
    setVehicleCount(count);
    setVehicles((previous) => Array.from({ length: count }, (_, index) => previous[index] || { plateNumber: "", makeModel: "" }));
  };

  const updateVehicle = (index: number, field: "plateNumber" | "makeModel", value: string) => {
    setVehicles((previous) => previous.map((vehicle, vehicleIndex) => vehicleIndex === index ? { ...vehicle, [field]: value } : vehicle));
    if (field === "plateNumber") setErrors((previous) => ({ ...previous, [`vehicle-${index}-plate`]: "" }));
  };

   const changeVisitorCount = (nextCount: number) => {
     const count = Math.min(10, Math.max(1, nextCount));
     setVisitorCount(count);
     setAdditionalVisitors((previous) => Array.from({ length: count - 1 }, (_, index) => previous[index] || { fullName: "", validId: "" }));
   };

   const toggleVisitors = (enabled: boolean) => {
     setVisitorsEnabled(enabled);
     if (!enabled) {
       setVisitorCount(1);
       setAdditionalVisitors([]);
     }
   };

  const updateAdditionalVisitor = (index: number, field: "fullName" | "validId", value: string) => {
    setAdditionalVisitors((previous) => previous.map((visitor, visitorIndex) => visitorIndex === index ? { ...visitor, [field]: value } : visitor));
    setErrors((previous) => ({ ...previous, [`visitor-${index}-${field === "fullName" ? "name" : "id"}`]: "" }));
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

        <div className="border-t border-gray-100 pt-5">
          <label className="label" htmlFor="visitorCount">Number of Visitors</label>
          <p className="text-xs text-gray-400 mt-1">The person booking is included. Everyone must enter together using the booking person&apos;s gate entry code.</p>
          <div className="mt-2 flex items-center gap-3">
            <button type="button" onClick={() => toggleVisitors(false)}
              className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-all ${!visitorsEnabled ? "bg-primary/10 text-primary border-primary/30" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}>
              1 Visitor
            </button>
            <button type="button" onClick={() => toggleVisitors(true)}
              className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-all ${visitorsEnabled ? "bg-primary/10 text-primary border-primary/30" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}>
              Multiple Visitors
            </button>
          </div>

          {visitorsEnabled && (
            <div className="mt-3 flex items-center gap-3">
              <button type="button" onClick={() => changeVisitorCount(visitorCount - 1)} disabled={visitorCount <= 1} aria-label="Decrease number of visitors" className="w-10 h-10 rounded-lg border border-gray-200 text-xl text-gray-600 hover:bg-gray-50 disabled:opacity-40">-</button>
              <input id="visitorCount" type="number" min={1} max={10} value={visitorCount} onChange={(e) => changeVisitorCount(Number(e.target.value))} className="input w-20 text-center" />
              <button type="button" onClick={() => changeVisitorCount(visitorCount + 1)} disabled={visitorCount >= 10} aria-label="Increase number of visitors" className="w-10 h-10 rounded-lg border border-gray-200 text-xl text-gray-600 hover:bg-gray-50 disabled:opacity-40">+</button>
            </div>
          )}
        </div>

        {additionalVisitors.length > 0 && (
          <div className="space-y-4 border border-primary/10 bg-primary/5 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-900">Additional Visitors</h3>
            {additionalVisitors.map((visitor, index) => (
              <div key={index} className="border-t border-primary/10 pt-4 first:border-0 first:pt-0">
                <p className="text-xs font-semibold text-gray-500 mb-2">Visitor {index + 2}</p>
                <label htmlFor={`visitor-${index}-name`} className="sr-only">Visitor {index + 2} full name</label>
                <input id={`visitor-${index}-name`} type="text" value={visitor.fullName} onChange={(e) => updateAdditionalVisitor(index, "fullName", e.target.value)} className={`input ${errors[`visitor-${index}-name`] ? "input-error" : ""}`} placeholder="Full name" maxLength={100} />
                {errors[`visitor-${index}-name`] && <p className="error-text">{errors[`visitor-${index}-name`]}</p>}
                <label htmlFor={`visitor-${index}-id`} className="sr-only">Visitor {index + 2} valid ID</label>
                <select id={`visitor-${index}-id`} value={visitor.validId} onChange={(e) => updateAdditionalVisitor(index, "validId", e.target.value)} className={`input mt-2 ${errors[`visitor-${index}-id`] ? "input-error" : ""}`}>
                  <option value="">Select a government-issued ID...</option>
                  {VALID_IDS.map((id) => <option key={id} value={id}>{id}</option>)}
                </select>
                {errors[`visitor-${index}-id`] && <p className="error-text">{errors[`visitor-${index}-id`]}</p>}
              </div>
            ))}
          </div>
        )}

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