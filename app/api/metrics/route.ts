import { getAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  let runs = 0, input = 0, output = 0, quality = 0;
  const admin = getAdminClient();
  if (admin) {
    const { data, error } = await admin.from("mission_runs").select("input_tokens,output_tokens,quality_score").limit(500);
    if (error) console.error(JSON.stringify({ event: "metrics.query_failed", error: error.message }));
    if (!error && data) {
      runs = data.length; input = data.reduce((sum, row) => sum + row.input_tokens, 0); output = data.reduce((sum, row) => sum + row.output_tokens, 0);
      quality = runs ? data.reduce((sum, row) => sum + (row.quality_score ?? 0), 0) / runs : 0;
    }
  }
  const text = [`# HELP mission_runs_total Completed mission runs`, `# TYPE mission_runs_total counter`, `mission_runs_total ${runs}`, `# HELP llm_input_tokens_total LLM input tokens`, `# TYPE llm_input_tokens_total counter`, `llm_input_tokens_total ${input}`, `# HELP llm_output_tokens_total LLM output tokens`, `# TYPE llm_output_tokens_total counter`, `llm_output_tokens_total ${output}`, `# HELP mission_quality_score_average Average quality score`, `# TYPE mission_quality_score_average gauge`, `mission_quality_score_average ${quality}`].join("\n");
  return new Response(`${text}\n`, { headers: { "content-type": "text/plain; version=0.0.4" } });
}
