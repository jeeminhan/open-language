import { endSession } from "@/lib/db";

export async function POST(request: Request) {
  const { sessionId } = await request.json();

  if (!sessionId) {
    return Response.json({ error: "sessionId required" }, { status: 400 });
  }

  const session = await endSession(sessionId);
  return Response.json({ session });
}
