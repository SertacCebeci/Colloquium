import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5001";

interface Props {
  children: ReactNode;
}

export function RequireAuth({ children }: Props) {
  const navigate = useNavigate();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/api/auth/me`, { credentials: "include" })
      .then((r) => {
        if (!r.ok) {
          navigate("/login", { replace: true });
        }
        setChecked(true);
      })
      .catch(() => {
        navigate("/login", { replace: true });
        setChecked(true);
      });
  }, [navigate]);

  if (!checked) return null;
  return <>{children}</>;
}
