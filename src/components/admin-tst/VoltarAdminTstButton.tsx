import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export function VoltarAdminTstButton() {
  const navigate = useNavigate();
  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/admin-tst");
    }
  };
  return (
    <Button onClick={handleBack} variant="outline" size="sm" className="gap-2">
      <ArrowLeft className="w-4 h-4" />
      Voltar
    </Button>
  );
}