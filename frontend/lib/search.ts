export type SearchResult = {
  rank: number;
  title: string;
  url: string;
  description: string | null;
  age: string | null;
  domain: string;
  display_url: string;
  source_query: string;
  collected_at: string;
};

export type TimeToolResult = {
  tool: "time";
  location: string;
  timezone: string;
  abbreviation: string;
  time: string;
  date: string;
  iso: string;
};

export type SearchResponse = {
  query: string;
  page: number;
  limit: number;
  result_count: number;
  has_previous: boolean;
  has_next: boolean;
  results: SearchResult[];
  tool: TimeToolResult | null;
  corrected_query?: string | null;
};

export async function getLocalSearch(query: string, page = 1, limit = 10): Promise<SearchResponse> {
  const backendUrl = process.env.BACKEND_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:938";
  const url = new URL("/api/search", backendUrl);
  url.searchParams.set("q", query);
  url.searchParams.set("page", String(page));
  url.searchParams.set("limit", String(limit));

  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Local search failed with status ${response.status}`);
  }
  return response.json() as Promise<SearchResponse>;
}
