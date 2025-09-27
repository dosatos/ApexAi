import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { folder_id, page_size } = body;

    // Make request to Python agent's list endpoint
    const agentUrl = process.env.AGENT_URL || 'http://localhost:9000';
    const response = await fetch(`${agentUrl}/drive/list`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        folder_id: folder_id || null,
        page_size: page_size || 20,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Agent list files failed:', errorText);
      return NextResponse.json(
        { error: "Failed to list Google Drive files", details: errorText },
        { status: 500 }
      );
    }

    const result = await response.json();
    return NextResponse.json(result);

  } catch (error) {
    console.error('List files error:', error);
    return NextResponse.json(
      { error: "Internal server error during file listing" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ message: "Drive list API endpoint" });
}