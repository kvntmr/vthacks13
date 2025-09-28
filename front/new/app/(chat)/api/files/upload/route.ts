import { Buffer } from "buffer";
import fs from "fs/promises";
import path from "path";

import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/app/(auth)/auth";

const MAX_UPLOAD_SIZE_BYTES = 25 * 1024 * 1024; // 25MB default limit
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
  "application/json",
  "text/json",
  "text/plain",
  "image/jpeg",
  "image/png",
]);

const ALLOWED_EXTENSIONS = new Set([
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "csv",
  "json",
  "txt",
  "jpg",
  "jpeg",
  "png",
]);

const FileSchema = z.object({
  file: z
    .instanceof(Blob)
    .refine((file) => file.size <= MAX_UPLOAD_SIZE_BYTES, {
      message: `File size should be less than ${MAX_UPLOAD_SIZE_BYTES / (1024 * 1024)}MB`,
    }),
});

const FILE_UPLOAD_DIR =
  process.env.FILE_UPLOAD_DIR ?? path.join(process.cwd(), "uploads");

async function ensureUploadDirExists() {
  await fs.mkdir(FILE_UPLOAD_DIR, { recursive: true });
}

export async function POST(request: Request) {
  const session = await auth();
  const isProduction = process.env.NODE_ENV === "production";

  if (!session && isProduction) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (request.body === null) {
    return new Response("Request body is empty", { status: 400 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as Blob;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const validatedFile = FileSchema.safeParse({ file });

    if (!validatedFile.success) {
      const errorMessage = validatedFile.error.errors
        .map((error) => error.message)
        .join(", ");

      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    const originalFile = formData.get("file") as File;
    if (!isAllowedFileType(originalFile)) {
      return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
    }

    const filename = sanitizeFilename(originalFile.name);
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    await ensureUploadDirExists();

    const timestamp = Date.now();
    const storedFilename = `${timestamp}-${filename}`;
    const filePath = path.join(FILE_UPLOAD_DIR, storedFilename);

    try {
      await fs.writeFile(filePath, fileBuffer);
      return NextResponse.json({
        success: true,
        file: {
          originalName: originalFile.name,
          storedName: storedFilename,
          mimeType: originalFile.type,
          size: originalFile.size,
          path: filePath,
        },
      });
    } catch (_error) {
      return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }
  } catch (_error) {
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}

function sanitizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function isAllowedFileType(file: File) {
  if (ALLOWED_MIME_TYPES.has(file.type)) {
    return true;
  }

  const extension = path.extname(file.name).toLowerCase().replace(/^\./, "");
  if (!extension) {
    return false;
  }

  return ALLOWED_EXTENSIONS.has(extension);
}
