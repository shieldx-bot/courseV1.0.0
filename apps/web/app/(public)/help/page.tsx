"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

const CATEGORIES = ["billing", "technical", "content", "account", "general"];

export default function HelpCenterPage() {
  const [articles, setArticles] = useState<any[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function search() {
    setLoading(true);
    setError("");
    try {
      const q = new URLSearchParams();
      if (query) q.set("q", query);
      if (category) q.set("category", category);
      const res = await fetch(`/api/v1/help/articles/search?${q.toString()}`, {
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      setArticles(json.data || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadAll() {
    setLoading(true);
    setError("");
    try {
      const q = new URLSearchParams();
      if (category) q.set("category", category);
      const res = await fetch(`/api/v1/help/articles?${q.toString()}`, {
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      setArticles(json.data || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (query) {
      search();
    } else {
      loadAll();
    }
  }, [category]);

  return (
    <section className="mx-auto max-w-page px-6 py-12">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-3xl font-semibold text-neutral-900">Help Center</h1>
        <p className="mt-2 text-neutral-600">Search our knowledge base or browse by category.</p>
        <div className="mt-6 flex gap-3">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search articles..."
            className="flex-1"
            onKeyDown={(e) => {
              if (e.key === "Enter") search();
            }}
          />
          <Button onClick={search}>Search</Button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            variant={category === "" ? "primary" : "outline"}
            onClick={() => setCategory("")}
            className="capitalize"
          >
            All
          </Button>
          {CATEGORIES.map((c) => (
            <Button
              key={c}
              variant={category === c ? "primary" : "outline"}
              onClick={() => setCategory(c)}
              className="capitalize"
            >
              {c}
            </Button>
          ))}
        </div>
      </div>
      <div className="mx-auto mt-8 max-w-3xl">
        {error && <p className="mb-4 text-sm text-error">{error}</p>}
        {loading && <p className="text-neutral-600">Loading...</p>}
        {!loading && articles.length === 0 && <p className="text-neutral-600">No articles found.</p>}
        <div className="space-y-4">
          {articles.map((a) => (
            <Link key={a.id} href={`/help/${a.slug}`}>
              <Card className="p-5 transition hover:border-primary-300">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-neutral-900">{a.title}</p>
                    {a.summary && <p className="mt-1 text-sm text-neutral-600">{a.summary}</p>}
                  </div>
                  <Badge variant="accent" className="capitalize">{a.category}</Badge>
                </div>
                <div className="mt-3 flex items-center gap-4 text-xs text-neutral-600">
                  <span>{a.views || 0} views</span>
                  <span>👍 {a.helpful_count}</span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
