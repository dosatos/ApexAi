import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { canvas_state, doc_id } = body;

    if (!canvas_state) {
      return NextResponse.json(
        { error: "Canvas state is required" },
        { status: 400 }
      );
    }

    if (!doc_id) {
      return NextResponse.json(
        { error: "Document ID is required" },
        { status: 400 }
      );
    }

    // Make request to Python agent's export endpoint
    const agentUrl = process.env.AGENT_URL || 'http://localhost:9000';
    const response = await fetch(`${agentUrl}/docs/export`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        canvas_state,
        doc_id,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Agent export failed:', errorText);
      return NextResponse.json(
        { error: "Failed to export to Google Docs", details: errorText },
        { status: 500 }
      );
    }

    const result = await response.json();
    return NextResponse.json(result);

  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json(
      { error: "Internal server error during export" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ message: "Docs export API endpoint" });
}