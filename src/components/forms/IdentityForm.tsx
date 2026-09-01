"use client";

import { useState, useRef } from "react";
import imageCompression from "browser-image-compression";
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
  const [idImage, setIdImage] = useState<File | null>(data.idImage);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [previewUrl, setPreviewUrl] = useState<string | null>(data.idImageUrl || null);
  const [consent, setConsent] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [idImageUrl, setIdImageUrl] = useState<string>(data.idImageUrl || "");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const uploadImage = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: formData });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.message || "Failed to upload ID image");
    }
    const { url } = await res.json();
    return url;
  };

  const processFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setErrors((prev) => ({ ...prev, idImage: "Please upload an image file (JPEG, PNG)" }));
      return;
    }
    setErrors((prev) => ({ ...prev, idImage: "" }));
    setUploadError(null);
    setCompressing(true);
    let fileToUpload: File;
    try {
      const compressed = await imageCompression(file, {
        maxSizeMB: 1,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
        initialQuality: 0.8,
      });
      setIdImage(compressed);
      fileToUpload = compressed;
      const reader = new FileReader();
      reader.onload = () => setPreviewUrl(reader.result as string);
      reader.readAsDataURL(compressed);
    } catch {
      setIdImage(file);
      fileToUpload = file;
      const reader = new FileReader();
      reader.onload = () => setPreviewUrl(reader.result as string);
      reader.readAsDataURL(file);
    } finally {
      setCompressing(false);
    }
    try {
      setUploading(true);
      const url = await uploadImage(fileToUpload);
      setIdImageUrl(url);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Failed to upload ID image");
    } finally {
      setUploading(false);
    }
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
    setIdImageUrl("");
    setUploadError(null);
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
    else if (uploading) newErrors.idImage = "Your ID is still uploading. Please wait for it to finish.";
    else if (uploadError) newErrors.idImage = uploadError;
    else if (!idImageUrl) newErrors.idImage = "Your ID has not finished uploading yet. Please wait.";
    if (!consent) newErrors.consent = "You must consent to data collection to proceed";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) onNext({ ...formData, visitorCategory, idImage, idImageUrl });
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
              <p className="text-xs text-gray-400">JPEG, PNG up to 5MB (auto-compressed)</p>
              <input ref={fileInputRef} id="idImage" type="file" className="sr-only" accept="image/jpeg,image/png,image/webp" onChange={handleFileChange} />
            </div>
          )}
          {compressing && (
            <div className="mt-2 flex items-center gap-2 text-xs text-primary">
              <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              Compressing image...
            </div>
          )}
          {uploading && (
            <div className="mt-2 flex items-center gap-2 text-xs text-primary">
              <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              Uploading ID image...
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
