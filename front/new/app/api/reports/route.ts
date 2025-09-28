import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export async function GET(request: NextRequest) {
  try {
    // Go up one level from front/new directory to project root
    const projectRoot = path.dirname(path.dirname(process.cwd()));
    const reportsDir = path.join(projectRoot, "reports");
    
    // Check if reports directory exists
    try {
      await fs.access(reportsDir);
    } catch {
      // Directory doesn't exist, return empty array
      return NextResponse.json({ reports: [] });
    }

    // Read all files in the reports directory
    const files = await fs.readdir(reportsDir);
    
    // Filter for markdown files and get their stats
    const reportFiles = await Promise.all(
      files
        .filter(file => file.endsWith('.md'))
        .map(async (file) => {
          const filePath = path.join(reportsDir, file);
          const stats = await fs.stat(filePath);
          
          return {
            filename: file,
            path: filePath,
            created: stats.birthtime.toISOString(),
            size: stats.size,
          };
        })
    );

    // Sort by creation date (newest first)
    reportFiles.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());

    return NextResponse.json({ reports: reportFiles });
  } catch (error) {
    console.error("Error fetching reports:", error);
    return NextResponse.json({ error: "Failed to fetch reports" }, { status: 500 });
  }
}
