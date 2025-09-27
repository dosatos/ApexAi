import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { item } = body;

    if (!item) {
      return NextResponse.json(
        { error: "Item data is required" },
        { status: 400 }
      );
    }

    // Make request to Python agent to create new document with item content
    const agentUrl = process.env.AGENT_URL || 'http://localhost:9000';
    const response = await fetch(`${agentUrl}/docs/create-with-item`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        item: item,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Agent create with item failed:', errorText);
      return NextResponse.json(
        { error: "Failed to create document with item content", details: errorText },
        { status: 500 }
      );
    }

    const result = await response.json();
    return NextResponse.json(result);

  } catch (error) {
    console.error('Create with item error:', error);
    return NextResponse.json(
      { error: "Internal server error during document creation with item" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ message: "Docs create with item API endpoint" });
}