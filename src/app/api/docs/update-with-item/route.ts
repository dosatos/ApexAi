import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { doc_id, item } = body;

    if (!doc_id) {
      return NextResponse.json(
        { error: "Document ID is required" },
        { status: 400 }
      );
    }

    if (!item) {
      return NextResponse.json(
        { error: "Item data is required" },
        { status: 400 }
      );
    }

    // Make request to Python agent to update document with item content
    const agentUrl = process.env.AGENT_URL || 'http://localhost:9000';
    const response = await fetch(`${agentUrl}/docs/update-with-item`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        doc_id: doc_id,
        item: item,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Agent update with item failed:', errorText);
      return NextResponse.json(
        { error: "Failed to update document with item content", details: errorText },
        { status: 500 }
      );
    }

    const result = await response.json();
    return NextResponse.json(result);

  } catch (error) {
    console.error('Update with item error:', error);
    return NextResponse.json(
      { error: "Internal server error during document update with item" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ message: "Docs update with item API endpoint" });
}