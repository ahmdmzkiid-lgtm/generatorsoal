import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function ProtectedRoute({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  const { user, token, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white">
        <div className="relative flex items-center justify-center">
          {/* Pulsing ring */}
          <div className="absolute w-16 h-16 rounded-full border-4 border-blue-100 animate-ping"></div>
          {/* Spinner ring */}
          <div className="w-16 h-16 rounded-full border-4 border-blue-600 border-t-transparent animate-spin"></div>
          {/* Logo inside */}
          <img
            src="/stubiabrandicon.png"
            alt="Loading..."
            className="absolute w-10 h-10 object-contain rounded-md"
          />
        </div>
        <p className="text-gray-500 text-sm font-medium mt-6 animate-pulse">Memuat Stubia Soal...</p>
      </div>
    );
  }

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/generate" replace />;
  }

  return <>{children}</>;
}
