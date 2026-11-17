import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { getJSON } from "./api";
import type { ISearchResponse } from "./interfaces/SearchResponse";

const initialFilters = {
  city: "",
  minPrice: "",
  maxPrice: "",
  minBedrooms: "",
  keyword: "",
  targetBudget: "",
  pageSize: "5",
};
const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export default function App() {
  const [filters, setFilters] = useState(initialFilters);
  // Keep submitted filters separate so paging never applies unfinished edits.
  const [search, setSearch] = useState({ filters: initialFilters, page: 1 });
  const [cities, setCities] = useState<string[]>([]);
  const [cityError, setCityError] = useState("");
  const [result, setResult] = useState<ISearchResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    getJSON<string[]>("/api/cities", controller.signal)
      .then(setCities)
      .catch(() => {
        if (!controller.signal.aborted)
          setCityError(
            "City suggestions unavailable. You can still enter a city.",
          );
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({ page: String(search.page) });
    Object.entries(search.filters).forEach(([key, value]) => {
      if (value.trim()) query.set(key, value.trim());
    });
    setLoading(true);
    setError("");
    getJSON<ISearchResponse>(`/api/listings?${query}`, controller.signal)
      .then(setResult)
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setError(
            cause instanceof Error ? cause.message : "Unable to load listings.",
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    // Cancel obsolete requests to prevent older responses replacing new searches.
    return () => controller.abort();
  }, [search]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      filters.minPrice &&
      filters.maxPrice &&
      Number(filters.minPrice) > Number(filters.maxPrice)
    ) {
      setFormError(
        "Minimum price must be less than or equal to maximum price.",
      );
      return;
    }
    setFormError("");
    setSearch({ filters: { ...filters }, page: 1 });
  }

  function reset() {
    setFilters(initialFilters);
    setFormError("");
    setSearch({ filters: initialFilters, page: 1 });
  }

  function field(key: keyof typeof initialFilters) {
    return {
      value: filters[key],
      onChange: (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFilters((current) => ({ ...current, [key]: event.target.value }));
        setFormError("");
      },
    };
  }

  return (
    <main>
      <header className="heading">
        <div className="eyebrow">PROPERTY FINDER</div>
        <h1>A place that fits.</h1>
        <p>Explore local listings, ranked around your budget and what’s new.</p>
      </header>
      <div className="layout">
        <aside className="panel">
          <h2>Find your next home</h2>
          <p className="muted">Set a few preferences to narrow your search.</p>
          <form onSubmit={submit}>
            <label>
              City
              <input list="cities" placeholder="Any city" {...field("city")} />
              <datalist id="cities">
                {cities.map((city) => (
                  <option key={city} value={city} />
                ))}
              </datalist>
            </label>
            {cityError && <small>{cityError}</small>}
            <div className="pair">
              <label>
                Min price ($)
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="No minimum"
                  {...field("minPrice")}
                />
              </label>
              <label>
                Max price ($)
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="No maximum"
                  {...field("maxPrice")}
                />
              </label>
            </div>
            <label>
              Minimum bedrooms
              <input
                type="number"
                min="0"
                step="1"
                placeholder="Any"
                {...field("minBedrooms")}
              />
            </label>
            <label>
              Keyword
              <input
                placeholder="e.g. garage, yard, Metro"
                {...field("keyword")}
              />
            </label>
            <label>
              Target budget ($)
              <input
                type="number"
                min="0.01"
                step="any"
                placeholder="e.g. 500000"
                {...field("targetBudget")}
              />
            </label>
            <small>
              Helps rank results. Use maximum price for a firm limit.
            </small>
            <label>
              Results per page
              <select {...field("pageSize")}>
                <option>5</option>
                <option>10</option>
                <option>20</option>
              </select>
            </label>
            {formError && (
              <p role="alert" className="error">
                {formError}
              </p>
            )}
            <div className="actions">
              <button type="submit">Search listings</button>
              <button type="button" className="secondary" onClick={reset}>
                Reset
              </button>
            </div>
          </form>
        </aside>
        <section
          className="results"
          aria-label="Search results"
          aria-busy={loading}
        >
          <div className="results-heading">
            <h2>Available listings</h2>
            <span>Sorted by relevance</span>
          </div>
          {loading ? (
            <div className="empty" role="status">
              Loading listings…
            </div>
          ) : error ? (
            <div className="empty error" role="alert">
              <h3>We couldn’t load listings</h3>
              <p>{error}</p>
              <button onClick={() => setSearch({ ...search })}>
                Try again
              </button>
            </div>
          ) : (
            result && (
              <>
                <p className="muted" role="status">
                  {result.total} {result.total === 1 ? "match" : "matches"}
                  {result.total > 0 &&
                    ` · Page ${result.page} of ${result.totalPages}`}
                </p>
                {result.items.length === 0 ? (
                  <div className="empty">
                    <h3>No listings found</h3>
                    <p>Try a different city or broaden your price range.</p>
                    <button className="secondary" onClick={reset}>
                      Clear filters
                    </button>
                  </div>
                ) : (
                  <div className="cards">
                    {result.items.map((listing) => (
                      <article
                        className="card"
                        key={`${listing.source}:${listing.id}`}
                      >
                        <div className="card-top">
                          <span className="status">{listing.status}</span>
                          <span
                            className="score"
                            title="Budget fit and recency, out of 100"
                          >
                            {listing.relevanceScore.toFixed(1)}{" "}
                            <span>relevance</span>
                          </span>
                        </div>
                        <div className="price">
                          {money.format(listing.price)}
                        </div>
                        <h3>{listing.address}</h3>
                        <p className="location">
                          {listing.city}, {listing.state} {listing.zip}
                        </p>
                        <div className="facts">
                          <span>
                            <strong>{listing.bedrooms}</strong> beds
                          </span>
                          <span>
                            <strong>{listing.bathrooms}</strong> baths
                          </span>
                          <span>
                            <strong>{listing.sqft.toLocaleString()}</strong>{" "}
                            sqft
                          </span>
                        </div>
                        <p className="description">{listing.description}</p>
                        <footer>
                          {listing.source} · Listed {listing.listedDate}
                        </footer>
                      </article>
                    ))}
                  </div>
                )}
                {result.totalPages > 0 && (
                  <nav className="pagination" aria-label="Results pages">
                    <button
                      className="secondary"
                      disabled={result.page <= 1}
                      onClick={() =>
                        setSearch({ ...search, page: search.page - 1 })
                      }
                    >
                      ← Previous
                    </button>
                    <span>
                      Page {result.page} of {result.totalPages}
                    </span>
                    <button
                      className="secondary"
                      disabled={result.page >= result.totalPages}
                      onClick={() =>
                        setSearch({ ...search, page: search.page + 1 })
                      }
                    >
                      Next →
                    </button>
                  </nav>
                )}
              </>
            )
          )}
        </section>
      </div>
      <footer className="page-footer">
        Sample MLS listings · Relevance balances price fit and recency. Without
        a budget, newest listings rank first.
      </footer>
    </main>
  );
}
