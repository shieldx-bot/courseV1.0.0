"use client";

import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowUp, ArrowDown, MessageSquare, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import type { Discussion, Reply } from "@/types";

interface DiscussionTabProps {
  courseId: string;
  lessonId: string;
  courseSlug: string;
}

function getInitials(name: string) {
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
}

function Avatar({ name, size = 8 }: { name: string; size?: number }) {
  return (
    <div className={cn("rounded-full bg-accent-100 flex items-center justify-center font-medium text-accent-700", `h-${size} w-${size} text-xs`)}>
      {getInitials(name)}
    </div>
  );
}

export function DiscussionTab({ courseId, lessonId, courseSlug }: DiscussionTabProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newDiscussionTitle, setNewDiscussionTitle] = useState("");
  const [newDiscussionContent, setNewDiscussionContent] = useState("");
  const [expandedDiscussion, setExpandedDiscussion] = useState<string | null>(null);
  const [replies, setReplies] = useState<Record<string, Reply[]>>({});
  const [replyContent, setReplyContent] = useState<Record<string, string>>({});
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const loadDiscussions = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiClient.discussions.list(courseId, lessonId, { page, per_page: 20, sort: "newest" });
      if (page === 1) {
        setDiscussions(data.items);
      } else {
        setDiscussions(prev => [...prev, ...data.items]);
      }
      setHasMore(page < data.total_pages);
    } catch (e) {
      toast("Failed to load discussions", "error");
    } finally {
      setLoading(false);
    }
  }, [courseId, lessonId, page, toast]);

  useEffect(() => {
    loadDiscussions();
  }, [loadDiscussions]);

  const handleCreateDiscussion = async () => {
    if (!newDiscussionTitle.trim() || !newDiscussionContent.trim()) return;
    setCreating(true);
    try {
      const discussion = await apiClient.discussions.create(courseId, lessonId, {
        lesson_id: lessonId,
        title: newDiscussionTitle,
        content: newDiscussionContent,
      });
      setDiscussions(prev => [discussion, ...prev]);
      setNewDiscussionTitle("");
      setNewDiscussionContent("");
      toast("Discussion created", "success");
    } catch (e) {
      toast("Failed to create discussion", "error");
    } finally {
      setCreating(false);
    }
  };

  const handleVote = async (discussionId: string, currentVote: number, vote: number) => {
    try {
      const updated = await apiClient.discussions.vote(courseId, lessonId, discussionId, vote);
      setDiscussions(prev => prev.map(d => d.id === discussionId ? updated : d));
    } catch (e) {
      toast("Failed to vote", "error");
    }
  };

  const loadReplies = async (discussionId: string) => {
    try {
      const data = await apiClient.discussions.listReplies(courseId, lessonId, discussionId);
      setReplies(prev => ({ ...prev, [discussionId]: data.items }));
    } catch (e) {
      toast("Failed to load replies", "error");
    }
  };

  const handleExpand = async (discussionId: string) => {
    if (expandedDiscussion === discussionId) {
      setExpandedDiscussion(null);
      return;
    }
    setExpandedDiscussion(discussionId);
    if (!replies[discussionId]) {
      await loadReplies(discussionId);
    }
  };

  const handleCreateReply = async (discussionId: string, parentReplyId?: string) => {
    const content = replyContent[discussionId] || "";
    if (!content.trim()) return;
    try {
      const reply = await apiClient.discussions.createReply(courseId, lessonId, discussionId, {
        content,
        parent_reply_id: parentReplyId,
      });
      setReplies(prev => ({
        ...prev,
        [discussionId]: [...(prev[discussionId] || []), reply],
      }));
      setDiscussions(prev => prev.map(d =>
        d.id === discussionId ? { ...d, reply_count: d.reply_count + 1 } : d
      ));
      setReplyContent(prev => ({ ...prev, [discussionId]: "" }));
      setReplyingTo(null);
      toast("Reply posted", "success");
    } catch (e) {
      toast("Failed to post reply", "error");
    }
  };

  const handleReplyVote = async (discussionId: string, replyId: string, currentVote: number, vote: number) => {
    try {
      const updated = await apiClient.discussions.voteReply(courseId, lessonId, discussionId, replyId, vote);
      setReplies(prev => ({
        ...prev,
        [discussionId]: prev[discussionId]?.map(r => r.id === replyId ? updated : r) || [],
      }));
    } catch (e) {
      toast("Failed to vote", "error");
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getInitials = (name: string) => name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);

  return (
    <div className="space-y-6">
      {user && (
        <Card className="p-5">
          <h3 className="font-semibold text-primary-900 mb-4">Start a Discussion</h3>
          <div className="space-y-3">
            <input
              type="text"
              value={newDiscussionTitle}
              onChange={e => setNewDiscussionTitle(e.target.value)}
              placeholder="Title (e.g., Question about JOIN types)"
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500"
              maxLength={200}
            />
            <Textarea
              value={newDiscussionContent}
              onChange={e => setNewDiscussionContent(e.target.value)}
              placeholder="Describe your question or share your thoughts..."
              className="min-h-[100px]"
              maxLength={10000}
            />
            <Button onClick={handleCreateDiscussion} disabled={creating || !newDiscussionTitle.trim() || !newDiscussionContent.trim()}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Post Discussion"}
            </Button>
          </div>
        </Card>
      )}

      {!user && (
        <Card className="p-5 text-center text-neutral-600">
          <MessageSquare className="h-10 w-10 mx-auto text-neutral-300 mb-3" />
          <p>Sign in to participate in discussions</p>
        </Card>
      )}

      <div className="space-y-4">
        {loading && discussions.length === 0 ? (
          <div className="py-8 text-center text-neutral-500">Loading discussions...</div>
        ) : discussions.length === 0 ? (
          <Card className="p-8 text-center text-neutral-600">
            <MessageSquare className="h-12 w-12 mx-auto text-neutral-300 mb-3" />
            <p className="text-lg font-medium">No discussions yet</p>
            <p className="text-sm mt-1">Be the first to ask a question or share an insight!</p>
          </Card>
        ) : (
          discussions.map(discussion => (
            <DiscussionItem
              key={discussion.id}
              discussion={discussion}
              expanded={expandedDiscussion === discussion.id}
              onExpand={() => handleExpand(discussion.id)}
              onVote={vote => handleVote(discussion.id, discussion.user_vote, vote)}
              replies={replies[discussion.id] || []}
              replyContent={replyContent[discussion.id] || ""}
              onReplyContentChange={content => setReplyContent(prev => ({ ...prev, [discussion.id]: content }))}
              replyingTo={replyingTo}
              onReplyingToChange={id => setReplyingTo(id === replyingTo ? null : id)}
              onCreateReply={parentId => handleCreateReply(discussion.id, parentId)}
              onReplyVote={(replyId, currentVote, vote) => handleReplyVote(discussion.id, replyId, currentVote, vote)}
              formatDate={formatDate}
              getInitials={getInitials}
              user={user}
            />
          ))
        )}

        {hasMore && (
          <div className="text-center">
            <Button variant="outline" onClick={() => setPage(p => p + 1)}>
              Load more
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

interface DiscussionItemProps {
  discussion: Discussion;
  expanded: boolean;
  onExpand: () => void;
  onVote: (vote: number) => void;
  replies: Reply[];
  replyContent: string;
  onReplyContentChange: (content: string) => void;
  replyingTo: string | null;
  onReplyingToChange: (id: string | null) => void;
  onCreateReply: (parentId?: string) => void;
  onReplyVote: (replyId: string, currentVote: number, vote: number) => void;
  formatDate: (dateStr: string) => string;
  getInitials: (name: string) => string;
  user: any;
}

function DiscussionItem({
  discussion,
  expanded,
  onExpand,
  onVote,
  replies,
  replyContent,
  onReplyContentChange,
  replyingTo,
  onReplyingToChange,
  onCreateReply,
  onReplyVote,
  formatDate,
  getInitials,
  user,
}: DiscussionItemProps) {
  const [showReplies, setShowReplies] = useState(expanded);

  useEffect(() => {
    setShowReplies(expanded);
  }, [expanded]);

  const renderReplies = (repliesToRender: Reply[], depth = 0) => (
    <div className={cn("space-y-3 ml-4", depth > 0 && "border-l-2 border-neutral-200 pl-4")}>
      {repliesToRender.map(reply => (
        <ReplyItem
          key={reply.id}
          reply={reply}
          depth={depth}
          onVote={vote => onReplyVote(reply.id, reply.user_vote, vote)}
          onReplyClick={() => onReplyingToChange(reply.id)}
          onCreateReply={onCreateReply}
          replyContent={replyContent}
          onReplyContentChange={onReplyContentChange}
          replyingTo={replyingTo}
          formatDate={formatDate}
          getInitials={getInitials}
          user={user}
          renderReplies={renderReplies}
        />
      ))}
    </div>
  );

  return (
    <Card className={cn("transition-all", expanded && "ring-2 ring-accent-500")}>
      <div className="p-5">
        <div className="flex gap-4">
          <div className="flex flex-col items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className={cn("h-8 w-8 p-0", discussion.user_vote === 1 && "text-accent-600")}
              onClick={() => onVote(discussion.user_vote === 1 ? 0 : 1)}
              disabled={!user}
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
            <span className={cn("font-medium", discussion.vote_score > 0 && "text-accent-600", discussion.vote_score < 0 && "text-error")}>
              {discussion.vote_score}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className={cn("h-8 w-8 p-0", discussion.user_vote === -1 && "text-error")}
              onClick={() => onVote(discussion.user_vote === -1 ? 0 : -1)}
              disabled={!user}
            >
              <ArrowDown className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${discussion.user_name}`} alt={discussion.user_name} />
                  <AvatarFallback>{getInitials(discussion.user_name)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-primary-900">{discussion.user_name}</p>
                  <p className="text-xs text-neutral-500">{formatDate(discussion.created_at)}</p>
                </div>
                {discussion.user_role === "instructor" && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-primary-100 text-primary-700">Instructor</span>
                )}
                {discussion.user_role === "admin" && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-700">Admin</span>
                )}
              </div>
              {discussion.is_pinned && <span className="text-xs text-amber-600">📌 Pinned</span>}
            </div>
            <h4 className="mt-2 text-lg font-semibold text-primary-900">{discussion.title}</h4>
            <p className="mt-2 text-neutral-700 whitespace-pre-wrap">{discussion.content}</p>
            <div className="mt-4 flex items-center gap-4 text-sm text-neutral-500">
              <span>{discussion.reply_count} {discussion.reply_count === 1 ? "reply" : "replies"}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={onExpand}
                className="h-8 px-3 text-neutral-600 hover:text-primary-700"
              >
                {showReplies ? "Hide replies" : "Show replies"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {showReplies && (
        <div className="border-t px-5 py-4 bg-neutral-50">
          {replies.length === 0 ? (
            <p className="text-center text-neutral-500 py-4">No replies yet. Be the first to respond!</p>
          ) : (
            renderReplies(replies)
          )}
          {user && !replyingTo && (
            <div className="mt-4 pt-4 border-t">
              <Textarea
                value={replyContent}
                onChange={e => onReplyContentChange(e.target.value)}
                placeholder="Write a reply..."
                className="min-h-[80px]"
                maxLength={5000}
              />
              <Button className="mt-2" onClick={() => onCreateReply()}>Post Reply</Button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

interface ReplyItemProps {
  reply: Reply;
  depth: number;
  onVote: (vote: number) => void;
  onReplyClick: () => void;
  onCreateReply: (parentId?: string) => void;
  replyContent: string;
  onReplyContentChange: (content: string) => void;
  replyingTo: string | null;
  formatDate: (dateStr: string) => string;
  getInitials: (name: string) => string;
  user: any;
  renderReplies: (replies: Reply[], depth: number) => React.ReactNode;
}

function ReplyItem({
  reply,
  depth,
  onVote,
  onReplyClick,
  onCreateReply,
  replyContent,
  onReplyContentChange,
  replyingTo,
  formatDate,
  getInitials,
  user,
  renderReplies,
}: ReplyItemProps) {
  const [showNested, setShowNested] = useState(true);

  const children = []; // Would need to fetch nested replies

  return (
    <div className="py-3">
      <div className="flex gap-3">
        <div className="flex flex-col items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className={cn("h-7 w-7 p-0", reply.user_vote === 1 && "text-accent-600")}
            onClick={() => onVote(reply.user_vote === 1 ? 0 : 1)}
            disabled={!user}
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </Button>
          <span className={cn("font-medium text-sm", reply.vote_score > 0 && "text-accent-600")}>
            {reply.vote_score}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className={cn("h-7 w-7 p-0", reply.user_vote === -1 && "text-error")}
            onClick={() => onVote(reply.user_vote === -1 ? 0 : -1)}
            disabled={!user}
          >
            <ArrowDown className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Avatar className="h-7 w-7">
                <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${reply.user_name}`} alt={reply.user_name} />
                <AvatarFallback>{getInitials(reply.user_name)}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium text-sm text-primary-900">{reply.user_name}</p>
                <p className="text-xs text-neutral-500">{formatDate(reply.created_at)}</p>
              </div>
              {reply.is_instructor_answer && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">✓ Accepted Answer</span>
              )}
              {reply.user_role === "instructor" && !reply.is_instructor_answer && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-primary-100 text-primary-700">Instructor</span>
              )}
            </div>
            <Button variant="ghost" size="icon" onClick={onReplyClick} className="text-neutral-500 hover:text-primary-700">
              Reply
            </Button>
          </div>
          <p className="mt-1 text-neutral-700 whitespace-pre-wrap text-sm">{reply.content}</p>

          {replyingTo === reply.id && user && (
            <div className="mt-3">
              <Textarea
                value={replyContent}
                onChange={e => onReplyContentChange(e.target.value)}
                placeholder="Write a reply..."
                className="min-h-[60px]"
                maxLength={5000}
              />
              <div className="mt-2 flex gap-2">
                <Button size="sm" onClick={() => onCreateReply(reply.id)}>Post</Button>
                <Button size="sm" variant="ghost" onClick={() => onReplyingToChange(null)}>Cancel</Button>
              </div>
            </div>
          )}

          {children.length > 0 && (
            <div className="mt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowNested(!showNested)}
                className="text-neutral-500 hover:text-primary-700"
              >
                {showNested ? "Hide" : "Show"} {children.length} {children.length === 1 ? "reply" : "replies"}
              </Button>
              {showNested && renderReplies(children, depth + 1)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}