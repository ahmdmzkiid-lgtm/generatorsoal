import { useEffect, useRef, useState, useCallback } from "react";
import { fetchSkills, type Skill } from "../api/skills";
import {
  fetchQuestions,
  fetchQuestionDuplicates,
  reviewQuestion,
  reviewQuestionsBatch,
  deleteQuestion,
  type Question,
  type ListQuestionsResponse,
  type DuplicateMatch,
} from "../api/questions";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  PASSED_AI_REVIEW: "Lulus Review AI",
  FLAGGED_BY_AI: "Ditandai AI",
  UNIQUE: "Unik",
  DUPLICATE_SUSPECT: "Terduga Duplikat",
  PUBLISHED: "Published",
  UNPUBLISHED: "Unpublished",
  REJECTED: "Ditolak",
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  PASSED_AI_REVIEW: "bg-blue-100 text-blue-700",
  FLAGGED_BY_AI: "bg-yellow-100 text-yellow-700",
  UNIQUE: "bg-green-100 text-green-700",
  DUPLICATE_SUSPECT: "bg-orange-100 text-orange-700",
  PUBLISHED: "bg-emerald-100 text-emerald-700",
  UNPUBLISHED: "bg-amber-100 text-amber-700",
  REJECTED: "bg-red-100 text-red-700",
};

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: "Mudah",
  medium: "Sedang",
  hard: "Sulit",
};



interface EditingState {
  questionText: string;
  difficulty: string;
  tags: string;
  options: string;
  answerKey: string;
  explanation: string;
}

function buildEditingState(q: Question): EditingState {
  const c = q.content as Record<string, unknown>;
  return {
    questionText: q.questionText,
    difficulty: q.difficulty,
    tags: (q.tags || []).join(", "),
    options: JSON.stringify(
      (c.options as { key: string; value: string }[]) || [],
      null,
      2,
    ),
    answerKey: (c.answerKey as string) || "",
    explanation: (c.explanation as string) || "",
  };
}

function buildEditedContent(
  q: Question,
  e: EditingState,
): {
  questionText: string;
  content: Record<string, unknown>;
  difficulty: string;
  tags: string[];
} {
  const parsed = (() => {
    try {
      return JSON.parse(e.options);
    } catch {
      return [];
    }
  })();
  return {
    questionText: e.questionText,
    content: {
      ...(q.content as Record<string, unknown>),
      options: parsed,
      answerKey: e.answerKey,
      explanation: e.explanation,
    },
    difficulty: e.difficulty,
    tags: e.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
  };
}

export default function Review({ type }: { type: "ai" | "human" }) {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [data, setData] = useState<ListQuestionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [processing, setProcessing] = useState<string | null>(null);
  const [approvedCount, setApprovedCount] = useState(45);
  const [sortByConfidence, setSortByConfidence] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSourceDropdown, setShowSourceDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // Filters
  const activeTab = type;
  const [subjectFilter, setSubjectFilter] = useState("");

  // Duplicates data (keyed by question id)
  const [duplicatesMap, setDuplicatesMap] = useState<
    Record<string, DuplicateMatch[]>
  >({});

  // Expanded question
  const [expandedId, setExpandedId] = useState<string | null>(null);



  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditingState | null>(null);

  // Batch actions confirmation
  const [showRejectAllConfirm, setShowRejectAllConfirm] = useState(false);
  const [rejectAllLoading, setRejectAllLoading] = useState(false);
  const [showApproveAllConfirm, setShowApproveAllConfirm] = useState(false);
  const [approveAllLoading, setApproveAllLoading] = useState(false);

  // Refs for keyboard focus
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const subjects = [...new Set(skills.map((s) => s.subject))].sort();

  useEffect(() => {
    fetchSkills()
      .then(setSkills)
      .catch(() => {});
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowSourceDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    loadQuestions();
  }, [activeTab, subjectFilter]);

  async function loadQuestions() {
    try {
      setLoading(true);
      setError("");
      const statusParam = activeTab === "ai"
        ? "FLAGGED_BY_AI"
        : "UNIQUE,DUPLICATE_SUSPECT,PASSED_AI_REVIEW";

      const result = await fetchQuestions({
        status: statusParam,
        subject: subjectFilter || undefined,
        limit: 100,
      });
      setData(result);
      setDuplicatesMap({});
      setExpandedId(null);
      setEditingId(null);

    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(
    questionId: string,
    decision: "APPROVE" | "REJECT" | "EDIT_APPROVE",
    reason?: string,
    editedContent?: {
      questionText: string;
      content: Record<string, unknown>;
      difficulty: string;
      tags: string[];
    },
  ) {
    try {
      setProcessing(questionId);
      setActionError("");
      await reviewQuestion(questionId, decision, reason, editedContent);
      if (data) {
        setData({
          ...data,
          questions: data.questions.filter((q) => q.id !== questionId),
          total: data.total - 1,
        });
      }
      if (decision === "APPROVE" || decision === "EDIT_APPROVE") {
        setApprovedCount((prev) => prev + 1);
      }
      setEditingId(null);
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setProcessing(null);
    }
  }

  async function handleRejectAll() {
    const ids = currentQuestions.map((q) => q.id);
    try {
      setRejectAllLoading(true);
      setActionError("");
      await reviewQuestionsBatch(ids, "REJECT");
      setData({
        ...data!,
        questions: [],
        total: 0,
      });
      setExpandedId(null);
      setEditingId(null);
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setRejectAllLoading(false);
      setShowRejectAllConfirm(false);
    }
  }

  async function handleApproveAll() {
    const questionsList = data?.questions ?? [];
    const ids = type === "ai"
      ? questionsList
          .filter((q) => q.aiReviewLogs && q.aiReviewLogs.length > 0 && Number(q.aiReviewLogs[0].confidence) > 0.95)
          .map((q) => q.id)
      : questionsList.map((q) => q.id);

    if (ids.length === 0) {
      alert("Tidak ada soal dengan kelayakan >95% untuk disetujui secara otomatis.");
      setShowApproveAllConfirm(false);
      return;
    }

    try {
      setApproveAllLoading(true);
      setActionError("");
      await reviewQuestionsBatch(ids, "APPROVE");
      if (data) {
        setData({
          ...data,
          questions: data.questions.filter((q) => !ids.includes(q.id)),
          total: Math.max(0, data.total - ids.length),
        });
      }
      setApprovedCount((prev) => prev + ids.length);
      setExpandedId(null);
      setEditingId(null);
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setApproveAllLoading(false);
      setShowApproveAllConfirm(false);
    }
  }

  async function handleDelete(questionId: string) {
    if (!window.confirm("Yakin ingin menghapus soal ini secara permanen? Tindakan ini tidak dapat dibatalkan.")) return;
    try {
      setProcessing(questionId);
      setActionError("");
      await deleteQuestion(questionId);
      if (data) {
        setData({
          ...data,
          questions: data.questions.filter((q) => q.id !== questionId),
          total: data.total - 1,
        });
      }
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setProcessing(null);
    }
  }

  async function loadDuplicates(questionId: string) {
    if (duplicatesMap[questionId]) return;
    try {
      const res = await fetchQuestionDuplicates(questionId);
      setDuplicatesMap((prev) => ({ ...prev, [questionId]: res.duplicates }));
    } catch {
      setDuplicatesMap((prev) => ({ ...prev, [questionId]: [] }));
    }
  }

  function toggleExpand(q: Question) {
    if (expandedId === q.id) {
      setExpandedId(null);
      setEditingId(null);
    } else {
      setExpandedId(q.id);
      setEditingId(null);
      if (q.status === "DUPLICATE_SUSPECT") {
        loadDuplicates(q.id);
      }
    }
  }

  function startEdit(q: Question) {
    setEditingId(q.id);
    setEditForm(buildEditingState(q));
  }

  // Keyboard shortcut handler
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, q: Question) => {
      if (processing === q.id) return;
      if (editingId === q.id) return;

      switch (e.key.toLowerCase()) {
        case "a":
          e.preventDefault();
          handleAction(q.id, "APPROVE");
          break;
        case "r":
          e.preventDefault();
          handleAction(q.id, "REJECT");
          break;
        case "e":
          e.preventDefault();
          startEdit(q);
          break;
      }
    },
    [processing, editingId, data],
  );

  const rawQuestions = data?.questions ?? [];
  let filteredQuestions = [...rawQuestions];
  if (searchQuery) {
    const query = searchQuery.toLowerCase();
    filteredQuestions = filteredQuestions.filter((q) =>
      q.questionText.toLowerCase().includes(query)
    );
  }
  if (sortByConfidence && type === "ai") {
    filteredQuestions.sort((a, b) => {
      const confA = a.aiReviewLogs?.[0]?.confidence ? Number(a.aiReviewLogs[0].confidence) : 0;
      const confB = b.aiReviewLogs?.[0]?.confidence ? Number(b.aiReviewLogs[0].confidence) : 0;
      return confB - confA;
    });
  }
  const currentQuestions = filteredQuestions;

  const avgConfidence = (() => {
    const questionsWithConfidence = rawQuestions.filter(
      (q) => q.aiReviewLogs && q.aiReviewLogs.length > 0 && q.aiReviewLogs[0].confidence !== null
    );
    if (questionsWithConfidence.length === 0) return 0;
    const sum = questionsWithConfidence.reduce(
      (acc, q) => acc + Number(q.aiReviewLogs![0].confidence),
      0
    );
    return Math.round((sum / questionsWithConfidence.length) * 100);
  })();

  const highFlags = rawQuestions.filter(
    (q) => q.aiReviewLogs && q.aiReviewLogs.length > 0 && (!q.aiReviewLogs[0].valid || Number(q.aiReviewLogs[0].confidence) < 0.8)
  ).length;

  const approveAllTargetCount = type === "ai"
    ? rawQuestions.filter((q) => q.aiReviewLogs && q.aiReviewLogs.length > 0 && Number(q.aiReviewLogs[0].confidence) > 0.95).length
    : rawQuestions.length;

  return (
    <div className="max-w-7xl mx-auto w-full flex-1">
      {/* Title */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          {type === "ai" ? (
            <>
              <span className="material-symbols-outlined text-primary font-bold">auto_awesome</span>
              Review AI Generated Content
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-primary font-bold">person_search</span>
              Review Human Generated Content
            </>
          )}
          {data && (
            <span className="bg-blue-100 text-blue-700 text-xs px-2.5 py-0.5 rounded-full font-bold ml-2">
              {data.total}
            </span>
          )}
        </h2>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 mb-1">Pending Review</p>
          <p className="text-2xl font-bold text-gray-900">{data?.total ?? 0}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 mb-1">Avg Confidence</p>
          <p className="text-2xl font-bold text-primary">{avgConfidence}%</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 mb-1">High Flags</p>
          <p className="text-2xl font-bold text-error">{highFlags}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 mb-1">Approved Today</p>
          <p className="text-2xl font-bold text-secondary">{approvedCount}</p>
        </div>
      </div>

      {/* Banner / Description */}
      {type === "ai" ? (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 text-xs px-4 py-3.5 rounded-xl mb-6 flex items-start gap-3 shadow-sm select-none">
          <span className="material-symbols-outlined text-amber-600 shrink-0 mt-0.5">info</span>
          <div>
            <p className="font-bold text-sm text-amber-950 mb-0.5">Antrean Review AI (Groq)</p>
            <p className="leading-relaxed">Daftar soal yang terdeteksi memiliki kesalahan atau masalah kualitas oleh model AI Groq. Tinjau kritik/saran dari AI, perbaiki soal menggunakan tombol <strong>Edit & Approve [E]</strong>, atau klik <strong>Tolak [R]</strong> jika soal tersebut tidak layak dipakai.</p>
          </div>
        </div>
      ) : (
        <div className="bg-blue-50 border border-blue-200 text-blue-900 text-xs px-4 py-3.5 rounded-xl mb-6 flex items-start gap-3 shadow-sm select-none">
          <span className="material-symbols-outlined text-blue-600 shrink-0 mt-0.5">info</span>
          <div>
            <p className="font-bold text-sm text-blue-950 mb-0.5">Antrean Review Manusia (Human)</p>
            <p className="leading-relaxed">Daftar soal yang berhasil lulus pengecekan otomatis AI. Di sini Anda bisa memvalidasi tingkat keunikan soal (terutama soal berkategori <strong>Terduga Duplikat</strong>) dan memberikan persetujuan akhir <strong>Approve [A]</strong> agar soal diterbitkan ke Bank Soal.</p>
          </div>
        </div>
      )}

      {/* Filters & Actions Bar */}
      <div className="flex flex-wrap items-center gap-3 mb-6 border-b border-gray-200 pb-4">
        {/* Search Bar */}
        <div className="relative shrink-0">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-[18px]">
            search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari teks soal..."
            className="pl-9 pr-4 py-2 rounded-lg border border-gray-300 focus:border-[#003d9b] focus:ring-1 focus:ring-[#003d9b] outline-none text-sm bg-white w-64 transition-all"
          />
        </div>

        {/* Filter Dropdown */}
        <div className="relative shrink-0" ref={dropdownRef}>
          <button
            onClick={() => setShowSourceDropdown(!showSourceDropdown)}
            className={`px-4 py-2 border rounded-lg font-medium text-sm flex items-center gap-1.5 transition-colors ${
              subjectFilter
                ? "bg-[#dae2ff] text-[#001848] border-[#003d9b]"
                : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">filter_alt</span>
            Sumber: {subjectFilter || "Semua"}
            <span className="material-symbols-outlined text-[16px] transition-transform duration-200">
              {showSourceDropdown ? "expand_less" : "expand_more"}
            </span>
          </button>

          {showSourceDropdown && (
            <div className="absolute left-0 mt-1.5 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-30 max-h-60 overflow-y-auto custom-scrollbar py-1">
              <button
                onClick={() => {
                  setSubjectFilter("");
                  setShowSourceDropdown(false);
                }}
                className={`w-full text-left px-4 py-2 text-sm transition-colors hover:bg-gray-50 flex items-center justify-between ${
                  !subjectFilter ? "text-[#003d9b] font-semibold bg-[#dae2ff]/20" : "text-gray-700"
                }`}
              >
                <span>Semua Sumber (All Sources)</span>
                {!subjectFilter && <span className="material-symbols-outlined text-[16px]">check</span>}
              </button>
              {subjects.map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setSubjectFilter(s);
                    setShowSourceDropdown(false);
                  }}
                  className={`w-full text-left px-4 py-2 text-sm transition-colors hover:bg-gray-50 flex items-center justify-between ${
                    subjectFilter === s ? "text-[#003d9b] font-semibold bg-[#dae2ff]/20" : "text-gray-700"
                  }`}
                >
                  <span className="truncate mr-2">{s}</span>
                  {subjectFilter === s && <span className="material-symbols-outlined text-[16px] shrink-0">check</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {type === "ai" && (
          <div className="ml-auto flex gap-2">
            <button
              onClick={() => setSortByConfidence(!sortByConfidence)}
              className={`px-4 py-2 border rounded-lg font-medium text-sm flex items-center gap-1.5 transition-colors ${
                sortByConfidence
                  ? "bg-[#dae2ff] text-[#001848] border-[#003d9b]"
                  : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">filter_list</span>
              Sort: Confidence
            </button>
          </div>
        )}
      </div>

      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
      {actionError && <p className="text-red-600 text-sm mb-4">{actionError}</p>}

      {/* Keyboard hints */}
      <div className="text-xs text-gray-500 mb-4 flex gap-4">
        <span>
          <kbd className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-600 border border-gray-200">A</kbd> Approve
        </span>
        <span>
          <kbd className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-600 border border-gray-200">R</kbd> Reject
        </span>
        <span>
          <kbd className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-600 border border-gray-200">E</kbd> Edit & Approve
        </span>
      </div>

      {/* Approve All confirmation modal */}
      {showApproveAllConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Approve Semua Soal?</h3>
            <div className="text-sm text-gray-600 mb-2">
              {type === "ai" ? (
                <>Kamu akan menyetujui <strong>{approveAllTargetCount} soal dengan kelayakan &gt;95%</strong> sekaligus dan memindahkannya ke Review Human.</>
              ) : (
                <>Kamu akan menyetujui <strong>{currentQuestions.length} soal</strong> sekaligus dan menerbitkannya ke Bank Soal.</>
              )}
            </div>
            <div className="text-sm text-gray-500 mb-5">
              {type === "ai" ? (
                <>Tindakan ini akan mengubah status soal-soal tersebut menjadi <strong>Passed AI Review</strong> (kemudian terduplikasi/unik) dan memindahkannya ke antrean Review Human.</>
              ) : (
                <>Tindakan ini akan mengubah status semua soal menjadi <strong>Published</strong> dan memindahkannya dari antrian review.</>
              )}
            </div>
            <div className="flex gap-3 justify-end">
              <button
                disabled={approveAllLoading}
                onClick={() => setShowApproveAllConfirm(false)}
                className="border border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-gray-50 disabled:opacity-50 px-4 py-2 rounded-lg text-sm font-semibold"
              >
                Batal
              </button>
              <button
                disabled={approveAllLoading}
                onClick={handleApproveAll}
                className="bg-[#006e2f] hover:bg-[#005321] text-white disabled:opacity-50 px-4 py-2 rounded-lg text-sm font-semibold"
              >
                {approveAllLoading ? "Memproses..." : "Ya, Approve Semua"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject All confirmation modal */}
      {showRejectAllConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Reject Semua Soal?</h3>
            <p className="text-sm text-gray-600 mb-2">
              Kamu akan menolak <strong>{currentQuestions.length} soal</strong> sekaligus dari antrian ini.
            </p>
            <p className="text-sm text-gray-500 mb-5">
              Tindakan ini akan mengubah status semua soal menjadi <strong>Ditolak</strong> dan memindahkannya dari antrian review.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                disabled={rejectAllLoading}
                onClick={() => setShowRejectAllConfirm(false)}
                className="border border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-gray-50 disabled:opacity-50 px-4 py-2 rounded-lg text-sm font-semibold"
              >
                Batal
              </button>
              <button
                disabled={rejectAllLoading}
                onClick={handleRejectAll}
                className="bg-[#ba1a1a] hover:bg-[#93000a] text-white disabled:opacity-50 px-4 py-2 rounded-lg text-sm font-semibold"
              >
                {rejectAllLoading ? "Memproses..." : "Ya, Reject Semua"}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-gray-500">Memuat data...</p>
      ) : !data || currentQuestions.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg">Tidak ada soal perlu direview</p>
          <p className="text-sm mt-1">Semua soal sudah diproses.</p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-500 font-medium">
              {data.total} soal dalam antrian
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowApproveAllConfirm(true)}
                className="border border-[#006e2f] text-[#006e2f] hover:bg-[#6bff8f]/20 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]">check</span>
                {type === "ai" ? "Approve All (>95%)" : "Approve All"}
              </button>
              <button
                onClick={() => setShowRejectAllConfirm(true)}
                className="border border-[#ba1a1a] text-[#ba1a1a] hover:bg-[#ffdad6]/20 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
                Reject All
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {currentQuestions.map((q, idx) => {
              const aiLog = q.aiReviewLogs?.[0];
              const hasAiLog = !!aiLog;
              const confidenceVal = aiLog?.confidence ? Number(aiLog.confidence) : 0;
              const confidencePct = Math.round(confidenceVal * 100);
              const isPerfect = confidencePct > 95;
              const isExpanded = expandedId === q.id;

              return (
                <div
                  key={q.id}
                  ref={(el) => {
                    cardRefs.current[q.id] = el;
                  }}
                  tabIndex={0}
                  onKeyDown={(e) => handleKeyDown(e, q)}
                  className={`bg-white border rounded-xl p-6 focus:outline-none focus:ring-2 focus:ring-[#003d9b] transition-all ${
                    q.status === "DUPLICATE_SUSPECT"
                      ? "border-orange-300 shadow-sm"
                      : q.status === "FLAGGED_BY_AI"
                        ? "border-yellow-300 shadow-sm"
                        : "border-gray-200 shadow-sm hover:border-gray-300"
                  }`}
                >
                  {/* Card Header (Click to expand) */}
                  <div onClick={() => toggleExpand(q)} className="cursor-pointer select-none">
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded flex-shrink-0">
                            {idx + 1}
                          </span>
                          {type === "ai" ? (
                            isPerfect ? (
                              <span className="bg-[#6bff8f] text-[#007432] px-2 py-0.5 rounded text-xs font-semibold border border-[#006e2f]/20">
                                Perfect
                              </span>
                            ) : (
                              <span className="bg-[#e1e2ec] text-[#434654] px-2 py-0.5 rounded text-xs font-semibold border border-[#c3c6d6]">
                                Review Needed
                              </span>
                            )
                          ) : (
                            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${STATUS_COLORS[q.status] || "bg-gray-100 text-gray-700"}`}>
                              {STATUS_LABELS[q.status] || q.status}
                            </span>
                          )}
                          <span className="text-[#434654] bg-[#ededf8] px-2 py-0.5 rounded text-xs font-medium">
                            {q.skill?.name || q.skill?.subject || "General"}
                          </span>
                          <span className="text-xs text-gray-500 font-medium">
                            {DIFFICULTY_LABELS[q.difficulty] || q.difficulty}
                          </span>
                        </div>
                        <h3 className="text-lg text-[#191b23] font-semibold leading-relaxed whitespace-pre-wrap">
                          {q.questionText}
                        </h3>
                      </div>
                      
                      {type === "ai" && hasAiLog && (
                        <div className="flex flex-col items-end shrink-0">
                          <div className={`flex items-center gap-0.5 font-bold ${isPerfect ? "text-[#003d9b]" : "text-[#434654]"}`}>
                            <span className="material-symbols-outlined text-[20px] filled">
                              {isPerfect ? "bolt" : "help_center"}
                            </span>
                            <span className="text-xl font-bold">{confidencePct}%</span>
                          </div>
                          <span className="text-xs text-gray-500 font-medium">Confidence Score</span>
                        </div>
                      )}
                    </div>

                    {/* Collapsed Options Preview */}
                    {!isExpanded && (
                      <>
                        <div className="pl-4 border-l-2 border-gray-200 mt-3 space-y-1.5">
                          {(() => {
                            const c = q.content as Record<string, unknown>;
                            const options = (c.options as { key: string; value: string }[]) || [];
                            const answerKey = (c.answerKey as string) || "";
                            return options.map((opt) => {
                              const isCorrect = opt.key === answerKey;
                              return (
                                <p key={opt.key} className={`text-sm ${isCorrect ? "text-gray-900 font-bold" : "text-[#434654]"}`}>
                                  <span className="mr-1">{opt.key}.</span> {opt.value}
                                </p>
                              );
                            });
                          })()}
                        </div>

                        {/* Collapsed AI Output Summary (Only on AI Tab) */}
                        {type === "ai" && hasAiLog && (
                          <div className="mt-4 space-y-2">
                            {aiLog.issues && (aiLog.issues as string[]).length > 0 && (
                              <div className="bg-[#ffdad6] text-[#93000a] p-2.5 rounded-lg text-xs font-semibold border border-[#ba1a1a]">
                                <strong>AI Flag:</strong> {(aiLog.issues as string[]).join(". ")}
                              </div>
                            )}
                            <div className={`p-2.5 rounded-lg text-xs font-semibold flex items-start gap-2 border transition-colors ${
                              isPerfect
                                ? "bg-green-50 text-[#007432] border-[#006e2f]/20"
                                : "bg-yellow-50 text-[#812800] border-yellow-200"
                            }`}>
                              <span className="material-symbols-outlined text-[16px] shrink-0 mt-0.5">
                                {isPerfect ? "task_alt" : "info"}
                              </span>
                              <div className="flex-1">
                                <strong>Rekomendasi AI:</strong>{" "}
                                {aiLog.valid
                                  ? "Soal ini sudah memenuhi standar dan dapat dipublikasikan langsung."
                                  : `Soal perlu diperbaiki pada ${(aiLog.issues as string[]).length} aspek: ${(aiLog.issues as string[]).join("; ")}.`}
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Expanded Detail */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-gray-200 space-y-4">
                      
                      {/* Interactive Options list */}
                      {editingId !== q.id && (
                        <div className="space-y-2">
                          {(() => {
                            const c = q.content as Record<string, unknown>;
                            const options = (c.options as { key: string; value: string }[]) || [];
                            const answerKey = (c.answerKey as string) || "";
                            return options.map((opt) => {
                              const isCorrect = opt.key === answerKey;
                              return (
                                <div
                                  key={opt.key}
                                  className={`flex items-start gap-3 px-4 py-3 rounded-lg text-sm border transition-colors ${
                                    isCorrect
                                      ? "bg-[#6bff8f]/10 border-[#006e2f]/30"
                                      : "bg-white border-gray-100"
                                  }`}
                                >
                                  <span className={`font-bold flex-shrink-0 w-5 ${isCorrect ? "text-[#006e2f]" : "text-gray-400"}`}>
                                    {opt.key}.
                                  </span>
                                  <span className={`flex-1 ${isCorrect ? "text-[#006e2f] font-semibold" : "text-gray-700"}`}>
                                    {opt.value}
                                  </span>
                                  {isCorrect && (
                                    <span className="flex-shrink-0 text-xs text-[#006e2f] font-semibold bg-[#6bff8f]/30 px-1.5 py-0.5 rounded">
                                      ✓ Kunci
                                    </span>
                                  )}
                                </div>
                              );
                            });
                          })()}

                          {/* Explanation */}
                          {(() => {
                            const c = q.content as Record<string, unknown>;
                            const explanation = (c.explanation as string) || "";
                            return explanation && (
                              <div className="bg-[#f3f3fd] border border-gray-200 rounded-lg p-4 mt-3">
                                <p className="text-xs font-semibold text-primary mb-1">Pembahasan</p>
                                <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{explanation}</p>
                              </div>
                            );
                          })()}
                        </div>
                      )}

                      {/* AI Flag warning box (only on AI tab) */}
                      {type === "ai" && aiLog && aiLog.issues && (aiLog.issues as string[]).length > 0 && (
                        <div className="bg-[#ffdad6] text-[#93000a] p-3 rounded-lg text-xs font-semibold border border-[#ba1a1a]">
                          <strong>AI Flag:</strong> {(aiLog.issues as string[]).join(". ")}
                        </div>
                      )}

                      {/* AI Analysis logs (only on AI tab) */}
                      {type === "ai" && aiLog && (
                        <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-200 rounded-xl p-5 space-y-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                                <span className="material-symbols-outlined text-white text-[20px] font-bold">auto_awesome</span>
                              </div>
                              <div>
                                <h3 className="text-sm font-bold text-gray-900">Analisis AI Review</h3>
                                <p className="text-xs text-gray-600">Model: {aiLog.modelUsed || "AI Reviewer v1"}</p>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <span className={`text-xs font-bold px-3 py-1 rounded-full ${aiLog.valid ? "bg-[#006e2f] text-white" : "bg-[#ba1a1a] text-white"}`}>
                                {aiLog.valid ? "✓ Valid" : "⚠ Perlu Perbaikan"}
                              </span>
                              <div className="flex items-center gap-1 text-xs text-gray-600">
                                <span className="font-medium">Confidence:</span>
                                <span className={`font-bold ${confidenceVal >= 0.8 ? "text-green-600" : confidenceVal >= 0.6 ? "text-yellow-600" : "text-red-600"}`}>
                                  {confidencePct}%
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-3">
                            {aiLog.valid && (
                              <div className="bg-white border border-green-200 rounded-lg p-4">
                                <div className="flex items-start gap-2 mb-2">
                                  <div className="w-5 h-5 bg-[#006e2f] rounded flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                  </div>
                                  <div className="flex-1">
                                    <h4 className="text-sm font-bold text-[#007432] mb-1">Soal Berkualitas Baik</h4>
                                    <p className="text-sm text-gray-700 leading-relaxed">
                                      Soal ini telah memenuhi standar kualitas dan siap untuk dipublikasikan.
                                    </p>
                                  </div>
                                </div>
                              </div>
                            )}

                            {aiLog.issues && (aiLog.issues as string[]).length > 0 && (
                              <div className="bg-white border border-yellow-200 rounded-lg p-4">
                                <div className="flex items-start gap-2 mb-2">
                                  <div className="w-5 h-5 bg-yellow-500 rounded flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                  </div>
                                  <div className="flex-1">
                                    <h4 className="text-sm font-bold text-yellow-800 mb-1">Cacat yang Ditemukan</h4>
                                    <p className="text-sm text-yellow-700 leading-relaxed">AI menemukan beberapa masalah:</p>
                                  </div>
                                </div>
                                <ul className="list-disc pl-8 space-y-1.5 text-sm text-gray-700">
                                  {(aiLog.issues as string[]).map((issue, idx) => (
                                    <li key={idx} className="leading-relaxed">{issue}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            <div className="bg-[#dae2ff] border border-blue-200 rounded-lg p-3">
                              <p className="text-xs font-semibold text-[#001848] mb-1">📋 Rekomendasi AI:</p>
                              <p className="text-sm text-[#001848] leading-relaxed">
                                {aiLog.valid
                                  ? "Soal ini sudah memenuhi standar dan dapat dipublikasikan langsung. Tidak ada perbaikan yang diperlukan."
                                  : `Soal perlu diperbaiki pada ${(aiLog.issues as string[]).length} aspek di atas sebelum dipublikasikan. Review manual disarankan untuk memastikan kualitas.`}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Duplicate Suspicion Side-by-Side (only on Human tab, or if duplicate suspect) */}
                      {q.status === "DUPLICATE_SUSPECT" && (
                        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                          <p className="text-sm text-orange-700 font-semibold mb-3 flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-[18px]">warning</span>
                            Terduga duplikat — perbandingan dengan soal mirip:
                          </p>
                          {duplicatesMap[q.id] && duplicatesMap[q.id].length > 0 ? (
                            <div className="space-y-3">
                              {duplicatesMap[q.id].map((dup) => (
                                <div key={dup.id} className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white border border-gray-200 rounded-lg p-4 text-sm shadow-sm">
                                  <div>
                                    <p className="text-xs text-gray-500 mb-1.5 font-bold tracking-wider">SOAL INI</p>
                                    <p className="text-gray-800 whitespace-pre-wrap font-medium leading-relaxed">{q.questionText}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-gray-500 mb-1.5 font-bold tracking-wider">SOAL MIRIP (skor: {dup.similarityScore.toFixed(2)})</p>
                                    <p className="text-gray-800 whitespace-pre-wrap font-medium leading-relaxed">{dup.questionText}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : duplicatesMap[q.id] ? (
                            <p className="text-xs text-gray-500 italic">Tidak ada data duplikat yang dimuat.</p>
                          ) : (
                            <p className="text-xs text-gray-500 italic">Memuat data duplikat...</p>
                          )}
                        </div>
                      )}

                      {/* Editing form */}
                      {editingId === q.id && editForm && (
                        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-4">
                          <p className="text-sm font-bold text-primary flex items-center gap-1">
                            <span className="material-symbols-outlined text-[18px]">edit</span>
                            Edit Soal
                          </p>
                          <div>
                            <label className="block text-xs text-gray-600 font-semibold mb-1">Teks Soal</label>
                            <textarea
                              value={editForm.questionText}
                              onChange={(e) =>
                                setEditForm({
                                  ...editForm,
                                  questionText: e.target.value,
                                })
                              }
                              className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                              rows={3}
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs text-gray-600 font-semibold mb-1">Kunci Jawaban</label>
                              <input
                                value={editForm.answerKey}
                                onChange={(e) =>
                                  setEditForm({
                                    ...editForm,
                                    answerKey: e.target.value,
                                  })
                                }
                                className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-600 font-semibold mb-1">Kesulitan</label>
                              <select
                                value={editForm.difficulty}
                                onChange={(e) =>
                                  setEditForm({
                                    ...editForm,
                                    difficulty: e.target.value,
                                  })
                                }
                                className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                              >
                                <option value="easy">Mudah</option>
                                <option value="medium">Sedang</option>
                                <option value="hard">Sulit</option>
                              </select>
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs text-gray-600 font-semibold mb-1">Tags (pisahkan dengan koma)</label>
                            <input
                              value={editForm.tags}
                              onChange={(e) =>
                                setEditForm({ ...editForm, tags: e.target.value })
                              }
                              className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-600 font-semibold mb-1">Opsi (JSON array of {"{"}key, value{"}"})</label>
                            <textarea
                              value={editForm.options}
                              onChange={(e) =>
                                setEditForm({
                                  ...editForm,
                                  options: e.target.value,
                                })
                              }
                              className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono text-gray-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                              rows={4}
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-600 font-semibold mb-1">Pembahasan</label>
                            <textarea
                              value={editForm.explanation}
                              onChange={(e) =>
                                setEditForm({
                                  ...editForm,
                                  explanation: e.target.value,
                                })
                              }
                              className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                              rows={3}
                            />
                          </div>
                        </div>
                      )}

                      {/* Action buttons */}
                      <div className="flex gap-3 items-center flex-wrap pt-2">
                        {editingId === q.id ? (
                          <>
                            <button
                              disabled={processing === q.id}
                              onClick={() =>
                                handleAction(
                                  q.id,
                                  "EDIT_APPROVE",
                                  undefined,
                                  editForm ? buildEditedContent(q, editForm) : undefined,
                                )
                              }
                              className="bg-[#006e2f] hover:bg-[#005321] text-white disabled:opacity-50 px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-colors"
                            >
                              <span className="material-symbols-outlined text-[18px]">check</span>
                              {processing === q.id ? "Memproses..." : "Simpan & Approve"}
                            </button>
                            <button
                              onClick={() => {
                                setEditingId(null);
                                setEditForm(null);
                              }}
                              className="border border-gray-300 text-gray-700 hover:bg-gray-100 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                            >
                              Batal
                            </button>
                          </>
                        ) : (
                          <>
                            {/* For AI review and confidence <= 95% OR for human review, show REJECT button */}
                            {(type !== "ai" || !isPerfect) && (
                              <button
                                disabled={processing === q.id}
                                onClick={() => handleAction(q.id, "REJECT")}
                                className="bg-white border border-[#ba1a1a] text-[#ba1a1a] hover:bg-[#ffdad6]/40 disabled:opacity-50 px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-colors"
                              >
                                <span className="material-symbols-outlined text-[18px]">delete</span>
                                Reject
                              </button>
                            )}

                            <button
                              onClick={() => startEdit(q)}
                              className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-100 disabled:opacity-50 px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-colors"
                            >
                              <span className="material-symbols-outlined text-[18px]">edit</span>
                              Edit
                            </button>

                            <button
                              disabled={processing === q.id}
                              onClick={() => handleAction(q.id, "APPROVE")}
                              className="bg-[#006e2f] hover:bg-[#005321] text-white disabled:opacity-50 px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-colors"
                            >
                              <span className="material-symbols-outlined text-[18px]">check</span>
                              Approve
                            </button>

                            <button
                              disabled={processing === q.id}
                              onClick={() => handleDelete(q.id)}
                              title="Hapus soal secara permanen"
                              className="ml-auto border border-red-300 text-red-500 hover:bg-red-50 disabled:opacity-50 px-3 py-2 rounded-lg text-sm flex items-center gap-1.5 transition-colors"
                            >
                              <span className="material-symbols-outlined text-[18px]">delete_forever</span>
                              Hapus
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
