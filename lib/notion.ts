type NotionPage = { id: string; url: string };

const text = (content: string) => ({ type: "text", text: { content: content.slice(0, 2000) } });

export async function publishToNotion(input: { title: string; markdown: string; status: "draft" | "final" }) {
  const token = process.env.NOTION_API_KEY;
  const parentId = process.env.NOTION_PARENT_PAGE_ID;
  if (!token || !parentId) throw new Error("Notion is not configured. Set NOTION_API_KEY and NOTION_PARENT_PAGE_ID, then share the parent page with the integration.");
  const children = input.markdown.split(/\n{2,}/).filter(Boolean).slice(0, 90).map((paragraph) => ({ object: "block", type: "paragraph", paragraph: { rich_text: [text(paragraph)] } }));
  const response = await fetch("https://api.notion.com/v1/pages", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Notion-Version": "2026-03-11", "content-type": "application/json" }, body: JSON.stringify({ parent: { type: "page_id", page_id: parentId }, properties: { title: { title: [text(`${input.status === "draft" ? "DRAFT · " : ""}${input.title}`)] } }, children }) });
  const payload = await response.json() as NotionPage & { message?: string };
  if (!response.ok) throw new Error(payload.message ?? `Notion API ${response.status}`);
  return payload;
}
