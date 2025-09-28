import { NextRequest, NextResponse } from "next/server";

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

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (!FILE_SERVICE_BASE_URL) {
      console.error(
        "File service base URL is not configured. Set FILE_SERVICE_BASE_URL or NEXT_PUBLIC_FILE_SERVICE_BASE_URL."
      );
      return NextResponse.json(
        { error: "File service unavailable" },
        { status: 500 }
      );
    }

    const fileId = params.id;
    const backendUrl = new URL(`/api/v1/files/${encodeURIComponent(fileId)}`, FILE_SERVICE_BASE_URL);

    request.nextUrl.searchParams.forEach((value, key) => {
      backendUrl.searchParams.set(key, value);
    });

    const headers: Record<string, string> = {
      Accept: "application/json",
    };

    if (FILE_SERVICE_AUTH_HEADER && FILE_SERVICE_AUTH_VALUE) {
      headers[FILE_SERVICE_AUTH_HEADER] = FILE_SERVICE_AUTH_VALUE;
    }

    const backendResponse = await fetch(backendUrl.toString(), {
      method: "GET",
      headers,
      cache: "no-store",
    });

    if (!backendResponse.ok) {
      const errorBody = await safeParseJson(backendResponse);
      return NextResponse.json(
        errorBody ?? { error: "Failed to fetch file" },
        { status: backendResponse.status }
      );
    }

    const payload = await backendResponse.json();
    return NextResponse.json(payload);
  } catch (error) {
    console.error("Error fetching file:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function safeParseJson(response: Response) {
  try {
    return await response.json();
  } catch (_error) {
    return null;
  }
}
