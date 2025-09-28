import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { promises as fs } from "fs";
import { auth } from "@/app/(auth)/auth";
import { backendAPI } from "@/lib/api/backend";

type Params = { params: { id: string } } | { params: Promise<{ id: string }> };

export async function GET(
  request: NextRequest,
  context: Params
) {
  try {
    const rawParams = await Promise.resolve(context.params);
    const fileId = rawParams?.id;

    if (!fileId) {
      return NextResponse.json(
        { error: "File ID is required" },
        { status: 400 }
      );
    }

    const filename = fileId.replace(/^file-/, "");
    const uploadDir = process.env.FILE_UPLOAD_DIR ?? path.join(process.cwd(), "uploads");

    // Use the filename directly since we're now storing clean filenames
    const filePath = path.join(uploadDir, filename);
    const jsonPath = path.join(uploadDir, `${filename}.json`);
    
    // Check if the file exists
    if (!(await fileExists(filePath))) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    let payload: any = null;

    if (await fileExists(jsonPath)) {
      try {
        payload = JSON.parse(await fs.readFile(jsonPath, "utf8"));
      } catch (error) {
        console.warn("Failed to parse JSON file, falling back to raw file", error);
      }
    }

    if (payload?.parsed_content?.data && Array.isArray(payload.parsed_content.data)) {
      const headers = Array.isArray(payload.parsed_content.headers)
        ? payload.parsed_content.headers.map((header: string) => normalizeCell(header))
        : undefined;
      payload = {
        data: payload.parsed_content.data.map((row: string[]) => row.map(normalizeCell)),
        headers,
      };
    }

    if (!payload || !Array.isArray(payload.data)) {
      if (!(await fileExists(filePath))) {
        return NextResponse.json({ error: "File not found" }, { status: 404 });
      }

      if (storedName.toLowerCase().endsWith(".csv")) {
        const csvContent = await fs.readFile(filePath, "utf8");
        const lines = csvContent
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter((line) => line.length > 0);

        if (lines.length === 0) {
          return NextResponse.json({ error: "CSV file is empty" }, { status: 400 });
        }

        const headerLine = lines.shift()!;
        const headers = parseCsvLine(headerLine).map(normalizeCell);
        const rows = lines.map((line) => parseCsvLine(line).map(normalizeCell));

        payload = { data: rows, headers };
      } else {
        const buffer = await fs.readFile(filePath);
        payload = { data: [[buffer.toString("base64")]], encoding: "base64" };
      }
    }

    return NextResponse.json(payload);
  } catch (error) {
    console.error("Error fetching file:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function fileExists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch (_error) {
    return false;
  }
}

function normalizeCell(value: string) {
  const trimmed = value.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1).replace(/""/g, '"').trim();
  }
  return trimmed;
}

function parseCsvLine(line: string) {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

export async function DELETE(
  request: NextRequest,
  context: Params
) {
  try {
    const session = await auth();
    const isProduction = process.env.NODE_ENV === "production";

    if (!session && isProduction) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rawParams = await Promise.resolve(context.params);
    const fileId = rawParams?.id;

    if (!fileId) {
      return NextResponse.json(
        { error: "File ID is required" },
        { status: 400 }
      );
    }

    const filename = fileId.replace(/^file-/, "");
    const uploadDir = process.env.FILE_UPLOAD_DIR ?? path.join(process.cwd(), "uploads");

    // Use the filename directly since we're now storing clean filenames
    const filePath = path.join(uploadDir, filename);
    const jsonPath = path.join(uploadDir, `${filename}.json`);
    
    // Check if the file exists
    if (!(await fileExists(filePath))) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Delete files from uploads directory
    const filesToDelete = [filePath, jsonPath];
    const deletedFiles: string[] = [];

    for (const fileToDelete of filesToDelete) {
      if (await fileExists(fileToDelete)) {
        try {
          await fs.unlink(fileToDelete);
          deletedFiles.push(fileToDelete);
        } catch (error) {
          console.error(`Failed to delete file ${fileToDelete}:`, error);
        }
      }
    }

    // Delete from AI memory using backend API
    try {
      await backendAPI.deleteDocumentsByFilenames([filename]);
    } catch (error) {
      console.error("Failed to delete from AI memory:", error);
      // Continue even if AI memory deletion fails
    }

    return NextResponse.json({
      success: true,
      message: `File ${fileId} deleted successfully`,
      deletedFiles,
    });
  } catch (error) {
    console.error("Error deleting file:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
