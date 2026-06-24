import { useEffect, useState, useCallback } from "react";
import { fetchSkills, type Skill } from "../api/skills";
import {
  fetchUnpublishedQuestions,
  publishQuestionsBatch,
  deleteQuestionsBatch,
  type ListQuestionsResponse,
} from "../api/questions";
import {
  fetchTemplates,
  createTemplate,
  fetchExportedIds,
  startExport,
  getExportStatus,
  type ExportTemplate,
  type ColumnMapping,
} from "../api/export";

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: "Mudah",
  medium: "Sedang",
  hard: "Sulit",
};

export default function BankSoalUnpublished() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [data, setData] = useState<ListQuestionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters
  const [subjectFilter, setSubjectFilter] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState("");
  const [searchFilter, setSearchFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(0);
  const pageSize = 25;

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Export
  const [templates, setTemplates] = useState<ExportTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [exportLogId, setExportLogId] = useState<string | null>(null);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [exportError, setExportError] = useState("");
  const [exporting, setExporting] = useState(false);

  // Publish
  const [publishing, setPublishing] = useState(false);
  const [publishSuccess, setPublishSuccess] = useState<string | null>(null);

  const subjects = [...new Set(skills.map((s) => s.subject))].sort();

  useEffect(() => {
    fetchSkills()
      .then(setSkills)
      .catch(() => {});
    fetchTemplates()
      .then(async (ts) => {
        if (ts.length > 0) {
          setTemplates(ts);
          setSelectedTemplateId(ts[0].id);
        } else {
          const defaultMapping: ColumnMapping[] = [
            { excelColumn: "SOAL", label: "SOAL", sourceField: "questionText" },
            { excelColumn: "OPSI_A", label: "OPSI A", sourceField: "content.options[0]" },
            { excelColumn: "OPSI_B", label: "OPSI B", sourceField: "content.options[1]" },
            { excelColumn: "OPSI_C", label: "OPSI C", sourceField: "content.options[2]" },
            { excelColumn: "OPSI_D", label: "OPSI D", sourceField: "content.options[3]" },
            { excelColumn: "OPSI_E", label: "OPSI E", sourceField: "content.options[4]" },
            { excelColumn: "KUNCI_JAWABAN", label: "KUNCI JAWABAN", sourceField: "content.answerKey" },
            { excelColumn: "PEMBAHASAN", label: "PEMBAHASAN", sourceField: "content.explanation" },
          ];
          try {
            const created = await createTemplate("Default Export", defaultMapping);
            setTemplates([created]);
            setSelectedTemplateId(created.id);
          } catch {
            setTemplates([]);
          }
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadQuestions();
  }, [subjectFilter, difficultyFilter, searchFilter, dateFrom, dateTo, page]);

  useEffect(() => {
    if (data) setSelectedIds(new Set());
  }, [data]);

  async function loadQuestions() {
    try {
      setLoading(true);
      setError("");
      const result = await fetchUnpublishedQuestions({
        subject: subjectFilter || undefined,
        difficulty: difficultyFilter || undefined,
        search: searchFilter || undefined,
        startDate: dateFrom || undefined,
        endDate: dateTo || undefined,
        limit: pageSize,
        offset: page * pageSize,
      });
      setData(result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const totalPages = data ? Math.ceil(data.total / pageSize) : 0;

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (!data) return;
    if (selectedIds.size === data.questions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(data.questions.map((q) => q.id)));
    }
  }

  async function selectAllAcrossPages() {
    try {
      setError("");
      const [result, exportedIds] = await Promise.all([
        fetchUnpublishedQuestions({
          subject: subjectFilter || undefined,
          difficulty: difficultyFilter || undefined,
          search: searchFilter || undefined,
          startDate: dateFrom || undefined,
          endDate: dateTo || undefined,
          limit: data?.total || 10000,
          offset: 0,
        }),
        fetchExportedIds(),
      ]);
      const exportedSet = new Set(exportedIds);
      const unexported = result.questions.filter((q) => !exportedSet.has(q.id));
      setSelectedIds(new Set(unexported.map((q) => q.id)));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleExport() {
    if (!selectedTemplateId || selectedIds.size === 0) return;
    setExporting(true);
    setExportError("");
    setExportStatus(null);
    setExportLogId(null);
    try {
      const res = await startExport(selectedTemplateId, [...selectedIds]);
      setExportLogId(res.logId);
      setExportStatus("PROCESSING");
      pollExportStatus(res.logId);
    } catch (e) {
      setExportError((e as Error).message);
      setExporting(false);
    }
  }

  function pollExportStatus(logId: string) {
    const interval = setInterval(async () => {
      try {
        const res = await getExportStatus(logId);
        setExportStatus(res.status);
        if (res.status === "COMPLETED" || res.status === "FAILED") {
          clearInterval(interval);
          setExporting(false);
          if (res.status === "FAILED") setExportError(res.error || "Export gagal");
        }
      } catch {
        clearInterval(interval);
        setExporting(false);
        setExportError("Gagal mengecek status export");
      }
    }, 1500);
  }

  const handleDownload = useCallback(async (logId: string) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/export/download/${logId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Gagal mengunduh");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `soal_${Date.now()}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      setExportError((e as Error).message);
    }
  }, []);

  async function handlePublishSelected() {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Publish ${selectedIds.size} soal yang dipilih ke Bank Soal Published?`)) return;
    try {
      setPublishing(true);
      setError("");
      setPublishSuccess(null);
      const res = await publishQuestionsBatch([...selectedIds]);
      setPublishSuccess(`${res.count} soal berhasil dipublish!`);
      setSelectedIds(new Set());
      await loadQuestions();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPublishing(false);
    }
  }

  async function handleDeleteSelected() {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Hapus permanen ${selectedIds.size} soal yang dipilih? Tindakan ini tidak bisa dibatalkan.`)) return;
    try {
      setLoading(true);
      setError("");
      await deleteQuestionsBatch([...selectedIds]);
      setSelectedIds(new Set());
      setPage(0);
      await loadQuestions();
    } catch (e) {
      setError((e as Error).message);
      setLoading(false);
    }
  }

  async function handleDeleteAllMatching() {
    if (!data || data.total === 0) return;
    if (!window.confirm(`Hapus permanen SEMUA (${data.total}) soal yang sesuai dengan filter saat ini? Tindakan ini tidak bisa dibatalkan.`)) return;
    try {
      setLoading(true);
      setError("");
      const result = await fetchUnpublishedQuestions({
        subject: subjectFilter || undefined,
        difficulty: difficultyFilter || undefined,
        search: searchFilter || undefined,
        startDate: dateFrom || undefined,
        endDate: dateTo || undefined,
        limit: data.total,
        offset: 0,
      });
      const allIds = result.questions.map((q) => q.id);
      if (allIds.length > 0) {
        await deleteQuestionsBatch(allIds);
      }
      setSelectedIds(new Set());
      setPage(0);
      await loadQuestions();
    } catch (e) {
      setError((e as Error).message);
      setLoading(false);
    }
  }

  return (
    <div className="max-w-7xl mx-auto w-full flex flex-col gap-6">
      {/* Header Section inside Canvas */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#191b23] font-headline-lg">
            Bank Soal (Unpublished)
          </h1>
          <p className="text-sm text-[#434654] mt-1 font-body-md">
            Soal yang sudah di-review human. Export ke Excel, lalu publish ke Bank Soal Published.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={selectedTemplateId}
            onChange={(e) => setSelectedTemplateId(e.target.value)}
            className="border border-[#c3c6d6] rounded-lg bg-white py-2 px-3 text-sm focus:border-[#003d9b] focus:ring-1 focus:ring-[#003d9b] outline-none text-[#191b23] font-medium"
          >
            {templates.length === 0 && (
              <option value="">Tidak ada template</option>
            )}
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>

          <button
            disabled={selectedIds.size === 0 || publishing}
            onClick={handlePublishSelected}
            className="bg-[#6bff8f] text-[#002109] font-semibold px-4 py-2 rounded-lg flex items-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed text-sm shadow-sm"
          >
            <span className="material-symbols-outlined text-sm font-semibold">check</span>
            {publishing ? "Publishing..." : `Publish (${selectedIds.size})`}
          </button>

          <button
            disabled={selectedIds.size === 0 || exporting || templates.length === 0}
            onClick={handleExport}
            className="bg-[#0052cc] text-white font-semibold px-4 py-2 rounded-lg flex items-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed text-sm shadow-sm"
          >
            <span className="material-symbols-outlined text-sm font-semibold">download</span>
            {exporting ? "Exporting..." : `Export (${selectedIds.size})`}
          </button>
        </div>
      </div>

      {/* Publish success */}
      {publishSuccess && (
        <div className="bg-[#6bff8f]/10 border border-[#6bff8f]/30 text-[#002109] text-sm px-4 py-3 rounded-xl flex items-center justify-between">
          <span>{publishSuccess}</span>
          <button
            onClick={() => setPublishSuccess(null)}
            className="text-[#005321] hover:text-[#002109] text-xs font-semibold"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Export status */}
      {exportStatus === "COMPLETED" && exportLogId && (
        <div className="bg-[#6bff8f]/10 border border-[#6bff8f]/30 text-[#002109] text-sm px-4 py-3 rounded-xl flex items-center justify-between">
          <span>Export selesai. File siap diunduh.</span>
          <button
            onClick={() => handleDownload(exportLogId!)}
            className="bg-[#006e2f] hover:bg-[#005321] text-white px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors"
          >
            Download
          </button>
        </div>
      )}

      {exportStatus === "FAILED" && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
          Export gagal: {exportError}
        </div>
      )}

      {exportError && !exportStatus && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
          {exportError}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
          {error}
        </div>
      )}

      {/* Filter Card */}
      <div className="bg-white border border-[#c3c6d6] rounded-xl p-6 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-4 items-end">
          <div className="flex flex-col gap-1.5 lg:col-span-2">
            <label className="text-sm font-semibold text-[#434654]">Mapel</label>
            <select
              value={subjectFilter}
              onChange={(e) => {
                setSubjectFilter(e.target.value);
                setPage(0);
              }}
              className="border border-[#c3c6d6] rounded-lg bg-[#faf8ff] py-2 px-3 text-sm w-full focus:border-[#003d9b] focus:ring-1 focus:ring-[#003d9b] outline-none text-[#191b23]"
            >
              <option value="">Semua Mapel</option>
              {subjects.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-[#434654]">Kesulitan</label>
            <select
              value={difficultyFilter}
              onChange={(e) => {
                setDifficultyFilter(e.target.value);
                setPage(0);
              }}
              className="border border-[#c3c6d6] rounded-lg bg-[#faf8ff] py-2 px-3 text-sm w-full focus:border-[#003d9b] focus:ring-1 focus:ring-[#003d9b] outline-none text-[#191b23]"
            >
              <option value="">Semua</option>
              {Object.entries(DIFFICULTY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5 lg:col-span-2">
            <label className="text-sm font-semibold text-[#434654]">Cari</label>
            <div className="relative w-full">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                search
              </span>
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => {
                  setSearchFilter(e.target.value);
                  setPage(0);
                }}
                placeholder="Cari teks soal..."
                className="border border-[#c3c6d6] rounded-lg bg-[#faf8ff] py-2 pl-9 pr-3 text-sm w-full focus:border-[#003d9b] focus:ring-1 focus:ring-[#003d9b] outline-none text-[#191b23]"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-[#434654]">Dari</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(0);
              }}
              className="border border-[#c3c6d6] rounded-lg bg-[#faf8ff] py-2 px-3 text-sm w-full focus:border-[#003d9b] focus:ring-1 focus:ring-[#003d9b] outline-none text-[#191b23]"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-[#434654]">Sampai</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(0);
              }}
              className="border border-[#c3c6d6] rounded-lg bg-[#faf8ff] py-2 px-3 text-sm w-full focus:border-[#003d9b] focus:ring-1 focus:ring-[#003d9b] outline-none text-[#191b23]"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-gray-500 font-semibold animate-pulse">Memuat data...</p>
        </div>
      ) : !data || data.questions.length === 0 ? (
        <div className="text-center py-12 text-gray-400 bg-white border border-[#c3c6d6] rounded-xl shadow-sm">
          <span className="material-symbols-outlined text-4xl mb-2 text-gray-300">database</span>
          <p className="text-lg font-semibold text-gray-700">Belum ada soal unpublished</p>
          <p className="text-sm mt-1">
            Soal yang sudah di-review human akan muncul di sini.
          </p>
        </div>
      ) : (
        <>
          {/* Table Actions */}
          <div className="flex justify-between items-center mt-2 flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <span className="text-sm text-[#434654] font-semibold">{data.total} soal</span>
              {data.total > pageSize && selectedIds.size < data.total && (
                <button
                  onClick={selectAllAcrossPages}
                  className="text-xs text-[#003d9b] hover:text-[#001848] font-bold transition-colors"
                >
                  Pilih soal yang belum di-export ({data.total} total)
                </button>
              )}
            </div>
            <div className="flex gap-2">
              {selectedIds.size > 0 && (
                <button
                  onClick={handleDeleteSelected}
                  className="text-[#ba1a1a] bg-[#ffdad6]/40 hover:bg-[#ffdad6]/60 font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors text-xs"
                >
                  <span className="material-symbols-outlined text-[16px]">delete</span>
                  Hapus Terpilih ({selectedIds.size})
                </button>
              )}
              <button
                onClick={handleDeleteAllMatching}
                className="text-[#ba1a1a] bg-[#ffdad6]/40 hover:bg-[#ffdad6]/60 font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors text-xs"
              >
                <span className="material-symbols-outlined text-[16px]">delete_sweep</span>
                Hapus Semua ({data.total})
              </button>
            </div>
          </div>

          {/* Data Table Card */}
          <div className="bg-white border border-[#c3c6d6] rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="bg-[#f3f3fd] border-b border-[#c3c6d6]">
                    <th className="p-4 w-12">
                      <input
                        type="checkbox"
                        checked={data.questions.length > 0 && selectedIds.size === data.questions.length}
                        onChange={toggleSelectAll}
                        className="rounded border-[#c3c6d6] text-[#003d9b] focus:ring-[#003d9b]"
                      />
                    </th>
                    <th className="p-4 text-xs font-bold text-[#434654] uppercase tracking-wider">Soal</th>
                    <th className="p-4 text-xs font-bold text-[#434654] uppercase tracking-wider w-24">Kesulitan</th>
                    <th className="p-4 text-xs font-bold text-[#434654] uppercase tracking-wider w-56">Mapel / Kelas</th>
                    <th className="p-4 text-xs font-bold text-[#434654] uppercase tracking-wider w-32">Status</th>
                    <th className="p-4 text-xs font-bold text-[#434654] uppercase tracking-wider w-44">Tags</th>
                    <th className="p-4 text-xs font-bold text-[#434654] uppercase tracking-wider w-32">Tgl Review</th>
                  </tr>
                </thead>
                <tbody className="text-sm text-[#191b23] divide-y divide-[#c3c6d6]/50">
                  {data.questions.map((q) => (
                    <tr
                      key={q.id}
                      onClick={() => toggleSelect(q.id)}
                      className={`hover:bg-[#f3f3fd]/40 transition-colors group cursor-pointer ${
                        selectedIds.has(q.id) ? "bg-[#dae2ff]/10" : ""
                      }`}
                    >
                      <td className="p-4 align-top" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(q.id)}
                          onChange={() => toggleSelect(q.id)}
                          className="rounded border-[#c3c6d6] text-[#003d9b] focus:ring-[#003d9b] mt-1"
                        />
                      </td>
                      <td className="p-4 align-top">
                        <div className="line-clamp-2 text-gray-700 font-medium leading-relaxed">
                          {q.questionText}
                        </div>
                      </td>
                      <td className="p-4 align-top font-medium text-gray-600">
                        {DIFFICULTY_LABELS[q.difficulty] || q.difficulty}
                      </td>
                      <td className="p-4 align-top text-[#434654]">
                        <div className="font-semibold text-[#191b23]">
                          {q.skill ? q.skill.name : "-"}
                        </div>
                        <div className="text-[12px] mt-1 text-gray-500 font-medium">
                          ({q.skill ? q.skill.subject : "-"})
                        </div>
                      </td>
                      <td className="p-4 align-top">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#ffdbcf] text-[#380d00]">
                          Unpublished
                        </span>
                      </td>
                      <td className="p-4 align-top">
                        <div className="flex flex-wrap gap-1">
                          {(q.tags || []).slice(0, 3).map((tag) => (
                            <span
                              key={tag}
                              className="bg-[#e1e2ec] text-[#434654] px-2 py-1 rounded text-[11px] leading-tight font-medium"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-4 align-top text-[#434654] font-medium">
                        {new Date(q.updatedAt).toLocaleDateString("id-ID")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="px-4 py-2 text-xs font-semibold bg-white border border-[#c3c6d6] text-[#434654] rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
              >
                Sebelumnya
              </button>
              <span className="text-xs font-bold text-gray-500 px-2">
                {page + 1} / {totalPages}
              </span>
              <button
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
                className="px-4 py-2 text-xs font-semibold bg-white border border-[#c3c6d6] text-[#434654] rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
              >
                Selanjutnya
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
