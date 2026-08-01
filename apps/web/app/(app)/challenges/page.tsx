"use client";

import { useEffect, useState, useCallback } from "react";
import { communityApi } from "../../../lib/community-api";
import type { Challenge, Skill } from "../../../types/community";

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: "bg-emerald-100 text-emerald-700",
  medium: "bg-amber-100 text-amber-700",
  hard: "bg-rose-100 text-rose-700",
  expert: "bg-purple-100 text-purple-700",
};

export default function ChallengesPage() {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [recommended, setRecommended] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [skillFilter, setSkillFilter] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState("");
  const [sort, setSort] = useState("newest");
  const [showGenerator, setShowGenerator] = useState(false);
  const [genTopic, setGenTopic] = useState("");
  const [genLoading, setGenLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (skillFilter) params.skill = skillFilter;
      if (difficultyFilter) params.difficulty = difficultyFilter;
      params.sort = sort;
      const data = await communityApi.listChallenges(params);
      setChallenges(data.challenges || []);
    } catch {
      setChallenges([]);
    } finally {
      setLoading(false);
    }
  }, [skillFilter, difficultyFilter, sort]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    communityApi.getSkills().then((d) => setSkills(d.skills || [])).catch(() => {});
    communityApi.getRecommended(5).then((d) => setRecommended(d.challenges || [])).catch(() => {});
  }, []);

  const handleGenerate = async () => {
    if (!genTopic.trim()) return;
    setGenLoading(true);
    try {
      await communityApi.generateChallenge({ topic: genTopic, difficulty: difficultyFilter || "medium", type: "theory" });
      setGenTopic("");
      setShowGenerator(false);
      await load();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setGenLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Challenges Arena</h1>
          <p className="text-gray-500">Luyện tập kỹ năng công nghệ qua các thử thách thực chiến.</p>
        </div>
        <button
          onClick={() => setShowGenerator(!showGenerator)}
          className="mt-4 md:mt-0 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 text-sm font-medium"
        >
          ✨ Tạo Challenge bằng AI
        </button>
      </div>

      {showGenerator && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-6 mb-8">
          <h3 className="font-semibold mb-3">AI Challenge Generator</h3>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              value={genTopic}
              onChange={(e) => setGenTopic(e.target.value)}
              placeholder="VD: Kubernetes Networking Debug, AWS Architecture Scenario..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              onClick={handleGenerate}
              disabled={genLoading || !genTopic.trim()}
              className="bg-indigo-600 text-white px-6 py-2 rounded-lg disabled:opacity-50"
            >
              {genLoading ? "Đang tạo..." : "Generate"}
            </button>
          </div>
        </div>
      )}

      {recommended.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-3">🎯 Đề xuất cho bạn</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {recommended.map((c) => (
              <a
                key={c._id}
                href={`/challenges/${c._id}`}
                className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs ${DIFFICULTY_COLORS[c.difficulty] || "bg-gray-100"}`}>
                    {c.difficulty}
                  </span>
                  <span className="text-xs text-gray-400">{c.stats?.attempts || 0} lượt làm</span>
                </div>
                <h3 className="font-medium text-sm line-clamp-2">{c.title}</h3>
                <p className="text-xs text-gray-500 mt-1 line-clamp-2">{c.description}</p>
                <div className="mt-2 text-xs text-indigo-600">{c.skills_raw?.slice(0, 2).join(" · ") || "Technology"}</div>
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm p-4 mb-6 flex flex-col sm:flex-row gap-3">
        <select value={skillFilter} onChange={(e) => setSkillFilter(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm">
          <option value="">Tất cả kỹ năng</option>
          {skills.map((s) => (
            <option key={s.skill_id} value={s.slug}>{s.name}</option>
          ))}
        </select>
        <select value={difficultyFilter} onChange={(e) => setDifficultyFilter(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm">
          <option value="">Tất cả độ khó</option>
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
          <option value="expert">Expert</option>
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm">
          <option value="newest">Mới nhất</option>
          <option value="popular">Phổ biến nhất</option>
          <option value="quality">Chất lượng cao</option>
          <option value="rating">Đánh giá cao</option>
        </select>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-500">Đang tải challenges...</div>
      ) : challenges.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          Chưa có challenge nào. Hãy tạo challenge đầu tiên bằng AI!
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {challenges.map((c) => (
            <a
              key={c._id}
              href={`/challenges/${c._id}`}
              className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`px-2 py-0.5 rounded-full text-xs ${DIFFICULTY_COLORS[c.difficulty] || "bg-gray-100"}`}>
                  {c.difficulty}
                </span>
                <div className="flex gap-2 text-xs text-gray-400">
                  <span>⭐ {c.quality_score?.toFixed(1) || "0.0"}</span>
                  <span>{c.stats?.completion_rate ? `${Math.round(c.stats.completion_rate * 100)}%` : "0%"}</span>
                </div>
              </div>
              <h3 className="font-medium text-sm line-clamp-2">{c.title}</h3>
              <p className="text-xs text-gray-500 mt-1 line-clamp-2">{c.description}</p>
              <div className="flex items-center justify-between mt-3">
                <div className="flex gap-1">
                  {c.skills_raw?.slice(0, 2).map((s, i) => (
                    <span key={i} className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-full text-xs">{s}</span>
                  ))}
                </div>
                <span className="text-xs text-gray-400">{c.source === "ai" ? "🤖 AI" : "👤 User"}</span>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}