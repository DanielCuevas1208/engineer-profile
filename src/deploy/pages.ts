export interface PublishedPageVerification {
  url: string;
  status: number;
  title: string;
}

export type PageFetcher = (
  input: string,
  init?: RequestInit
) => Promise<Pick<Response, "ok" | "status" | "url" | "text">>;

function pageUrl(value: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("Published site URL must be an absolute HTTPS URL.");
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
    throw new Error("Published site URL must be an absolute HTTPS URL without credentials.");
  }
  return parsed.toString();
}

function pageTitle(html: string): string {
  const match = html.match(/<title>\s*([^<]+?)\s*<\/title>/i);
  return match?.[1] ?? "";
}

export async function verifyPublishedPage(
  value: string,
  fetcher: PageFetcher = fetch
): Promise<PublishedPageVerification> {
  const url = pageUrl(value);
  const response = await fetcher(url, {
    headers: { accept: "text/html" },
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(`Published site returned HTTP ${response.status}.`);
  }

  const html = await response.text();
  const title = pageTitle(html);
  if (!title) {
    throw new Error("Published site does not contain an HTML title.");
  }
  if (!html.includes("Evidence before adjectives.")) {
    throw new Error("Published site does not contain the portfolio heading.");
  }
  if (!html.includes('href="feed.xml"')) {
    throw new Error("Published site does not link its RSS feed.");
  }

  return {
    url: response.url || url,
    status: response.status,
    title,
  };
}
