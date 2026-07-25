"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface EnrollButtonProps {
  pathId: string;
  pathSlug: string;
  alreadyEnrolled?: boolean;
  onEnrolled?: () => void;
}

export function EnrollButton({ pathId, pathSlug, alreadyEnrolled, onEnrolled }: EnrollButtonProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleEnroll = async () => {
    setLoading(true);
    try {
      const result = await apiClient.learningPaths.enroll(pathId);
      if (result.enrolled) {
        toast.success(alreadyEnrolled ? "Already enrolled in this path" : "Successfully enrolled in this learning path!");
        onEnrolled?.();
        router.refresh();
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to enroll";
      if (message.includes("Session expired") || message.includes("401")) {
        toast.error("Please log in to enroll in learning paths");
      } else {
        toast.error(message);
      }
    } finally {
      setLoading(false);
    }
  };

  if (alreadyEnrolled) {
    return (
      <Button variant="secondary" onClick={() => router.push(`/learning-paths/${pathSlug}`)} className="w-full">
        View my progress
      </Button>
    );
  }

  return (
    <Button onClick={handleEnroll} disabled={loading} className="w-full" size="lg">
      {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Enroll in this path"}
    </Button>
  );
}