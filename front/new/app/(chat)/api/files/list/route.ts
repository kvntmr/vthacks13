import fs from "fs/promises";
import path from "path";

import { NextResponse } from "next/server";

type RealEstateFile = {
  id: string;
  name: string;
  type: "pdf" | "xlsx" | "doc" | "csv";
  size: string;
  status: "indexed" | "indexing" | "queued";
  updatedAt: string;
};

type RealEstateFolder = {
  id: string;
  name: string;
  description?: string;
  files: RealEstateFile[];
  children?: RealEstateFolder[];
};

const FILE_UPLOAD_DIR =
  process.env.FILE_UPLOAD_DIR ?? path.join(process.cwd(), "uploads");

export async function GET() {
  try {
    await fs.mkdir(FILE_UPLOAD_DIR, { recursive: true });
    const rootFolder = await buildFolder(FILE_UPLOAD_DIR, "");

    const payload: RealEstateFolder = {
      ...rootFolder,
      id: "library-root",
      name: "All Files",
      description: "Files uploaded through the workspace.",
    };

    return NextResponse.json({ success: true, folder: payload });
  } catch (error) {
    console.error("Failed to list uploaded files:", error);
    return NextResponse.json(
      { success: false, error: "Failed to list uploaded files" },
      { status: 500 }
    );
  }
}

async function buildFolder(dirPath: string, relativePath: string): Promise<RealEstateFolder> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });

  const files: RealEstateFile[] = [];
  const children: RealEstateFolder[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".")) {
      continue; // Skip hidden files/folders like .DS_Store
    }

    const entryFullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      const childRelativePath = relativePath ? path.join(relativePath, entry.name) : entry.name;
      const childFolder = await buildFolder(entryFullPath, childRelativePath);
      children.push({
        ...childFolder,
        id: `folder-${sanitizeId(childRelativePath)}`,
        name: entry.name,
      });
      continue;
    }

    if (entry.isFile()) {
      // Skip generated JSON files; we'll mark originals as indexed when present
      if (entry.name.endsWith(".json")) {
        continue;
      }

      const stats = await fs.stat(entryFullPath);
      const processedJsonExists = await fileExists(`${entryFullPath}.json`);

      // Use the filename directly since we're now storing clean filenames
      const fileName = entry.name;
      
      files.push({
        id: `file-${sanitizeId(fileName)}`,
        name: fileName,
        type: determineFileType(fileName),
        size: formatFileSize(stats.size),
        status: processedJsonExists ? "indexed" : "queued",
        updatedAt: stats.mtime.toISOString(),
      });
    }
  }

  return {
    id: relativePath ? `folder-${sanitizeId(relativePath)}` : "library-root",
    name: relativePath ? path.basename(relativePath) : "All Files",
    files,
    children: children.length > 0 ? children : undefined,
  };
}

function determineFileType(fileName: string): RealEstateFile["type"] {
  const extension = path.extname(fileName).toLowerCase();
  if (extension === ".pdf") return "pdf";
  if (extension === ".csv") return "csv";
  if (extension === ".xlsx" || extension === ".xls") return "xlsx";
  return "doc";
}

async function fileExists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch (_error) {
    return false;
  }
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function sanitizeId(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-");
}
