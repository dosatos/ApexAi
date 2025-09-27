import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { doc_id } = body;

    if (!doc_id) {
      return NextResponse.json(
        { error: "Document ID is required" },
        { status: 400 }
      );
    }

    // Make request to Python agent's import endpoint
    const agentUrl = process.env.AGENT_URL || 'http://localhost:9000';
    const response = await fetch(`${agentUrl}/docs/import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        doc_id: doc_id,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Agent import failed:', errorText);
      return NextResponse.json(
        { error: "Failed to import from Google Docs", details: errorText },
        { status: 500 }
      );
    }

    const result = await response.json();
    return NextResponse.json(result);

  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json(
      { error: "Internal server error during import" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ message: "Docs import API endpoint" });
}