export async function GET() {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "LLM_API_KEY not configured" },
      { status: 500 }
    );
  }
  return Response.json({ token: apiKey });
}
