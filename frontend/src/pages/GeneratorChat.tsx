import { useEffect, useState, useRef, useMemo } from "react";
import {
  fetchSkills,
  createSkill,
  updateSkill,
  deleteSkill,
  type Skill,
  type CreateSkillInput,
  type UpdateSkillInput,
} from "../api/skills";
import { startGeneration, getJobStatus } from "../api/generate";

import { useChat, type ChatMessage } from "../contexts/ChatContext";

interface FormData {
  name: string;
  subject: string;
  gradeLevel: string;
  topic: string;
  systemPrompt: string;
  referenceContext: string;
  isActive: boolean;
}

type FormMode = "create" | "edit" | null;

const DEFAULT_SYSTEM_PROMPT = `Anda adalah asisten pembuat soal pendidikan. Tugas Anda adalah membuat soal berdasarkan REFERENCE_CONTEXT yang diberikan.

REFERENCE_CONTEXT:
{reference_context}

INSTRUKSI PENTING:
1. Buat soal HANYA berdasarkan reference_context yang diberikan.
2. Jika informasi dalam reference_context tidak cukup untuk membuat soal yang valid, jangan mengarang fakta — kembalikan status butuh konteks tambahan.
3. Setiap soal harus memiliki kunci jawaban yang jelas dapat diverifikasi dari reference_context.
4. Gunakan bahasa Indonesia yang baik dan benar.
5. Sertakan pembahasan yang merujuk kembali ke reference_context.`;

const SUBJECTS = [
  "Matematika",
  "Fisika",
  "Kimia",
  "Biologi",
  "Bahasa Indonesia",
  "Bahasa Inggris",
  "Sejarah",
  "Geografi",
  "Ekonomi",
  "Sosiologi",
  "PKN",
  "Informatika",
  "PAI",
  "Seni Budaya",
  "PJOK",
  "Penalaran Umum (TPS - UTBK SNBT)",
];

const GRADE_LEVELS = [
  "I",
  "II",
  "III",
  "IV",
  "V",
  "VI",
  "VII",
  "VIII",
  "IX",
  "X",
  "XI",
  "XII",
  "SMA / Lulusan SMA (calon mahasiswa)",
];

const EMPTY_FORM: FormData = {
  name: "",
  subject: "",
  gradeLevel: "",
  topic: "",
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  referenceContext: "",
  isActive: true,
};

export default function GeneratorChat() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loadingSkills, setLoadingSkills] = useState(true);

  const {
    sessions,
    activeSessionId,
    selectedSkillId,
    setSelectedSkillId,
    count,
    setCount,
    createSession,
    updateSession,
    updateSessionMessage,
  } = useChat();

  const [promptText, setPromptText] = useState("");

  const [selectedImage, setSelectedImage] = useState<{
    data: string;
    mimeType: string;
    fileName: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [generating, setGenerating] = useState<Record<string, boolean>>({});
  const pollRefs = useRef<Record<string, ReturnType<typeof setInterval>>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [showSkillDropdown, setShowSkillDropdown] = useState(false);
  const [skillSearch, setSkillSearch] = useState("");

  const [formMode, setFormMode] = useState<FormMode>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [showDeleteId, setShowDeleteId] = useState<string | null>(null);

  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? null;
  const currentMessages = activeSession ? activeSession.messages : [];
  const selectedSkill = skills.find((s) => s.id === selectedSkillId) ?? null;
  const isGenerating = activeSessionId
    ? generating[activeSessionId] ?? false
    : false;

  useEffect(() => {
    loadSkills();
  }, []);

  async function loadSkills() {
    try {
      setLoadingSkills(true);
      const data = await fetchSkills();
      setSkills(data);
    } catch {
      // silent
    } finally {
      setLoadingSkills(false);
    }
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentMessages]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Hanya file gambar yang diperbolehkan!");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert("Ukuran gambar maksimal 5MB!");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const parts = base64String.split(",");
      const data = parts[1] || base64String;
      setSelectedImage({
        data,
        mimeType: file.type,
        fileName: file.name,
      });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  async function handleGenerate() {
    if (!selectedSkillId || !selectedSkill) return;

    const skillId = selectedSkillId;
    const ts = Date.now();
    const reqId = `req-${ts}`;
    const resId = `res-${ts}`;

    const currentPrompt = promptText.trim();
    const currentImage = selectedImage;
    setPromptText("");
    setSelectedImage(null);

    const reqMsg: ChatMessage = {
      id: reqId,
      type: "request",
      timestamp: new Date(),
      requestedCount: count,
      prompt: currentPrompt || undefined,
      images: currentImage
        ? [{ data: currentImage.data, mimeType: currentImage.mimeType }]
        : undefined,
    };

    const resMsg: ChatMessage = {
      id: resId,
      type: "response",
      status: "PENDING",
      timestamp: new Date(),
      requestedCount: count,
      completedCount: 0,
    };

    let targetSessionId = activeSessionId;

    if (!targetSessionId) {
      const title = currentPrompt
        ? currentPrompt.slice(0, 30) + (currentPrompt.length > 30 ? "..." : "")
        : `${selectedSkill.name}`;
      targetSessionId = createSession(skillId, count, title, [reqMsg, resMsg]);
    } else {
      const existing = sessions.find((s) => s.id === targetSessionId);
      if (existing) {
        let newTitle = existing.title;
        if (existing.messages.length === 0 && currentPrompt) {
          newTitle =
            currentPrompt.slice(0, 30) +
            (currentPrompt.length > 30 ? "..." : "");
        }
        updateSession(targetSessionId, {
          title: newTitle,
          skillId,
          count,
          messages: [...existing.messages, reqMsg, resMsg],
        });
      }
    }

    setGenerating((prev) => ({ ...prev, [targetSessionId!]: true }));

    try {
      const { jobId } = await startGeneration(
        skillId,
        count,
        currentPrompt || undefined,
        currentImage
          ? [{ data: currentImage.data, mimeType: currentImage.mimeType }]
          : undefined
      );
      updateSessionMessage(targetSessionId!, resId, {
        jobId,
        status: "PROCESSING",
      });

      const interval = setInterval(async () => {
        try {
          const job = await getJobStatus(jobId);
          updateSessionMessage(targetSessionId!, resId, {
            status: job.status,
            completedCount: job.completedCount,
            requestedCount: job.requestedCount,
            errorMessage: job.errorMessage,
            questions: job.questions?.map((q) => ({
              id: q.id,
              content: q.content,
              questionText: q.questionText,
              difficulty: q.difficulty,
              tags: q.tags,
              status: q.status,
            })),
          });
          if (job.status === "COMPLETED" || job.status === "FAILED") {
            clearInterval(interval);
            delete pollRefs.current[jobId];
            setGenerating((prev) => ({
              ...prev,
              [targetSessionId!]: false,
            }));
            if (job.status === "COMPLETED") loadSkills();
          }
        } catch {
          clearInterval(interval);
          delete pollRefs.current[jobId];
          setGenerating((prev) => ({
            ...prev,
            [targetSessionId!]: false,
          }));
        }
      }, 2000);

      pollRefs.current[jobId] = interval;
    } catch (e) {
      updateSessionMessage(targetSessionId!, resId, {
        status: "FAILED",
        errorMessage: (e as Error).message,
      });
      setGenerating((prev) => ({ ...prev, [targetSessionId!]: false }));
    }
  }

  function openCreate() {
    setFormMode("create");
    setEditId(null);
    setForm(EMPTY_FORM);
    setFormError("");
  }

  function openEdit(skill: Skill) {
    setFormMode("edit");
    setEditId(skill.id);
    setForm({
      name: skill.name,
      subject: skill.subject,
      gradeLevel: skill.gradeLevel,
      topic: skill.topic,
      systemPrompt: skill.systemPrompt,
      referenceContext: skill.referenceContext ?? "",
      isActive: skill.isActive,
    });
    setFormError("");
  }

  function closeForm() {
    setFormMode(null);
    setEditId(null);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (
      !form.name.trim() ||
      !form.subject.trim() ||
      !form.gradeLevel.trim() ||
      !form.topic.trim()
    ) {
      setFormError("Lengkapi semua field yang wajib diisi (*)");
      return;
    }
    try {
      setSaving(true);
      setFormError("");
      const data: CreateSkillInput = {
        ...form,
        referenceContext: form.referenceContext || undefined,
      };
      if (formMode === "create") {
        const created = await createSkill(data);
        await loadSkills();
        setSelectedSkillId(created.id);
      } else if (editId) {
        await updateSkill(editId, data as UpdateSkillInput);
        await loadSkills();
      }
      closeForm();
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteSkill(id);
      setShowDeleteId(null);
      if (selectedSkillId === id) setSelectedSkillId(null);
      await loadSkills();
    } catch {
      // silent
    }
  }

  const SUBJECT_ORDER = useMemo(() => [
    "Penalaran Umum (TPS - UTBK SNBT)",
    "Pengetahuan dan Pemahaman Umum (TPS - UTBK SNBT)",
    "Pemahaman Bacaan dan Menulis (TPS - UTBK SNBT)",
    "Pengetahuan Kuantitatif (TPS - UTBK SNBT)",
    "Literasi Bahasa Indonesia (Tes Literasi - UTBK SNBT)",
    "Literasi Bahasa Inggris (Tes Literasi - UTBK SNBT)",
    "Penalaran Matematika (Tes Literasi - UTBK SNBT)",
  ], []);

  const groupedSkillsForDropdown = useMemo(() => {
    const q = skillSearch.toLowerCase();
    const filtered = skills.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.subject.toLowerCase().includes(q) ||
        s.topic.toLowerCase().includes(q)
    );
    const map: Record<string, Skill[]> = {};
    for (const s of filtered) {
      if (!map[s.subject]) map[s.subject] = [];
      map[s.subject].push(s);
    }
    return map;
  }, [skills, skillSearch]);

  const sortedGroupedEntries = useMemo(() => {
    const entries = Object.entries(groupedSkillsForDropdown);
    return entries.sort(([subA], [subB]) => {
      const idxA = SUBJECT_ORDER.indexOf(subA);
      const idxB = SUBJECT_ORDER.indexOf(subB);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return subA.localeCompare(subB);
    });
  }, [groupedSkillsForDropdown, SUBJECT_ORDER]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-surface-container-lowest relative">
      {formMode !== null ? (
        <SkillForm
          mode={formMode}
          form={form}
          saving={saving}
          error={formError}
          onChange={(k, v) =>
            setForm((prev) => ({ ...prev, [k]: v }))
          }
          onSubmit={handleSave}
          onCancel={closeForm}
        />
      ) : (
        <>
          {/* Chat header bar when a skill is selected */}
          {activeSessionId && selectedSkill && (
            <div className="flex-shrink-0 px-4 py-2 border-b border-outline-variant/60 flex items-center justify-between bg-surface-container-lowest shadow-sm">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-md bg-secondary/10 border border-secondary/20 flex items-center justify-center">
                  <span className="material-symbols-outlined text-secondary text-[16px]">
                    psychology
                  </span>
                </div>
                <div>
                  <h2 className="font-bold text-on-surface leading-tight text-xs">
                    {selectedSkill.name}
                  </h2>
                  <p className="text-[10px] text-on-surface-variant leading-none mt-0.5">
                    {selectedSkill.subject} · Kelas{" "}
                    {selectedSkill.gradeLevel} · {selectedSkill.topic}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-medium text-on-surface-variant">
                  {selectedSkill._count?.questions ?? 0} soal
                </span>
                <span
                  className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border font-bold ${
                    selectedSkill.isActive
                      ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                      : "bg-gray-100 border-gray-200 text-gray-500"
                  }`}
                >
                  <span
                    className={`w-1 h-1 rounded-full ${
                      selectedSkill.isActive
                        ? "bg-emerald-500"
                        : "bg-gray-400"
                    }`}
                  />
                  {selectedSkill.isActive ? "Aktif" : "Nonaktif"}
                </span>
                <button
                  onClick={() => openEdit(selectedSkill)}
                  className="p-1 rounded-md text-on-surface-variant hover:bg-surface-container-high transition-colors"
                  title="Edit skill"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    edit
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Messages Area / Welcome Screen */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {!activeSessionId ? (
              /* ─── Welcome Screen ─── */
              <div className="min-h-full flex flex-col items-center justify-center text-center px-8 select-none pb-48">
                <div className="bg-surface border border-outline-variant rounded-xl p-8 max-w-2xl shadow-[0_4px_12px_rgba(0,0,0,0.02)]">
                  <div className="w-12 h-12 bg-secondary text-white rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="material-symbols-outlined text-[24px]">psychology</span>
                  </div>
                  <h2 className="text-xl font-semibold text-on-surface mb-2">Quiz Generator Assistant</h2>
                  <p className="text-sm text-on-surface-variant max-w-md mx-auto">
                    I can help you generate high-quality questions for any topic. Specify the subject,
                    difficulty level, and question format to get started.
                  </p>

                  {/* Suggestion chips */}
                  <div className="flex flex-wrap justify-center gap-2 mt-6">
                    {skills
                      .filter((s) => s.isActive)
                      .slice(0, 3)
                      .map((skill) => (
                        <button
                          key={skill.id}
                          onClick={() => setSelectedSkillId(skill.id)}
                          className="bg-surface-container-lowest border border-outline-variant text-on-surface-variant text-xs px-3 py-2 rounded-full hover:bg-surface-container-low transition-colors font-medium"
                        >
                          {skill.name}
                        </button>
                      ))}
                  </div>

                  <div className="flex flex-wrap justify-center gap-2 mt-3">
                    <button className="bg-surface-container-lowest border border-outline-variant text-on-surface-variant text-[11px] px-3 py-1.5 rounded-full hover:bg-surface-container-low transition-colors">
                      "Create 5 multiple choice questions on React Hooks"
                    </button>
                    <button className="bg-surface-container-lowest border border-outline-variant text-on-surface-variant text-[11px] px-3 py-1.5 rounded-full hover:bg-surface-container-low transition-colors">
                      "Generate an essay prompt for World War II"
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* ─── Chat Messages ─── */
              <div className="max-w-3xl mx-auto px-3 md:px-4 pt-4 pb-36 space-y-3">
                {currentMessages.length === 0 ? (
                  <div className="text-center py-16 select-none">
                    <p className="text-on-surface-variant text-sm">
                      Belum ada pesan di sesi ini.
                    </p>
                    <p className="text-on-surface-variant opacity-60 text-xs mt-1">
                      Ketik instruksi di bawah lalu klik kirim.
                    </p>
                  </div>
                ) : (
                  currentMessages.map((msg) => (
                    <ChatBubble key={msg.id} message={msg} />
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* ─── Input Area (Fixed to bottom) ─── */}
          <div className="absolute bottom-0 left-0 right-0 p-3 md:p-4 pb-5 bg-gradient-to-t from-surface-container-lowest via-surface-container-lowest to-transparent pt-6 pointer-events-none">
            <div className="max-w-3xl mx-auto pointer-events-auto">
              <div className="relative bg-surface-container-lowest border border-outline-variant rounded-lg shadow-[0_4px_12px_rgba(0,0,0,0.04)] focus-within:border-secondary focus-within:ring-1 focus-within:ring-secondary transition-all">
                {/* Skill selector bar */}
                <div className="flex items-center px-3 py-1 border-b border-outline-variant/20">
                  <div className="relative">
                    <button
                      type="button"
                      disabled={isGenerating}
                      onClick={() => setShowSkillDropdown(!showSkillDropdown)}
                      className="flex items-center gap-1 px-1.5 py-0.5 rounded-md hover:bg-surface-container-low transition-colors text-on-surface-variant disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-[16px]">psychology</span>
                      <span className="text-xs">
                        Generator Skill:{" "}
                        <span className="font-bold text-on-surface">
                          {selectedSkill ? selectedSkill.name : "Pilih Skill..."}
                        </span>
                      </span>
                      <span className="material-symbols-outlined text-[16px]">expand_more</span>
                    </button>

                    {/* Skill Dropdown */}
                    {showSkillDropdown && (
                      <>
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setShowSkillDropdown(false)}
                        />
                        <div className="absolute bottom-full mb-2 left-0 z-50 w-80 bg-surface-container-lowest border border-outline-variant rounded-xl shadow-lg flex flex-col max-h-72 overflow-hidden">
                          <div className="p-2 border-b border-outline-variant bg-surface-container-low flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm text-on-surface-variant ml-1">
                              search
                            </span>
                            <input
                              value={skillSearch}
                              onChange={(e) =>
                                setSkillSearch(e.target.value)
                              }
                              placeholder="Cari skill..."
                              className="w-full bg-transparent text-xs text-on-surface focus:outline-none py-1"
                            />
                          </div>

                          <div className="flex-1 overflow-y-auto custom-scrollbar p-1 space-y-1">
                            {loadingSkills ? (
                              <p className="text-xs text-on-surface-variant text-center py-6">
                                Memuat kisi-kisi...
                              </p>
                            ) : Object.keys(groupedSkillsForDropdown)
                                .length === 0 ? (
                              <p className="text-xs text-on-surface-variant text-center py-6">
                                Skill tidak ditemukan
                              </p>
                            ) : (
                              sortedGroupedEntries.map(
                                ([subject, list]) => (
                                  <div key={subject} className="space-y-0.5">
                                    <div className="mt-2 mb-1 mx-1 px-2 py-1 bg-secondary/10 border border-secondary/20 rounded-md text-[9px] font-bold uppercase tracking-wider text-secondary flex items-center gap-1.5 select-none">
                                      <span className="material-symbols-outlined text-[12px]">
                                        collections_bookmark
                                      </span>
                                      <span className="truncate">{subject}</span>
                                    </div>
                                    {list.map((skill) => (
                                      <div
                                        key={skill.id}
                                        onClick={() => {
                                          setSelectedSkillId(skill.id);
                                          setShowSkillDropdown(false);
                                        }}
                                        className={`flex items-center justify-between rounded-lg px-2.5 py-2 cursor-pointer text-xs transition-colors ${
                                          selectedSkillId === skill.id
                                            ? "bg-surface-container-high text-secondary"
                                            : "text-on-surface-variant hover:bg-surface-container-high"
                                        }`}
                                      >
                                        <div className="flex-1 min-w-0 pr-2">
                                          <p className="font-semibold truncate">
                                            {skill.name}
                                          </p>
                                          <p className="text-[10px] text-on-surface-variant truncate mt-0.5">
                                            Kelas {skill.gradeLevel} |{" "}
                                            {skill.topic}
                                          </p>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setShowSkillDropdown(false);
                                            openEdit(skill);
                                          }}
                                          className="p-1 rounded hover:bg-surface-container-high text-on-surface-variant transition-colors"
                                          title="Edit skill"
                                        >
                                          <span className="material-symbols-outlined text-sm">
                                            edit
                                          </span>
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                )
                              )
                            )}
                          </div>

                          <div className="p-2 border-t border-outline-variant bg-surface-container-low">
                            <button
                              type="button"
                              onClick={() => {
                                setShowSkillDropdown(false);
                                openCreate();
                              }}
                              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs text-on-surface-variant hover:bg-surface-container-high transition-colors font-medium border border-dashed border-outline-variant"
                            >
                              <span className="material-symbols-outlined text-sm">
                                add
                              </span>
                              Buat Skill Baru
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="h-4 w-px bg-outline-variant mx-2" />

                  {/* Quantity selector */}
                  <div className="flex items-center gap-1 bg-surface-container-low border border-outline-variant rounded-md px-2 py-0.5 flex-shrink-0">
                    <span className="text-[11px] text-on-surface-variant font-medium">Jumlah:</span>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={count}
                      onChange={(e) =>
                        setCount(Math.min(50, Math.max(1, Number(e.target.value))))
                      }
                      disabled={isGenerating}
                      className="w-6 bg-transparent text-[11px] font-bold text-on-surface text-center focus:outline-none"
                    />
                  </div>
                </div>

                {/* Image Preview */}
                {selectedImage && (
                  <div className="relative inline-flex items-center gap-2.5 mx-3 mt-1.5 p-1.5 bg-surface-container-low border border-outline-variant rounded-lg max-w-sm select-none">
                    <img
                      src={`data:${selectedImage.mimeType};base64,${selectedImage.data}`}
                      alt="Preview"
                      className="w-12 h-12 object-cover rounded border border-outline-variant bg-surface-container-lowest"
                    />
                    <div className="flex-1 min-w-0 pr-5">
                      <p className="text-[11px] text-on-surface font-semibold truncate">
                        {selectedImage.fileName}
                      </p>
                      <p className="text-[9px] text-on-surface-variant">
                        Siap dikloning oleh AI
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedImage(null)}
                      className="absolute top-1 right-1 p-0.5 rounded-full bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest transition-colors"
                      title="Batalkan gambar"
                    >
                      <span className="material-symbols-outlined text-xs">
                        close
                      </span>
                    </button>
                  </div>
                )}

                {/* Textarea + Actions */}
                <textarea
                  rows={1}
                  value={promptText}
                  onChange={(e) => setPromptText(e.target.value)}
                  placeholder="Describe the questions you want to generate..."
                  disabled={isGenerating}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleGenerate();
                    }
                  }}
                  className="w-full bg-transparent border-none rounded-lg pr-14 min-h-[40px] max-h-24 resize-none text-xs text-on-surface focus:ring-0 focus:outline-none placeholder-on-surface-variant/50 px-3.5 pb-3 pt-1.5"
                />
                <div className="absolute right-1.5 bottom-1.5 flex items-center gap-1">
                  <button
                    type="button"
                    disabled={isGenerating}
                    onClick={() => fileInputRef.current?.click()}
                    className="p-1.5 text-on-surface-variant hover:bg-surface-container-low rounded-md transition-colors"
                    title="Attach file"
                  >
                    <span className="material-symbols-outlined text-[16px]">attach_file</span>
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*"
                    className="hidden"
                  />
                  <button
                    onClick={handleGenerate}
                    disabled={
                      isGenerating ||
                      !selectedSkillId ||
                      (selectedSkill ? !selectedSkill.isActive : false)
                    }
                    className="p-1.5 bg-secondary text-white rounded-md hover:opacity-90 transition-opacity flex items-center justify-center shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                    title={isGenerating ? "Sedang generate..." : "Kirim"}
                  >
                    {isGenerating ? (
                      <span className="material-symbols-outlined text-[16px] animate-spin">
                        hourglass_top
                      </span>
                    ) : (
                      <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                        send
                      </span>
                    )}
                  </button>
                </div>
              </div>

              {!selectedSkillId && (
                <p className="text-xs text-on-surface-variant mt-2 text-center opacity-70">
                  Pilih skill terlebih dahulu pada menu di atas sebelum menekan tombol kirim.
                </p>
              )}

              {selectedSkill && !selectedSkill.isActive && (
                <p className="text-xs text-amber-600 mt-2 text-center font-medium">
                  Skill terpilih tidak aktif — Aktifkan terlebih dahulu di menu kisi untuk mulai generate.
                </p>
              )}

              <div className="text-center mt-2">
                <span className="text-[11px] text-on-surface-variant opacity-70">
                  AI can make mistakes. Consider verifying important information.
                </span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Delete Modal */}
      {showDeleteId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl">
            <h3 className="text-base font-semibold text-on-surface mb-1">
              Hapus skill ini?
            </h3>
            <p className="text-sm text-on-surface-variant mb-5 leading-relaxed">
              Skill yang dihapus tidak bisa dikembalikan.{" "}
              <span className="text-error font-medium">
                Semua soal yang terkait dengan skill ini juga akan ikut dihapus.
              </span>
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteId(null)}
                className="px-4 py-2 text-sm text-on-surface-variant hover:text-on-surface transition-colors"
              >
                Batal
              </button>
              <button
                onClick={() => handleDelete(showDeleteId)}
                className="px-4 py-2 text-sm bg-error hover:opacity-90 text-white rounded-xl transition-colors font-medium"
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Chat Bubble ──────────────────────────────────────────────────────────────

function ChatBubble({ message }: { message: ChatMessage }) {
  const dateObj =
    typeof message.timestamp === "string"
      ? new Date(message.timestamp)
      : message.timestamp instanceof Date
        ? message.timestamp
        : new Date(message.timestamp);

  const timeStr = dateObj.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });

  // ─── User Request Bubble ───
  if (message.type === "request") {
    const textToShow = message.prompt || `Generate ${message.requestedCount || message.questions?.length || 1} soal`;
    return (
      <div className="flex justify-end mb-3">
        <div className="bg-secondary text-white rounded-xl rounded-tr-xs px-3.5 py-2 max-w-[75%] md:max-w-[60%] shadow-sm text-xs">
          <p className="whitespace-pre-wrap font-medium">
            {textToShow}
          </p>
          {message.images && message.images.length > 0 && (
            <div className="mt-2 space-y-1.5">
              {message.images.map((img, i) => (
                <img
                  key={i}
                  src={`data:${img.mimeType};base64,${img.data}`}
                  alt="Uploaded reference"
                  className="max-w-full max-h-36 rounded-lg border border-white/20 object-contain block"
                />
              ))}
            </div>
          )}
          <p className="text-[9px] mt-1 text-right opacity-70">
            {timeStr}
          </p>
        </div>
      </div>
    );
  }

  // ─── AI Response Bubble ───
  const isRunning =
    message.status === "PENDING" || message.status === "PROCESSING";
  const progress =
    message.requestedCount && message.requestedCount > 0
      ? Math.round(
          ((message.completedCount ?? 0) / message.requestedCount) * 100
        )
      : 0;

  return (
    <div className="flex items-start gap-2 mb-3">
      {/* AI Avatar */}
      <div className="w-7 h-7 rounded-full bg-surface-container-highest flex-shrink-0 flex items-center justify-center border border-outline-variant mt-0.5">
        <span className="material-symbols-outlined text-[14px] text-on-surface">psychology</span>
      </div>

      <div className="bg-surface border border-outline-variant rounded-xl rounded-tl-xs px-3 py-2 max-w-[85%] md:max-w-[75%] shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
        {isRunning ? (
          /* ─── Processing State ─── */
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <p className="text-xs font-semibold text-on-surface">
                Membuat {message.requestedCount} soal
              </p>
              <span className="flex gap-0.5">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="w-0.9 h-0.9 bg-secondary rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </span>
            </div>
            <div className="w-full bg-surface-container-high rounded-full h-1 overflow-hidden">
              <div
                className="bg-secondary h-1 rounded-full transition-all duration-700 ease-out"
                style={{ width: `${Math.max(progress, 2)}%` }}
              />
            </div>
            <p className="text-[10px] text-on-surface-variant">
              {message.completedCount ?? 0} dari {message.requestedCount} soal
              selesai · {progress}%
            </p>
          </div>
        ) : message.status === "COMPLETED" ? (
          /* ─── Completed with Question Cards ─── */
          <div className="space-y-2">
            <p className="text-xs text-on-surface-variant mb-2">
              Berikut adalah {message.completedCount} soal yang berhasil dibuat:
            </p>

            {message.questions && message.questions.length > 0 ? (
              message.questions.map((q, idx) => {
                const content = q.content as Record<string, unknown>;
                const options = (content.options as { key: string; value: string }[]) || [];
                const answerKey = (content.answerKey as string) || "";

                return (
                  <div
                    key={q.id}
                    className="bg-surface-container-lowest border border-outline-variant rounded-lg p-3 mb-2"
                  >
                    <div className="flex justify-between items-start mb-1.5">
                      <span className="text-xs font-bold text-secondary">
                        Soal {idx + 1}
                      </span>
                      <span className="bg-emerald-50 text-emerald-600 text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex items-center gap-1">
                        <span className="material-symbols-outlined text-[12px]">check_circle</span>
                        Ready
                      </span>
                    </div>
                    <p className="mb-2 font-semibold text-xs text-on-surface leading-normal whitespace-pre-wrap">
                      {q.questionText}
                    </p>
                    <ul className="space-y-1">
                      {options.map((opt) => (
                        <li
                          key={opt.key}
                          className={`flex items-center gap-2 p-1.5 rounded text-xs ${
                            opt.key === answerKey
                              ? "bg-surface-container-high border border-outline-variant"
                              : "border border-transparent hover:bg-surface-container-low hover:border-outline-variant"
                          } transition-colors cursor-pointer`}
                        >
                          <div
                            className={`w-4.5 h-4.5 rounded-full flex items-center justify-center text-[10px] ${
                              opt.key === answerKey
                                ? "bg-emerald-500 text-white"
                                : "border border-outline"
                            }`}
                          >
                            {opt.key}
                          </div>
                          <span
                            className={
                              opt.key === answerKey
                                ? "font-semibold text-emerald-600"
                                : ""
                            }
                          >
                            {opt.value}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-2.5 pt-2 border-t border-outline-variant flex justify-end gap-2">
                      <button className="text-on-surface-variant hover:text-secondary text-[11px] font-semibold flex items-center gap-0.5 transition-colors">
                        <span className="material-symbols-outlined text-[14px]">edit</span> Edit
                      </button>
                      <button className="text-on-surface-variant hover:text-secondary text-[11px] font-semibold flex items-center gap-0.5 transition-colors">
                        <span className="material-symbols-outlined text-[14px]">add_task</span> Add to Bank
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-4.5 h-4.5 rounded-full bg-emerald-100 flex items-center justify-center">
                    <span className="material-symbols-outlined text-emerald-600 text-xs">
                      check
                    </span>
                  </div>
                  <span className="text-xs font-bold text-emerald-700">
                    Selesai
                  </span>
                </div>
                <p className="text-xs text-on-surface mt-1.5 leading-relaxed">
                  <span className="font-semibold">
                    {message.completedCount}
                  </span>{" "}
                  soal berhasil dibuat dan masuk ke antrian review.
                </p>
              </div>
            )}
            <p className="text-[9px] text-on-surface-variant">{timeStr}</p>
          </div>
        ) : message.status === "FAILED" ? (
          /* ─── Failed State ─── */
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <div className="w-4.5 h-4.5 rounded-full bg-red-100 flex items-center justify-center">
                <span className="material-symbols-outlined text-red-600 text-xs">
                  close
                </span>
              </div>
              <span className="text-xs font-bold text-red-700">
                Generate gagal
              </span>
            </div>
            <p className="text-xs text-on-surface-variant">
              {message.errorMessage ||
                "Terjadi kesalahan saat memproses generate soal."}
            </p>
            <p className="text-[9px] text-on-surface-variant mt-1.5">
              {timeStr}
            </p>
          </div>
        ) : (
          /* ─── Unknown State ─── */
          <p className="text-sm text-on-surface-variant">
            Status tidak diketahui.
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Skill Form ──────────────────────────────────────────────────────────────

function SkillForm({
  mode,
  form,
  saving,
  error,
  onChange,
  onSubmit,
  onCancel,
}: {
  mode: "create" | "edit";
  form: FormData;
  saving: boolean;
  error: string;
  onChange: (key: keyof FormData, value: string | boolean) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <h2 className="text-xl font-bold text-on-surface">
            {mode === "create" ? "Buat Skill Baru" : "Edit Skill"}
          </h2>
        </div>

        <form onSubmit={onSubmit} className="space-y-5">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant mb-1">
                  Nama Skill *
                </label>
                <input
                  value={form.name}
                  onChange={(e) => onChange("name", e.target.value)}
                  className="w-full bg-surface border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary"
                  placeholder="Misal: Aritmatika Sosial"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant mb-1">
                  Mata Pelajaran *
                </label>
                <select
                  value={form.subject}
                  onChange={(e) => onChange("subject", e.target.value)}
                  className="w-full bg-surface border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary"
                >
                  <option value="">Pilih mapel...</option>
                  {SUBJECTS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant mb-1">
                  Kelas *
                </label>
                <select
                  value={form.gradeLevel}
                  onChange={(e) => onChange("gradeLevel", e.target.value)}
                  className="w-full bg-surface border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary"
                >
                  <option value="">Pilih kelas...</option>
                  {GRADE_LEVELS.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant mb-1">
                  Topik *
                </label>
                <input
                  value={form.topic}
                  onChange={(e) => onChange("topic", e.target.value)}
                  className="w-full bg-surface border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary"
                  placeholder="Misal: Diskon, Pajak, Bunga"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => onChange("isActive", e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-secondary"></div>
              </label>
              <span className="text-xs text-on-surface-variant">
                Skill Aktif
              </span>
            </div>
          </div>

          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-on-surface-variant mb-1">
                System Prompt
              </label>
              <textarea
                value={form.systemPrompt}
                onChange={(e) => onChange("systemPrompt", e.target.value)}
                className="w-full bg-surface border border-outline-variant rounded-lg px-3 py-2 text-sm font-mono text-on-surface focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary"
                rows={6}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-on-surface-variant mb-1">
                Reference Context
              </label>
              <textarea
                value={form.referenceContext}
                onChange={(e) => onChange("referenceContext", e.target.value)}
                className="w-full bg-surface border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary"
                rows={8}
                placeholder="Masukkan materi referensi untuk pembuatan soal..."
              />
            </div>
          </div>

          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm text-on-surface-variant bg-surface-container-low border border-outline-variant rounded-xl hover:bg-surface-container-high transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm bg-secondary text-white rounded-xl hover:opacity-90 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving
                ? "Menyimpan..."
                : mode === "create"
                  ? "Buat Skill"
                  : "Simpan Perubahan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
