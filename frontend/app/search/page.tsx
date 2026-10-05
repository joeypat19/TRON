import Link from "next/link";
import Image from "next/image";
import SearchBox from "../components/SearchBox";
import TimeToolCard from "../components/TimeToolCard";
import { getLocalSearch, type SearchResult } from "../../lib/search";

export const dynamic = "force-dynamic";

function parameterValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function searchUrl(query: string, page: number): string {
  const params = new URLSearchParams({ q: query });
  if (page > 1) params.set("page", String(page));
  return `/search?${params.toString()}`;
}

function collectedDate(result: SearchResult): string {
  const date = new Date(result.collected_at);
  if (Number.isNaN(date.getTime())) return "Stored locally";
  return `Stored ${new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(date)}`;
}

function HeaderIcon({ type }: { type: "share" | "apps" }) {
  const common = {
    className: "header-icon-svg",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  if (type === "share") {
    return <svg {...common}><circle cx="18" cy="5" r="2" /><circle cx="6" cy="12" r="2" /><circle cx="18" cy="19" r="2" /><path d="m7.8 11 8.4-5M7.8 13l8.4 5" /></svg>;
  }

  return <svg {...common} fill="currentColor" stroke="none"><circle cx="5" cy="5" r="1.6" /><circle cx="12" cy="5" r="1.6" /><circle cx="19" cy="5" r="1.6" /><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /><circle cx="5" cy="19" r="1.6" /><circle cx="12" cy="19" r="1.6" /><circle cx="19" cy="19" r="1.6" /></svg>;
}

function ResultsNavigation({ query, page }: { query: string; page: number }) {
  const tabs = ["All", "Shopping", "Images", "Videos", "News", "Forums"];
  return (
    <nav className="results-navigation" aria-label="Search categories">
      <Link className="results-navigation-active" href={searchUrl(query, page)} aria-current="page">All</Link>
      {tabs.slice(1).map((tab) => (
        <Link href={searchUrl(query, 1)} key={tab}>{tab}</Link>
      ))}
      <button type="button" className="results-navigation-menu">More <span aria-hidden="true">⌄</span></button>
      <button type="button" className="results-navigation-menu">Tools <span aria-hidden="true">⌄</span></button>
    </nav>
  );
}

function Pagination({ query, page, resultCount, limit }: { query: string; page: number; resultCount: number; limit: number }) {
  const totalPages = Math.max(1, Math.ceil(resultCount / limit));
  const wordmark = `Tr${"o".repeat(Math.min(totalPages, 24))}n`;
  const pageItems: Array<number | "ellipsis"> = [];
  const addPage = (pageNumber: number) => {
    if (!pageItems.includes(pageNumber)) pageItems.push(pageNumber);
  };

  if (totalPages <= 9) {
    for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) addPage(pageNumber);
  } else {
    addPage(1);
    if (page > 4) pageItems.push("ellipsis");
    for (let pageNumber = Math.max(2, page - 1); pageNumber <= Math.min(totalPages - 1, page + 1); pageNumber += 1) {
      addPage(pageNumber);
    }
    if (page < totalPages - 3) pageItems.push("ellipsis");
    addPage(totalPages);
  }

  return (
    <nav className="pagination" aria-label="Search result pages">
      <div className="pagination-wordmark" aria-label={`${totalPages} search result pages`} title={`${totalPages} search result pages`}>
        {wordmark}
      </div>
      <div className="pagination-pages">
        {page > 1 && <Link className="pagination-next" href={searchUrl(query, page - 1)}>Previous</Link>}
        {pageItems.map((pageItem, index) => pageItem === "ellipsis" ? (
          <span className="pagination-ellipsis" aria-hidden="true" key={`ellipsis-${index}`}>…</span>
        ) : pageItem === page ? (
            <span className="pagination-current" aria-current="page" key={pageItem}>{pageItem}</span>
          ) : (
            <Link href={searchUrl(query, pageItem)} key={pageItem}>{pageItem}</Link>
          )
        )}
        {page < totalPages && <Link className="pagination-next" href={searchUrl(query, page + 1)}>Next</Link>}
      </div>
    </nav>
  );
}

function ResultCard({ result }: { result: SearchResult }) {
  return (
    <li className="result-card">
      <div className="result-source">
        <Image
          className="source-favicon"
          src={`/api/favicon?domain=${encodeURIComponent(result.domain)}`}
          alt=""
          width={24}
          height={24}
          unoptimized
        />
        <span>{result.domain}</span>
        <span className="source-separator">·</span>
        <span>{result.age ?? collectedDate(result)}</span>
      </div>
      <a className="result-title" href={result.url}>{result.title}</a>
      <a className="result-url" href={result.url}>{result.display_url}</a>
      {result.description && <p className="result-description">{result.description}</p>}
    </li>
  );
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[]; page?: string | string[] }>;
}) {
  const params = await searchParams;
  const query = parameterValue(params.q).trim();
  const requestedPage = Number.parseInt(parameterValue(params.page), 10);
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;

  let searchData;
  let searchError = false;
  if (query) {
    try {
      searchData = await getLocalSearch(query, page);
    } catch {
      searchError = true;
    }
  }

  return (
    <main className="results-page">
      <header className="results-header">
        <div className="results-header-main">
          <Link className="results-brand" href="/" aria-label="TRON home">TRON</Link>
          <SearchBox initialQuery={query} compact />
          <div className="results-header-actions" aria-label="TRON tools">
            <a className="results-download-button" href="/api/download">Get latest TRON</a>
            <button type="button" className="results-header-action" aria-label="Share this search" title="Share this search">
              <HeaderIcon type="share" />
            </button>
            <button type="button" className="results-header-action" aria-label="Open TRON apps" title="TRON apps">
              <HeaderIcon type="apps" />
            </button>
            <span className="results-avatar" aria-label="Profile">J</span>
          </div>
        </div>
        <ResultsNavigation query={query} page={page} />
      </header>

      <section className="results-content" aria-live="polite">
        {!searchError && searchData?.tool && <TimeToolCard tool={searchData.tool} />}

        {!searchError && searchData?.corrected_query && (
          <div className="search-correction" role="status">
            <p>
              These are results for <Link href={searchUrl(searchData.corrected_query, searchData.page)}>{searchData.corrected_query}</Link>
            </p>
            <p>
              Search instead for <Link href={searchUrl(query, page)}>{query}</Link>
            </p>
          </div>
        )}

        {!query && (
          <div className="results-empty">
            <h1>Search TRON</h1>
            <p>Type a search above to explore the stored local results.</p>
          </div>
        )}

        {searchError && (
          <div className="results-state results-error">
            <span className="state-symbol" aria-hidden="true">!</span>
            <h1>TRON could not load local results</h1>
            <p>The local search service is unavailable. Try again in a moment.</p>
            <Link className="state-action" href={searchUrl(query, page)}>Try again</Link>
          </div>
        )}

        {!searchError && searchData && searchData.result_count === 0 && !searchData.tool && (
          <div className="results-state">
            <span className="state-symbol" aria-hidden="true">—</span>
            <h1>No local results for “{query}”</h1>
            <p>TRON only searches its stored local results and did not find a match.</p>
          </div>
        )}

        {!searchError && searchData && searchData.result_count > 0 && (
          <div className="results-list-column">
            <ol className="result-list">
              {searchData.results.map((result) => <ResultCard key={result.url} result={result} />)}
            </ol>
            <Pagination query={query} page={searchData.page} resultCount={searchData.result_count} limit={searchData.limit} />
          </div>
        )}
      </section>
      <footer className="results-footer">
        <div className="results-footer-inner">
          <p className="results-footer-note">Results are not personalised</p>
          <div className="results-footer-region">
            <span className="results-footer-country">Australia</span>
            <span className="results-footer-divider" aria-hidden="true" />
            <span className="results-footer-index"><span className="results-footer-dot" aria-hidden="true" />TRON local index</span>
            <span className="results-footer-detail">Based on locally stored results</span>
          </div>
          <nav className="results-footer-links" aria-label="Footer links">
            <a href="#help">Help</a>
            <a href="#feedback">Send feedback</a>
            <a href="#privacy">Privacy</a>
            <a href="#terms">Terms</a>
          </nav>
        </div>
      </footer>
    </main>
  );
}
