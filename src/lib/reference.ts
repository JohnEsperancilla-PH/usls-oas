import crypto from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

// Crockford-style alphabet: excludes I, L, O, U, 0, 1 so reference numbers
// can be read aloud and typed without ambiguity.
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const LENGTH = 8;
const MAX_RETRIES = 5;

export function generateReferenceNumber(): string {
  const bytes = crypto.randomBytes(LENGTH);
  let ref = "";
  for (let i = 0; i < LENGTH; i++) {
    ref += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return ref;
}

export async function createUniqueReference(supabase: SupabaseClient): Promise<string> {
  for (let i = 0; i < MAX_RETRIES; i++) {
    const ref = generateReferenceNumber();
    const { data } = await supabase
      .from("appointments")
      .select("id")
      .eq("qr_token", ref)
      .maybeSingle();
    if (!data) return ref;
  }
  throw new Error("Unable to generate a unique reference number");
}

export function normalizeReference(input: string): string {
  return input.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}