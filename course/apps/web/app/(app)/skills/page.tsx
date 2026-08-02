"use client";

import { useEffect, useState } from "react";
import { communityApi } from "../../../lib/community-api";
import type { Skill } from "../../../types/community";

const LEVEL_COLORS: Record<string, string> = {
  beginner: "bg-emerald-100 text-emerald-700",
  intermediate: "bg-amber-100 text-amber-700",
  advanced: "bg-rose-100 text-rose-700",
  expert: "bg-purple-100 text-purple-700",
};

export default function SkillsPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [weak, setWeak] = useState<Skill[]>([]);
  const [strong, setStrong] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Skill | null>(null);
  const [skillChallenges, setSkillChallenges] = useState<any[]>([]);

  useEffect(() => {
    communityApi.getMySkills().then((d) => {
      setSkills(d.skills || []);
      setWeak(d.weak_skills || []);
      setStrong(d.strong_skills || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const selectSkill = async (s: Skill) => {
    setSelected(s);
    const d = await communityApi.getSkillChallenges(s.skill_id, 5).catch(() => null);
    setSkillChallenges(d?.challenges || []);
  };

  const getCategoryColor = (cat: string) => {
    const colors: Record<string, string> = {
      Linux: "bg-red-50 text-red-700",
      Docker: "bg-blue-50 text-blue-700",
      Kubernetes: "bg-sky-50 text-sky-700",
      AWS: "bg-orange-50 text-orange-700",
      Security: "bg-green-50 text-green-700",
      DevOps: "bg-cyan-50 text-cyan-700",
      Programming: "bg-violet-50 text-violet-700",
      Networking: "bg-teal-50 text-teal-700",
    };
    return colors[cat] || "bg-gray-50 text-gray-700";
  };

  if (loading) return <div className="container mx-auto px-4 py-16 text-center text-gray-500">Đang tải skill graph...</div>;

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Kỹ Năng Của Tôi</h1>
        <p className="text-gray-500">Bản đồ kỹ năng được cập nhật tự động dựa trên kết quả learning & challenges.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {skills.map((s) => (
              <button
                key={s.skill_id}
                onClick={() => selectSkill(s)}
                className={`text-left bg-white border rounded-xl p-4 hover:shadow-md transition-shadow ${selected?.skill_id === s.skill_id ? "border-indigo-500 ring-2 ring-indigo-200" : "border-gray-200"}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${getCategoryColor(s.category)}`}>{s.category}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs ${LEVEL_COLORS[s.level] || "bg-gray-100"}`}>{s.level}</span>
                  </div>
                </div>
                <h3 className="font-bold text-lg">{s.name}</h3>
                <p className="text-xs text-gray-500 mb-2">{s.attempts} lượt · {s.correct_count} đúng · {s.consistency_score}% consistency</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-200 rounded-full h-2.5">
                    <div
                      className={`h-2.5 rounded-full ${
                        s.mastery_score >= 80 ? "bg-emerald-500" : s.mastery_score >= 50 ? "bg-amber-500" : "bg-rose-500"
                      }`}
                      style={{ width: `${s.mastery_score}%` }}
                    />
                  </div>
                  <span className="font-semibold text-sm w-12 text-right">{s.mastery_score}%</span>
                </div>
              </button>
            ))}
          </div>

          {skills.length === 0 && (
            <div className="text-center py-16 bg-white rounded-xl text-gray-500">
              Chưa có dữ liệu kỹ năng. Hãy làm challenge đầu tiên để bắt đầu xây dựng skill graph!
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl p-5 border border-gray-200">
            <h3 className="font-semibold mb-3">⚠️ Kỹ năng yếu nhất</h3>
            {weak.length === 0 ? (
              <p className="text-sm text-gray-500">Không có. Bạn đang tiến bộ rất tốt!</p>
            ) : (
              <div className="space-y-3">
                {weak.map((s) => (
                  <button key={s.skill_id} onClick={() => selectSkill(s)} className="w-full text-left">
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="font-medium">{s.name}</span>
                      <span className="text-rose-600 font-semibold">{s.mastery_score}%</span>
                    </div>
                    <div className="bg-gray-200 rounded-full h-2">
                      <div className="bg-rose-500 h-2 rounded-full" style={{ width: `${s.mastery_score}%` }} />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl p-5 border border-gray-200">
            <h3 className="font-semibold mb-3">🏆 Kỹ năng mạnh nhất</h3>
            {strong.length === 0 ? (
              <p className="text-sm text-gray-500">Chưa có kỹ năng nổi bật.</p>
            ) : (
              <div className="space-y-3">
                {strong.map((s) => (
                  <button key={s.skill_id} onClick={() => selectSkill(s)} className="w-full text-left">
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="font-medium">{s.name}</span>
                      <span className="text-emerald-600 font-semibold">{s.mastery_score}%</span>
                    </div>
                    <div className="bg-gray-200 rounded-full h-2">
                      <div className="bg-emerald-500 h-2 rounded-full" style={{ width: `${s.mastery_score}%` }} />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {selected && (
        <div className="mt-8 bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-lg">🎯 Luyện tập: {selected.name}</h3>
            <button onClick={() => setSelected(null)} className="text-sm text-gray-400 hover:text-gray-600">Đóng ✕</button>
          </div>
          {skillChallenges.length === 0 ? (
            <p className="text-sm text-gray-500">Chưa có challenge phù hợp cho kỹ năng này.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {skillChallenges.map((c) => (
                <a key={c._id} href={`/challenges/${c._id}`} className="block bg-gray-50 rounded-lg p-4 hover:shadow transition-shadow">
                  <div className="flex items-center justify-between mb-1">
                    <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-full text-xs">{c.difficulty}</span>
                    <span className="text-xs text-gray-400">{c.stats?.attempts || 0} lượt</span>
                  </div>
                  <h4 className="font-medium text-sm">{c.title}</h4>
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}