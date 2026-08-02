"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function SearchBar() {
  const [query, setQuery] = useState("");
  const router = useRouter();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) router.push(`/courses?search=${encodeURIComponent(query)}`);
  };

  return (
    <section className="mx-auto max-w-page px-6 py-10">
      <form onSubmit={submit} className="mx-auto flex max-w-2xl gap-2">
        <Input
          aria-label="Search courses"
          placeholder="Try 'Excel', 'leadership', or 'Python'…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-12 flex-1"
        />
        <Button type="submit" className="h-12 px-6">
          Search
        </Button>
      </form>
    </section>
  );
}
