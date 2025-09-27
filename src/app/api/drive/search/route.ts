import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, page_size } = body;

    if (!query) {
      return NextResponse.json(
        { error: "Search query is required" },
        { status: 400 }
      );
    }

    // Make request to Python agent's search endpoint
    const agentUrl = process.env.AGENT_URL || 'http://localhost:9000';
    const response = await fetch(`${agentUrl}/drive/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: query,
        page_size: page_size || 20,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Agent search files failed:', errorText);
      return NextResponse.json(
        { error: "Failed to search Google Drive files", details: errorText },
        { status: 500 }
      );
    }

    const result = await response.json();
    return NextResponse.json(result);

  } catch (error) {
    console.error('Search files error:', error);
    return NextResponse.json(
      { error: "Internal server error during file search" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ message: "Drive search API endpoint" });
}