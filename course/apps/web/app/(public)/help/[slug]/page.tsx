"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

export default function HelpArticlePage() {
  const params = useParams();
  const slug = params.slug as string;
  const [article, setArticle] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState<"helpful" | "not_helpful" | null>(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/v1/help/articles/${encodeURIComponent(slug)}`);
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      setArticle(json.data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function submitFeedback(helpful: boolean) {
    if (!article) return;
    setFeedback(helpful ? "helpful" : "not_helpful");
    try {
      await fetch(`/api/v1/help/articles/${encodeURIComponent(article.id)}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ helpful }),
      });
      await load();
    } catch {
      setFeedback(null);
    }
  }

  useEffect(() => {
    if (slug) load();
  }, [slug]);

  if (loading) return <section className="mx-auto max-w-page px-6 py-12"><p className="text-neutral-600">Loading...</p></section>;
  if (error) return <section className="mx-auto max-w-page px-6 py-12"><p className="text-error">{error}</p></section>;
  if (!article) return <section className="mx-auto max-w-page px-6 py-12"><p className="text-neutral-600">Article not found</p></section>;

  return (
    <section className="mx-auto max-w-page px-6 py-12">
      <Link href="/help" className="text-sm text-primary-600 hover:underline">
        ← Back to Help Center
      </Link>
      <Card className="mt-4 p-8">
        <div className="flex items-center gap-2">
          <Badge variant="accent" className="capitalize">{article.category}</Badge>
          <span className="text-xs text-neutral-600">{article.views || 0} views</span>
        </div>
        <h1 className="mt-3 text-3xl font-semibold text-neutral-900">{article.title}</h1>
        <div className="mt-6 whitespace-pre-wrap text-neutral-800">{article.content}</div>
        <div className="mt-8 flex items-center gap-4 border-t border-neutral-200 pt-6">
          <p className="text-sm text-neutral-600">Was this helpful?</p>
          <Button
            variant={feedback === "helpful" ? "primary" : "outline"}
            onClick={() => submitFeedback(true)}
            disabled={!!feedback}
          >
            👍 Yes ({article.helpful_count})
          </Button>
          <Button
            variant={feedback === "not_helpful" ? "primary" : "outline"}
            onClick={() => submitFeedback(false)}
            disabled={!!feedback}
          >
            👎 No ({article.not_helpful_count})
          </Button>
        </div>
      </Card>
    </section>
  );
}
