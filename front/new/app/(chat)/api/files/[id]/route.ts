import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const fileId = params.id;
    
    // For now, we'll return mock data based on the file ID
    // In a real implementation, this would fetch from your backend/database
    const mockFileData = getMockFileData(fileId);
    
    if (!mockFileData) {
      return NextResponse.json(
        { error: "File not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(mockFileData);
  } catch (error) {
    console.error("Error fetching file:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

function getMockFileData(fileId: string) {
  // Mock data for different file types
  const mockFiles: Record<string, any> = {
    "file-lease-comps": {
      id: "file-lease-comps",
      name: "Lease Comps Summary.xlsx",
      type: "xlsx",
      data: [
        ["Property", "Address", "Rent PSF", "Size (SF)", "Lease Term"],
        ["Office Building A", "123 Main St", "$45", "50000", "5 years"],
        ["Office Building B", "456 Oak Ave", "$42", "75000", "3 years"],
        ["Office Building C", "789 Pine Rd", "$48", "60000", "7 years"],
        ["Office Building D", "321 Elm St", "$40", "40000", "2 years"],
        ["Office Building E", "654 Maple Dr", "$46", "55000", "4 years"],
      ]
    },
    "file-financial-data": {
      id: "file-financial-data",
      name: "Financial Data Q3.csv",
      type: "csv",
      data: [
        ["Month", "Revenue", "Expenses", "Net Income", "Occupancy Rate"],
        ["July", "$125,000", "$85,000", "$40,000", "92%"],
        ["August", "$130,000", "$88,000", "$42,000", "94%"],
        ["September", "$135,000", "$90,000", "$45,000", "96%"],
        ["October", "$140,000", "$92,000", "$48,000", "95%"],
        ["November", "$145,000", "$95,000", "$50,000", "97%"],
      ]
    },
    "file-tenant-list": {
      id: "file-tenant-list",
      name: "Tenant List.csv",
      type: "csv",
      data: [
        ["Tenant Name", "Suite", "Lease Start", "Lease End", "Monthly Rent", "Contact"],
        ["ABC Corp", "Suite 100", "2023-01-01", "2028-01-01", "$15,000", "John Smith"],
        ["XYZ Inc", "Suite 200", "2022-06-01", "2027-06-01", "$12,500", "Jane Doe"],
        ["Tech Solutions", "Suite 300", "2023-03-01", "2026-03-01", "$18,000", "Mike Johnson"],
        ["Global Services", "Suite 400", "2021-09-01", "2026-09-01", "$22,000", "Sarah Wilson"],
        ["Startup Co", "Suite 500", "2023-07-01", "2025-07-01", "$8,500", "Tom Brown"],
      ]
    }
  };

  return mockFiles[fileId] || null;
}
