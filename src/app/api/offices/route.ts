import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/http";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = createServiceClient();
    
    const { data, error } = await supabase
      .from("offices")
      .select("*")
      .eq("active", true)
      .order("name");

    if (error) {
      console.error(error);
      return NextResponse.json(
        { message: "Failed to fetch offices" },
        { status: 500 }
      );
    }

    if (!data || data.length === 0) {
      return NextResponse.json([]);
    }

    const officeIds = data.map((office: { id: string }) => office.id);
    const { data: contacts, error: contactsError } = await supabase
      .from("office_contacts")
      // Public endpoint: contact names and positions for the booking form only, never their emails.
      .select("id, office_id, name, position")
      .eq("active", true)
      .in("office_id", officeIds)
      .order("name");

    if (contactsError) {
      console.error(contactsError);
    }

    const officesWithContacts = data.map((office: { id: string }) => ({
      ...office,
      contacts: (contacts || []).filter((contact: { office_id: string }) => contact.office_id === office.id),
    }));

    return NextResponse.json(officesWithContacts);
  } catch (error) {
    return handleRouteError(error);
  }
}