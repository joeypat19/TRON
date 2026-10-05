import Link from "next/link";
import SearchBox from "./components/SearchBox";

const shortcuts = [
  { label: "TRON Drive", query: "TRON Drive", symbol: "D" },
  { label: "TRON Mail", query: "TRON Mail", symbol: "M" },
  { label: "TRON Calendar", query: "TRON Calendar", symbol: "31" },
  { label: "TRON Docs", query: "TRON Docs", symbol: "D" },
  { label: "TRON Maps", query: "TRON Maps", symbol: "M" },
  { label: "TRON Video", query: "TRON Video", symbol: "▶" },
];

export default function Home() {
  return (
    <main className="home-page">
      <header className="home-header">
        <Link className="home-brand" href="/" aria-label="TRON home">TRON</Link>
        <nav className="home-nav" aria-label="TRON navigation">
          <Link href="/search?q=TRON">Search</Link>
          <span className="nav-dot" aria-hidden="true" />
          <span>Local index</span>
          <a className="download-button" href="/api/download">Download latest TRON</a>
        </nav>
      </header>

      <section className="home-content" aria-label="TRON Search">
        <div className="home-center">
          <div className="wordmark" aria-label="TRON" role="img">TRON</div>
          <p className="home-kicker">Local search, connected to the real web</p>
          <SearchBox />
          <div className="shortcuts" aria-label="TRON shortcuts">
            {shortcuts.map((shortcut) => (
              <Link className="shortcut" href={`/search?q=${encodeURIComponent(shortcut.query)}`} key={shortcut.label}>
                <span className="shortcut-icon" aria-hidden="true">{shortcut.symbol}</span>
                <span>{shortcut.label}</span>
              </Link>
            ))}
            <span className="shortcut shortcut-disabled" aria-label="More shortcuts coming soon">
              <span className="shortcut-icon" aria-hidden="true">↗</span>
              <span>Show more</span>
            </span>
          </div>
        </div>
        <p className="home-note">TRON searches the results stored locally on this system.</p>
      </section>
    </main>
  );
}
