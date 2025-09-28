import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await context.params;
    
    // Sanitize filename to prevent directory traversal
    const sanitizedFilename = path.basename(filename);
    if (!sanitizedFilename.endsWith('.md')) {
      return NextResponse.json({ error: "Invalid file type" }, { status: 400 });
    }

    // Go up one level from front/new directory to project root
    const projectRoot = path.dirname(path.dirname(process.cwd()));
    const reportsDir = path.join(projectRoot, "reports");
    const filePath = path.join(reportsDir, sanitizedFilename);

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    // Read the file content
    const fileContent = await fs.readFile(filePath, "utf-8");

    // Return the file content with appropriate headers
    return new NextResponse(fileContent, {
      headers: {
        "Content-Type": "text/markdown",
        "Content-Disposition": `attachment; filename="${sanitizedFilename}"`,
      },
    });
  } catch (error) {
    console.error("Error downloading report:", error);
    return NextResponse.json({ error: "Failed to download report" }, { status: 500 });
  }
}
