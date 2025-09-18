from typing import Annotated, List, Optional, Dict, Any

from llama_index.core.workflow import Context
from llama_index.llms.openai import OpenAI
from llama_index.protocols.ag_ui.events import StateSnapshotWorkflowEvent
from llama_index.protocols.ag_ui.router import get_ag_ui_workflow_router


# --- Backend tools (server-side) ---


async def set_plan(
    ctx: Context,
    steps: Annotated[List[str], "Step titles to initialize a plan with."],
) -> Dict[str, Any]:
    """Initialize a plan consisting of step descriptions. Resets progress and sets status to 'in_progress'."""
    state: Dict[str, Any] = await ctx.get("state", default={})
    plan_steps = [{"title": str(s), "status": "pending"} for s in (steps or [])]
    if plan_steps:
        plan_steps[0]["status"] = "in_progress"
        state["currentStepIndex"] = 0
        state["planStatus"] = "in_progress"
    else:
        state["currentStepIndex"] = -1
        state["planStatus"] = ""
    state["planSteps"] = plan_steps
    ctx.write_event_to_stream(StateSnapshotWorkflowEvent(snapshot=state))
    await ctx.set(state)
    return {"initialized": True, "steps": steps}


async def update_plan_progress(
    ctx: Context,
    step_index: Annotated[int, "Index of the step to update (0-based)."],
    status: Annotated[str, "One of: pending, in_progress, completed, blocked, failed"],
    note: Annotated[Optional[str], "Optional short note for this step."] = None,
) -> Dict[str, Any]:
    """Update a single plan step's status, and optionally add a note."""
    state: Dict[str, Any] = await ctx.get("state", default={})
    steps: List[Dict[str, Any]] = list(state.get("planSteps", []) or [])
    if 0 <= step_index < len(steps):
        if note:
            steps[step_index]["note"] = note
        steps[step_index]["status"] = status
        state["planSteps"] = steps
        # current index & overall status heuristics
        if status == "in_progress":
            state["currentStepIndex"] = step_index
            state["planStatus"] = "in_progress"
        # Aggregate overall status
        statuses = [str(s.get("status", "")) for s in steps]
        if any(s == "failed" for s in statuses):
            state["planStatus"] = "failed"
        elif any(s == "in_progress" for s in statuses):
            state["planStatus"] = "in_progress"
        elif all(s == "completed" for s in statuses) and steps:
            state["planStatus"] = "completed"
            state["currentStepIndex"] = max(0, len(steps) - 1)
        else:
            # leave as-is
            pass
        ctx.write_event_to_stream(StateSnapshotWorkflowEvent(snapshot=state))
        await ctx.set(state)
        return {"updated": True, "index": step_index, "status": status, "note": note}
    return {"updated": False, "index": step_index, "status": status, "note": note}


async def complete_plan(ctx: Context) -> Dict[str, Any]:
    """Mark the plan as completed."""
    state: Dict[str, Any] = await ctx.get("state", default={})
    steps: List[Dict[str, Any]] = list(state.get("planSteps", []) or [])
    for s in steps:
        s["status"] = "completed"
    state["planSteps"] = steps
    state["planStatus"] = "completed"
    state["currentStepIndex"] = max(0, len(steps) - 1) if steps else -1
    ctx.write_event_to_stream(StateSnapshotWorkflowEvent(snapshot=state))
    await ctx.set(state)
    return {"completed": True}


FIELD_SCHEMA = (
    "FIELD SCHEMA (authoritative):\n"
    "- project.data:\n"
    "  - field1: string (text)\n"
    "  - field2: string (select: 'Option A' | 'Option B' | 'Option C')\n"
    "  - field3: string (date 'YYYY-MM-DD')\n"
    "  - field4: ChecklistItem[] where ChecklistItem={id: string, text: string, done: boolean, proposed: boolean}\n"
    "- entity.data:\n"
    "  - field1: string\n"
    "  - field2: string (select: 'Option A' | 'Option B' | 'Option C')\n"
    "  - field3: string[] (selected tags; subset of field3_options)\n"
    "  - field3_options: string[] (available tags)\n"
    "- note.data:\n"
    "  - field1: string (textarea; represents description)\n"
    "- chart.data:\n"
    "  - field1: Array<{id: string, label: string, value: number | ''}> with value in [0..100] or ''\n"
)

SYSTEM_PROMPT = (
    "You are a helpful AG-UI assistant.\n\n"
    + FIELD_SCHEMA +
    "\nMUTATION/TOOL POLICY:\n"
    "- When you claim to create/update/delete, you MUST call the corresponding tool(s) (frontend or backend).\n"
    "- After tools run, rely on the latest shared state (ground truth) when replying.\n"
    "- To set a card's subtitle (never the data fields): use setItemSubtitleOrDescription.\n\n"
    "DESCRIPTION MAPPING:\n"
    "- For project/entity/chart: treat 'description', 'overview', 'summary', 'caption', 'blurb' as the card subtitle; use setItemSubtitleOrDescription.\n"
    "- For notes: 'content', 'description', 'text', or 'note' refers to note content; use setNoteField1 / appendNoteField1 / clearNoteField1.\n\n"
    "PLANNING POLICY:\n"
    "- For multi-step requests, first propose a short plan (2-6 steps) and call set_plan with the step titles.\n"
    "- For each step, call update_plan_progress to mark in_progress and completed/failed with a short note.\n"
    "- When all steps are done, call complete_plan and provide a concise summary.\n\n"
    "STRICT GROUNDING RULES:\n"
    "1) ONLY use shared state (items/globalTitle/globalDescription/plan*) as the source of truth.\n"
    "2) Before ANY read or write, assume values may have changed; always read the latest state.\n"
    "3) If a command doesn't specify which item to change, ask to clarify.\n"
)

agentic_chat_router = get_ag_ui_workflow_router(
    llm=OpenAI(model="gpt-4.1"),
    # Frontend tools are provided dynamically by CopilotKit; no need to mirror them here.
    frontend_tools=[],
    backend_tools=[set_plan, update_plan_progress, complete_plan],
    system_prompt=SYSTEM_PROMPT,
    initial_state={
        # Shared state synchronized with the frontend canvas
        "items": [],
        "globalTitle": "",
        "globalDescription": "",
        "lastAction": "",
        "itemsCreated": 0,
        "planSteps": [],
        "currentStepIndex": -1,
        "planStatus": "",
    },
)
