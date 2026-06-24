import { Routes, Route, NavLink, Navigate, useLocation, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ChatProvider, useChat } from "./contexts/ChatContext";
import { fetchSkills, type Skill } from "./api/skills";
import { useState, useEffect } from "react";
import GeneratorChat from "./pages/GeneratorChat";
import Review from "./pages/Review";
import BankSoal from "./pages/BankSoal";
import BankSoalUnpublished from "./pages/BankSoalUnpublished";
import Login from "./pages/Login";
import ProtectedRoute from "./components/ProtectedRoute";

const roleLabels: Record<string, string> = {
  ADMIN: "Admin",
  OPERATOR_GENERATE: "Operator",
  REVIEWER: "Reviewer",
};

const pageTitles: Record<string, string> = {
  "/generate": "Generator Soal",
  "/review-ai": "Review AI",
  "/review-human": "Review Human",
  "/bank-soal-unpublished": "Bank Soal (Unpublished)",
  "/bank-soal-published": "Bank Soal (Published)",
};

function AppLayout() {
  const { user, logout } = useAuth();
  const {
    sessions,
    activeSessionId,
    setActiveSessionId,
    setSelectedSkillId,
    setCount,
    deleteSession,
  } = useChat();

  const location = useLocation();
  const navigate = useNavigate();
  const isGeneratePage = location.pathname === "/generate";

  const [skills, setSkills] = useState<Skill[]>([]);

  useEffect(() => {
    fetchSkills()
      .then(setSkills)
      .catch(() => {});
  }, []);

  const currentTitle = pageTitles[location.pathname] || "Generator Soal";

  return (
    <div className="flex overflow-hidden h-screen bg-surface-container-lowest text-on-surface">
      {/* ─── Sidebar ─── */}
      <nav className="hidden md:flex h-screen w-64 flex-col fixed left-0 top-0 p-4 border-r border-outline-variant bg-surface z-20">
        {/* Brand Header */}
        <div className="flex items-center gap-2 mb-8">
          <img
            src="/stubiabrandicon.png"
            alt="Stubia Soal Logo"
            className="w-10 h-10 object-contain rounded-lg"
          />
          <div>
            <h1 className="font-bold text-on-surface leading-none text-base">Stubia Soal</h1>
            <p className="text-[11px] text-on-surface-variant mt-0.5">Platform Generator Soal</p>
          </div>
        </div>

        {/* CTA Button */}
        <button
          onClick={() => {
            setActiveSessionId(null);
            setSelectedSkillId(null);
            setCount(5);
            navigate("/generate");
          }}
          className="w-full bg-secondary text-white text-sm font-medium py-2.5 px-4 rounded-lg mb-6 hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined text-[20px]">add</span>
          Create New Quiz
        </button>

        {/* Main Navigation */}
        <div className="flex flex-col gap-1 flex-grow">
          <NavLink
            to="/generate"
            end
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-sm font-medium ${
                isActive
                  ? "bg-secondary text-white shadow-sm"
                  : "text-on-surface-variant hover:bg-surface-container-high"
              }`
            }
          >
            <span className="material-symbols-outlined text-[20px]">psychology</span>
            Generator Soal
          </NavLink>
          <NavLink
            to="/review-ai"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-sm font-medium ${
                isActive
                  ? "bg-secondary text-white shadow-sm"
                  : "text-on-surface-variant hover:bg-surface-container-high"
              }`
            }
          >
            <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
            Review AI
          </NavLink>
          <NavLink
            to="/review-human"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-sm font-medium ${
                isActive
                  ? "bg-secondary text-white shadow-sm"
                  : "text-on-surface-variant hover:bg-surface-container-high"
              }`
            }
          >
            <span className="material-symbols-outlined text-[20px]">person_search</span>
            Review Human
          </NavLink>
          <NavLink
            to="/bank-soal-unpublished"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-sm font-medium ${
                isActive
                  ? "bg-secondary text-white shadow-sm"
                  : "text-on-surface-variant hover:bg-surface-container-high"
              }`
            }
          >
            <span className="material-symbols-outlined text-[20px]">inventory_2</span>
            Bank Soal (Unpublished)
          </NavLink>
          <NavLink
            to="/bank-soal-published"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-sm font-medium ${
                isActive
                  ? "bg-secondary text-white shadow-sm"
                  : "text-on-surface-variant hover:bg-surface-container-high"
              }`
            }
          >
            <span className="material-symbols-outlined text-[20px]">database</span>
            Bank Soal (Published)
          </NavLink>

          {/* Chat History Section (Generate page only) */}
          {isGeneratePage && (
            <div className="flex-grow flex flex-col min-h-0 mt-5 pt-4 border-t border-outline-variant/30">
              <span className="text-[10px] text-on-surface-variant uppercase tracking-widest pl-1 mb-2 font-bold opacity-60 flex-shrink-0">
                Riwayat Chat
              </span>

              <div className="flex-1 overflow-y-auto custom-scrollbar space-y-0.5 pr-1">
                {sessions.length === 0 ? (
                  <div className="text-center py-6">
                    <p className="text-xs text-on-surface-variant opacity-50 italic">
                      Belum ada riwayat
                    </p>
                  </div>
                ) : (
                  sessions.map((session) => {
                    const isSessionActive = session.id === activeSessionId;
                    const skill = skills.find((s) => s.id === session.skillId);

                    return (
                      <div
                        key={session.id}
                        onClick={() => {
                          setActiveSessionId(session.id);
                          setSelectedSkillId(session.skillId);
                          setCount(session.count || 5);
                          navigate("/generate");
                        }}
                        className={`group relative flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer transition-all duration-150 ${
                          isSessionActive
                            ? "bg-surface-container-high text-secondary font-medium"
                            : "text-on-surface-variant hover:bg-surface-container-high/60"
                        }`}
                      >
                        <span
                          className={`material-symbols-outlined text-[16px] flex-shrink-0 ${
                            isSessionActive ? "text-secondary font-semibold" : "text-on-surface-variant/80"
                          }`}
                        >
                          chat
                        </span>

                        <div className="flex-1 min-w-0 pr-4">
                          <p className="text-xs truncate leading-snug font-medium">
                            {session.title || "Percakapan"}
                          </p>
                          <p className="text-[9px] text-on-surface-variant/60 truncate mt-0.5">
                            {skill ? skill.name : "Skill Terhapus"}
                          </p>
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteSession(session.id);
                          }}
                          className="absolute right-1.5 opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-surface-container-highest text-on-surface-variant hover:text-error transition-all"
                          title="Hapus riwayat"
                        >
                          <span className="material-symbols-outlined text-[14px]">
                            delete
                          </span>
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-col gap-1 mt-auto pt-4 border-t border-outline-variant/30 flex-shrink-0">
          <div className="flex items-center gap-3 px-3 py-3">
            <div className="w-8 h-8 rounded-full bg-secondary-container flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-white text-sm">
                person
              </span>
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-semibold truncate text-on-surface">
                {user?.name || "User"}
              </p>
              <p className="text-[10px] text-on-surface-variant opacity-75 truncate">
                {roleLabels[user?.role ?? ""] || user?.role || "User"}
              </p>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs text-on-surface-variant hover:bg-surface-container-high transition-colors duration-200"
          >
            <span className="material-symbols-outlined text-[16px]">logout</span>
            <span className="font-semibold">Logout</span>
          </button>
        </div>
      </nav>

      {/* ─── Main Content ─── */}
      <main className="flex-1 flex flex-col md:ml-64 relative bg-surface-container-lowest w-full h-full">
        {/* TopNavBar */}
        <header className="w-full h-16 bg-surface-container-lowest border-b border-outline-variant flex justify-between items-center px-6 flex-shrink-0 z-10 sticky top-0">
          {/* Mobile Brand / Menu */}
          <div className="flex md:hidden items-center gap-2">
            <button className="p-2 text-on-surface-variant hover:bg-surface-container-low rounded-full transition-colors">
              <span className="material-symbols-outlined">menu</span>
            </button>
            <img
              src="/stubiabrandicon.png"
              alt="Stubia Soal Logo"
              className="w-6 h-6 object-contain rounded-md"
            />
            <span className="font-bold text-on-surface">Stubia Soal</span>
          </div>

          {/* Desktop Breadcrumb */}
          <div className="hidden md:flex items-center gap-2 text-sm text-on-surface-variant">
            <span>Workspace</span>
            <span className="material-symbols-outlined text-[16px]">chevron_right</span>
            <span className="font-bold text-secondary">{currentTitle}</span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button className="p-2 text-on-surface-variant hover:bg-surface-container-low transition-colors rounded-full">
              <span className="material-symbols-outlined">notifications</span>
            </button>
            <button className="p-2 text-on-surface-variant hover:bg-surface-container-low transition-colors rounded-full">
              <span className="material-symbols-outlined">help</span>
            </button>
            <div className="w-8 h-8 rounded-full bg-surface-container-high ml-2 border border-outline-variant overflow-hidden flex items-center justify-center">
              <span className="material-symbols-outlined text-on-surface-variant text-[18px]">person</span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <Routes>
            <Route path="/" element={<Navigate to="/generate" replace />} />
            <Route
              path="/generate"
              element={
                <ProtectedRoute>
                  <GeneratorChat />
                </ProtectedRoute>
              }
            />
            <Route
              path="/review-ai"
              element={
                <ProtectedRoute roles={["ADMIN", "REVIEWER"]}>
                  <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                    <Review key="ai" type="ai" />
                  </div>
                </ProtectedRoute>
              }
            />
            <Route
              path="/review-human"
              element={
                <ProtectedRoute roles={["ADMIN", "REVIEWER"]}>
                  <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                    <Review key="human" type="human" />
                  </div>
                </ProtectedRoute>
              }
            />
            <Route
              path="/bank-soal-unpublished"
              element={
                <ProtectedRoute>
                  <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                    <BankSoalUnpublished />
                  </div>
                </ProtectedRoute>
              }
            />
            <Route
              path="/bank-soal-published"
              element={
                <ProtectedRoute>
                  <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                    <BankSoal />
                  </div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ChatProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/*" element={<AppLayout />} />
        </Routes>
      </ChatProvider>
    </AuthProvider>
  );
}
