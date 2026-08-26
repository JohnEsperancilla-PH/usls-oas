import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST() {
  try {
    const supabase = createServiceClient();

    // List existing buckets to check
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();

    if (listError) {
      console.error("Error listing buckets:", listError);
      return NextResponse.json({ message: listError.message }, { status: 500 });
    }

    const existing = buckets?.find((b) => b.name === "id-cards");

    if (existing) {
      return NextResponse.json({
        message: "Bucket 'id-cards' already exists",
        bucket: existing,
      });
    }

    // Create the bucket
    const { data: bucket, error: bucketError } = await supabase.storage.createBucket(
      "id-cards",
      {
        public: true,
        fileSizeLimit: 5 * 1024 * 1024,
        allowedMimeTypes: [
          "image/jpeg",
          "image/png",
          "image/gif",
          "image/webp",
        ],
      }
    );

    if (bucketError) {
      console.error("Error creating bucket:", bucketError);
      return NextResponse.json({ message: bucketError.message }, { status: 500 });
    }

    return NextResponse.json({
      message: "Storage bucket 'id-cards' created successfully",
      bucket,
    });
  } catch (error) {
    console.error("Setup error:", error);
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}