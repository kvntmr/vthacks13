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
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-powerpoint",
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
  "ppt",
  "pptx",
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
const FILE_SERVICE_BASE_URL =
  process.env.FILE_SERVICE_BASE_URL ??
  process.env.NEXT_PUBLIC_FILE_SERVICE_BASE_URL ??
  process.env.BACKEND_API_URL ??
  process.env.NEXT_PUBLIC_BACKEND_API_URL ??
  "";
const FILE_SERVICE_AUTH_VALUE =
  process.env.FILE_SERVICE_AUTH_VALUE ??
  process.env.FILE_SERVICE_API_KEY ??
  process.env.FILE_SERVICE_AUTH_TOKEN ??
  "";
const FILE_SERVICE_AUTH_HEADER =
  process.env.FILE_SERVICE_AUTH_HEADER ??
  (FILE_SERVICE_AUTH_VALUE ? "Authorization" : "");

async function ensureUploadDirExists() {
  await fs.mkdir(FILE_UPLOAD_DIR, { recursive: true });
}

async function fileExists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch (_error) {
    return false;
  }
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

    const filename = sanitizeFilename(path.basename(originalFile.name));
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    await ensureUploadDirExists();

    // Use clean filename without timestamp prefix, but handle duplicates
    let storedFilename = filename;
    let filePath = path.join(FILE_UPLOAD_DIR, storedFilename);
    
    // Handle duplicate filenames by adding a counter
    let counter = 1;
    while (await fileExists(filePath)) {
      const nameWithoutExt = path.parse(filename).name;
      const ext = path.parse(filename).ext;
      storedFilename = `${nameWithoutExt}_${counter}${ext}`;
      filePath = path.join(FILE_UPLOAD_DIR, storedFilename);
      counter++;
    }

    try {
      await fs.writeFile(filePath, fileBuffer);

      // Call backend parsing endpoint
      let processingResult = null;
      let processedJsonPath: string | undefined;
      let backendProcessingSuccess = false;
      
      try {
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:8000';
        const formData = new FormData();
        formData.append('files', originalFile);
        
        const backendResponse = await fetch(`${backendUrl}/api/v1/files/process-upload-parallel`, {
          method: 'POST',
          body: formData,
        });
        
        if (backendResponse.ok) {
          const backendData = await backendResponse.json();
          if (backendData.success && backendData.results && backendData.results.length > 0) {
            processingResult = backendData.results[0];
            backendProcessingSuccess = true;
            
            // Save the processing result as JSON
            const jsonFilename = `${storedFilename}.json`;
            processedJsonPath = path.join(FILE_UPLOAD_DIR, jsonFilename);
            await fs.writeFile(
              processedJsonPath,
              JSON.stringify(processingResult, null, 2),
              "utf-8"
            );
          } else {
            console.error('Backend processing failed - no results:', backendData);
            throw new Error('Backend processing failed - no results returned');
          }
        } else {
          const errorText = await backendResponse.text();
          console.error('Backend processing failed:', backendResponse.status, errorText);
          throw new Error(`Backend processing failed: ${backendResponse.status} ${errorText}`);
        }
      } catch (error) {
        console.error('Error calling backend processing:', error);
        // Don't fallback to local processing - fail the upload if backend fails
        throw new Error(`Failed to process file with backend: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      return NextResponse.json({
        success: true,
        file: {
          originalName: originalFile.name,
          storedName: storedFilename,
          mimeType: originalFile.type,
          size: originalFile.size,
          path: filePath,
          processedJsonPath,
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

async function maybeProcessFile({
  filePath,
  buffer,
  filename,
  mimeType,
}: {
  filePath: string;
  buffer: Buffer;
  filename: string;
  mimeType: string;
}): Promise<any | undefined> {
  if (!FILE_SERVICE_BASE_URL) {
    return undefined;
  }

  try {
    const endpoint = new URL("/api/v1/files/process-upload", FILE_SERVICE_BASE_URL);
    const headers: Record<string, string> = {
      Accept: "application/json",
    };

    if (FILE_SERVICE_AUTH_HEADER && FILE_SERVICE_AUTH_VALUE) {
      headers[FILE_SERVICE_AUTH_HEADER] = FILE_SERVICE_AUTH_VALUE;
    }

    const formData = new FormData();
    formData.append("extract_property_data", "true");
    formData.append(
      "file",
      new Blob([new Uint8Array(buffer)], { type: mimeType || "application/octet-stream" }),
      filename || path.basename(filePath)
    );

    const response = await fetch(endpoint.toString(), {
      method: "POST",
      headers,
      body: formData,
    });

    if (!response.ok) {
      console.warn(
        `File processing service returned ${response.status}: ${await response.text()}`
      );
      return undefined;
    }

    const payload = await response.json();
    return payload;
  } catch (error) {
    console.warn("Failed to process file via backend:", error);
    return undefined;
  }
}
