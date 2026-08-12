import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/")({
  component: () => {
    const navigate = Route.useNavigate();
    useEffect(() => {
      navigate({ to: "/catalogo", replace: true });
    }, [navigate]);
    return null;
  },
});
