import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export function VoltarAdminTstButton() {
  return (
    <Button asChild variant="outline" size="sm" className="gap-2">
      <Link to="/admin-tst">
        <ArrowLeft className="w-4 h-4" />
        Admin. TST
      </Link>
    </Button>
  );
}