"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { communityApi } from "../../../../lib/community-api";
import { useAuth } from "../../../../lib/auth-context";
import type { Challenge, MentorAnalysis, ChallengeAttempt } from "../../../../types/community";

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: "bg-emerald-100 text-emerald-700",
  medium: "bg-amber-100 text-amber-700",
  hard: "bg-rose-100 text-rose-700",
  expert: "bg-purple-100 text-purple-700",
};

export default function ChallengeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [textAnswer, setTextAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [analysis, setAnalysis] = useState<MentorAnalysis | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [bookmarkLoading, setBookmarkLoading] = useState(false);
  const [attempts, setAttempts] = useState<ChallengeAttempt[]>([]);
  const [rating, setRating] = useState(0);
  const [ratingLoading, setRatingLoading] = useState(false);
  const [isCreator, setIsCreator] = useState(false);
  const [isPublished, setIsPublished] = useState(true);

  const loadAttempts = () => {
    communityApi.getAttempts(id).then((d) => {
      setAttempts(d.attempts || []);
    }).catch(() => {});
  };

  useEffect(() => {
    communityApi.getChallenge(id).then((d) => {
      setChallenge(d.challenge);
      setIsPublished(d.challenge.status === "published");
      setLoading(false);
    }).catch(() => setLoading(false));

    communityApi.getBookmarked(100)
      .then((d) => {
        const ids = new Set((d.challenges || []).map((c) => c._id));
        setBookmarked(ids.has(id));
      })
      .catch(() => {});
    loadAttempts();
  }, [id]);

  useEffect(() => {
    if (challenge && user) {
      setIsCreator(challenge.creator_id === user?.id);
    }
  }, [challenge, user]);

  const handleSubmit = async () => {
    setSubmitting(true);
    const isMcq = challenge?.type === "theory";
    const answer = isMcq ? selectedAnswer : textAnswer;
    try {
      const res = await communityApi.submitChallenge(id, answer);
      setResult(res);
      if (!res.is_correct) {
        setAnalysisLoading(true);
        communityApi.getMentorAnalysis(res.attempt_id).then((a) => {
          setAnalysis(a);
          setAnalysisLoading(false);
        }).catch(() => setAnalysisLoading(false));
      }
      loadAttempts();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleBookmark = async () => {
    if (bookmarkLoading) return;
    setBookmarkLoading(true);
    try {
      if (bookmarked) {
        await communityApi.unbookmark(id);
        setBookmarked(false);
      } else {
        await communityApi.bookmark(id);
        setBookmarked(true);
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setBookmarkLoading(false);
    }
  };

  const handleRate = async (value: number) => {
    if (ratingLoading) return;
    setRatingLoading(true);
    try {
      const res = await communityApi.rate(id, value);
      setRating(value);
      setChallenge((prev) => prev ? { ...prev, stats: { ...prev.stats, avg_rating: res.avg_rating } } : prev);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setRatingLoading(false);
    }
  };

  const handlePublish = async () => {
    try {
      const res = await communityApi.publishChallenge(id);
      setIsPublished(res.status === "published");
      setChallenge((prev) => prev ? { ...prev, status: res.status } : prev);
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Bạn có chắc muốn xóa challenge này?")) return;
    try {
      await communityApi.deleteChallenge(id);
      window.location.href = "/challenges";
    } catch (e: any) {
      alert(e.message);
    }
  };

  if (loading) return <div className="container mx-auto px-4 py-16 text-center text-gray-500">Đang tải...</div>;
  if (!challenge) return <div className="container mx-auto px-4 py-16 text-center text-gray-500">Không tìm thấy challenge.</div>;

  const isMcq = challenge.type === "theory";
  const bestAttempt = attempts.find((a) => a.is_correct);

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <a href="/challenges" className="text-sm text-indigo-600 hover:underline mb-4 inline-block">← Quay lại Challenges</a>

      <div className="bg-white rounded-2xl shadow-sm p-6 md:p-8">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className={`px-3 py-1 rounded-full text-sm ${DIFFICULTY_COLORS[challenge.difficulty] || "bg-gray-100"}`}>
            {challenge.difficulty}
          </span>
          <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm">{challenge.type}</span>
          <span className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-sm">⭐ {challenge.quality_score?.toFixed(1)}</span>
          <button
            onClick={toggleBookmark}
            disabled={bookmarkLoading}
            className={`px-3 py-1 rounded-full text-sm border transition-colors ${
              bookmarked ? "bg-yellow-50 text-yellow-600 border-yellow-300" : "bg-gray-50 text-gray-500 border-gray-200 hover:border-yellow-300"
            }`}
          >
            {bookmarked ? "★ Đã lưu" : "☆ Lưu"}
          </button>
          {challenge.status === "draft" && (
            <span className="px-3 py-1 bg-orange-100 text-orange-600 rounded-full text-sm">Draft</span>
          )}
          <span className="ml-auto text-sm text-gray-400">
            {challenge.stats?.attempts || 0} lượt làm · {challenge.stats?.completion_rate ? `${Math.round(challenge.stats.completion_rate * 100)}%` : "0%"} hoàn thành
          </span>
        </div>

        <h1 className="text-2xl md:text-3xl font-bold mb-3">{challenge.title}</h1>
        <p className="text-gray-500 mb-6">{challenge.description}</p>

        <div className="mb-6">
          {challenge.skills_raw?.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {challenge.skills_raw.map((s, i) => (
                <span key={i} className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-sm">{s}</span>
              ))}
            </div>
          )}
          <div className="bg-gray-50 rounded-xl p-5 font-mono text-sm leading-relaxed whitespace-pre-wrap">
            {challenge.content?.question}
          </div>
        </div>

        {!result && (
          <div className="mb-6">
            {isMcq ? (
              <div className="space-y-3">
                {(challenge.content?.options || []).map((opt, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedAnswer(i)}
                    className={`w-full text-left px-4 py-3 rounded-xl border transition-colors ${
                      selectedAnswer === i
                        ? "border-indigo-500 bg-indigo-50"
                        : "border-gray-200 hover:border-indigo-300"
                    }`}
                  >
                    <span className="font-medium mr-2">{String.fromCharCode(65 + i)}.</span>
                    {opt}
                  </button>
                ))}
              </div>
            ) : (
              <textarea
                value={textAnswer}
                onChange={(e) => setTextAnswer(e.target.value)}
                placeholder="Nhập câu trả lời / lệnh / giải pháp của bạn..."
                className="w-full px-4 py-3 border border-gray-300 rounded-xl min-h-[120px] focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            )}
            <button
              onClick={handleSubmit}
              disabled={submitting || (isMcq ? selectedAnswer === null : !textAnswer.trim())}
              className="mt-4 bg-indigo-600 text-white px-8 py-3 rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50"
            >
              {submitting ? "Đang chấm điểm..." : "Nộp bài"}
            </button>
          </div>
        )}

        {result && (
          <div>
            <div className={`rounded-xl p-5 ${result.is_correct ? "bg-emerald-50 border border-emerald-200" : "bg-rose-50 border border-rose-200"}`}>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">{result.is_correct ? "✅" : "❌"}</span>
                <h3 className="font-semibold text-lg">{result.is_correct ? "Chính xác! Giỏi lắm!" : "Chưa chính xác"}</h3>
              </div>
              <p className="text-sm text-gray-700">{result.explanation}</p>
              {result.skill_updates?.length > 0 && (
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {result.skill_updates.map((u: any, i: number) => (
                    <div key={i} className="bg-white rounded-lg p-3 text-sm">
                      <span className="font-medium">{u.name || u.skill_id}</span>
                      <div className="flex items-center gap-2 mt-1">
                        <span>{u.mastery_before}%</span>
                        <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                          <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${u.mastery_after}%` }} />
                        </div>
                        <span className="font-semibold">{u.mastery_after}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {!result.is_correct && (
              <div className="mt-6 bg-purple-50 border border-purple-200 rounded-xl p-5">
                <h4 className="font-semibold mb-3">🤖 AI Mentor — Phân tích lỗi sai</h4>
                {analysisLoading ? (
                  <p className="text-sm text-purple-600">AI đang phân tích bài làm của bạn...</p>
                ) : analysis ? (
                  <div className="space-y-4 text-sm">
                    {analysis.reason && (
                      <div>
                        <p className="font-medium mb-1">Vì sao sai:</p>
                        <p className="text-gray-600">{analysis.reason}</p>
                      </div>
                    )}
                    {analysis.missing_knowledge?.length > 0 && (
                      <div>
                        <p className="font-medium mb-1">Bạn đang thiếu kiến thức:</p>
                        <div className="flex flex-wrap gap-2">
                          {analysis.missing_knowledge.map((k, i) => (
                            <span key={i} className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full">{k}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {analysis.weak_concepts?.length > 0 && (
                      <div>
                        <p className="font-medium mb-1">Kỹ năng cần cải thiện:</p>
                        {analysis.weak_concepts.map((w: any, i: number) => (
                          <div key={i} className="flex items-center gap-2 mb-1">
                            <span className="w-40">{w.name}</span>
                            <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                              <div className="bg-purple-500 h-1.5 rounded-full" style={{ width: `${w.mastery_score}%` }} />
                            </div>
                            <span className="text-xs w-10">{w.mastery_score}%</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {analysis.recommendations?.length > 0 && (
                      <div>
                        <p className="font-medium mb-2">Đề xuất luyện tập tiếp theo:</p>
                        <div className="space-y-2">
                          {analysis.recommendations.map((r: any, i: number) => (
                            <a key={i} href={`/challenges/${r.challenge_id}`} className="block bg-white rounded-lg p-3 hover:shadow transition-shadow">
                              <div className="flex items-center justify-between">
                                <span className="font-medium">{r.title}</span>
                                <span className="text-xs px-2 py-0.5 bg-gray-100 rounded-full">{r.difficulty}</span>
                              </div>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-purple-600">Đã có phân tích cơ bản từ hệ thống. Xem đề xuất bên dưới.</p>
                )}
              </div>
            )}

            <div className="mt-6 flex gap-3">
              <button onClick={() => window.location.reload()} className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Làm lại</button>
              <a href="/challenges" className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">Xem challenges khác</a>
            </div>
          </div>
        )}

        {/* Rating */}
        {challenge.stats && (
          <div className="mt-8 border-t border-gray-100 pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Đánh giá challenge</p>
                <p className="text-xs text-gray-400">⭐ {challenge.stats.avg_rating?.toFixed(1) || "0.0"} / 5</p>
              </div>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((v) => (
                  <button
                    key={v}
                    onClick={() => handleRate(v)}
                    disabled={ratingLoading}
                    className={`text-2xl transition-colors ${rating >= v ? "text-yellow-400" : "text-gray-300 hover:text-yellow-400"}`}
                    aria-label={`Đánh giá ${v} sao`}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Creator actions */}
        {isCreator && (
          <div className="mt-8 border-t border-gray-100 pt-6 flex gap-3">
            {!isPublished ? (
              <button onClick={handlePublish} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700">
                📢 Publish challenge
              </button>
            ) : (
              <span className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-lg text-sm">✓ Đã publish</span>
            )}
            <button onClick={handleDelete} className="px-4 py-2 bg-rose-50 text-rose-600 rounded-lg text-sm hover:bg-rose-100">
              🗑 Xóa challenge
            </button>
          </div>
        )}

        {/* Attempts history */}
        {attempts.length > 0 && (
          <div className="mt-8 border-t border-gray-100 pt-6">
            <h3 className="font-semibold text-sm mb-3">
              📊 Lịch sử làm bài của bạn {bestAttempt && <span className="text-emerald-600 text-xs">· Best: ✅ {Math.round(bestAttempt.score * 100)}%</span>}
            </h3>
            <div className="space-y-2">
              {attempts.map((a) => (
                <div key={a._id} className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-2 text-sm">
                  <div className="flex items-center gap-3">
                    <span>{a.is_correct ? "✅" : "❌"}</span>
                    <span className="font-medium">{Math.round(a.score * 100)}%</span>
                    {a.time_seconds !== null && a.time_seconds !== undefined && (
                      <span className="text-xs text-gray-400">⏱ {a.time_seconds}s</span>
                    )}
                  </div>
                  <span className="text-xs text-gray-400">
                    {new Date(a.created_at).toLocaleString("vi-VN")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}