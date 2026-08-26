"use client";

import { useState, useRef } from "react";
import type { BookingData } from "@/app/book/page";

interface IdentityFormProps {
  data: BookingData;
  onNext: (data: Partial<BookingData>) => void;
}

export function IdentityForm({ data, onNext }: IdentityFormProps) {
  const [formData, setFormData] = useState({ fullName: data.fullName, phone: data.phone, email: data.email });
  const [idImage, setIdImage] = useState<File | null>(data.idImage);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [previewUrl, setPreviewUrl] = useState<string | null>(data.idImageUrl || null);
  const [consent, setConsent] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const processFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setErrors((prev) => ({ ...prev, idImage: "Please upload an image file (JPEG, PNG)" }));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrors((prev) => ({ ...prev, idImage: "File size must be less than 5MB" }));
      return;
    }
    setIdImage(file);
    setErrors((prev) => ({ ...prev, idImage: "" }));
    const reader = new FileReader();
    reader.onload = () => setPreviewUrl(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const removeImage = () => {
    setIdImage(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.fullName.trim()) newErrors.fullName = "Full name is required";
    if (!formData.phone.trim()) newErrors.phone = "Phone number is required";
    else if (!/^[\d\s\-\+\(\)]{10,}$/.test(formData.phone)) newErrors.phone = "Enter a valid phone number";
    if (!formData.email.trim()) newErrors.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) newErrors.email = "Enter a valid email";
    if (!idImage && !previewUrl) newErrors.idImage = "Please upload a photo of your ID";
    if (!consent) newErrors.consent = "You must consent to data collection to proceed";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) onNext({ ...formData, idImage });
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
            className={`input ${errors.fullName ? "input-error" : ""}`} placeholder="Juan Dela Cruz" />
          {errors.fullName && <p className="error-text">{errors.fullName}</p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="phone" className="label">Phone Number</label>
            <input type="tel" id="phone" name="phone" value={formData.phone} onChange={handleInputChange}
              className={`input ${errors.phone ? "input-error" : ""}`} placeholder="0917 123 4567" />
            {errors.phone && <p className="error-text">{errors.phone}</p>}
          </div>
          <div>
            <label htmlFor="email" className="label">Email Address</label>
            <input type="email" id="email" name="email" value={formData.email} onChange={handleInputChange}
              className={`input ${errors.email ? "input-error" : ""}`} placeholder="you@example.com" />
            {errors.email && <p className="error-text">{errors.email}</p>}
          </div>
        </div>

        {/* ID Upload */}
        <div>
          <label className="label">Upload Valid Government or School ID</label>
          {previewUrl ? (
            <div className="relative inline-block">
              <img src={previewUrl} alt="ID Preview" className="max-w-xs h-auto rounded-lg border border-border" />
              <button type="button" onClick={removeImage}
                className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors shadow-sm">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ) : (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all duration-200 ${
                dragOver ? "border-primary bg-primary/5" : errors.idImage ? "border-error bg-red-50" : "border-gray-200 hover:border-primary/40 hover:bg-gray-50"
              }`}
            >
              <svg className="mx-auto h-10 w-10 text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="text-sm text-gray-600 mb-1">
                <span className="text-primary font-medium">Click to upload</span> or drag and drop
              </p>
              <p className="text-xs text-gray-400">JPEG, PNG up to 5MB</p>
              <input ref={fileInputRef} id="idImage" type="file" className="sr-only" accept="image/jpeg,image/png,image/webp" onChange={handleFileChange} />
            </div>
          )}
          {errors.idImage && <p className="error-text mt-1">{errors.idImage}</p>}
        </div>

        {/* Consent */}
        <div className="border border-gray-200 rounded-lg p-4 bg-gray-50/50">
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" checked={consent} onChange={(e) => { setConsent(e.target.checked); if (errors.consent) setErrors((p) => ({ ...p, consent: "" })); }}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
            <div>
              <span className="text-sm font-medium text-gray-700">
                I consent to the collection and processing of my ID image and personal information
              </span>
              <p className="text-xs text-gray-400 mt-1">
                Your data will be used solely for appointment verification purposes in accordance with RA 10173 (Data Privacy Act). ID images are stored securely and retained per our data retention policy.
              </p>
            </div>
          </label>
          {errors.consent && <p className="error-text mt-2">{errors.consent}</p>}
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
