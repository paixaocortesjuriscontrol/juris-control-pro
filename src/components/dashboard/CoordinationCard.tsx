import { Users, Briefcase } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface TeamMember {
  name: string;
  avatar?: string;
  initials: string;
}

interface CoordinationCardProps {
  name: string;
  coordinator: string;
  coordinatorInitials: string;
  processCount: number;
  distributedCount?: number;
  teamMembers: TeamMember[];
  area: string; // Agora aceita qualquer área
  delay?: number;
}

const areaColors: Record<string, string> = {
  civil: "border-l-area-civil",
  trabalhista: "border-l-area-trabalhista",
  empresarial: "border-l-area-empresarial",
  direito_privado: "border-l-amber-500",
};

const getAreaBorderColor = (area: string): string => {
  return areaColors[area] || "border-l-primary";
};

export function CoordinationCard({
  name,
  coordinator,
  coordinatorInitials,
  processCount,
  distributedCount = 0,
  teamMembers,
  area,
  delay = 0,
}: CoordinationCardProps) {
  const notDistributed = processCount - distributedCount;
  return (
    <div 
      className={cn(
        "bg-card rounded-xl p-5 border border-border/50 border-l-4 shadow-soft hover:shadow-medium transition-all duration-300 animate-slide-up",
        getAreaBorderColor(area)
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-serif text-lg font-semibold text-foreground">{name}</h3>
          <div className="flex items-center gap-2 mt-1">
            <Avatar className="w-6 h-6">
              <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                {coordinatorInitials}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm text-muted-foreground">{coordinator}</span>
          </div>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-1.5 text-muted-foreground justify-end">
            <Briefcase className="w-4 h-4" />
            <span className="font-semibold text-foreground">{processCount}</span>
          </div>
          {processCount > 0 && (
            <div className="text-xs text-muted-foreground mt-0.5">
              <span className="text-green-600">{distributedCount}</span> / <span className="text-orange-500">{notDistributed}</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-border/50">
        <div className="flex items-center gap-1">
          <Users className="w-4 h-4 text-muted-foreground mr-1" />
          <div className="flex -space-x-2">
            {teamMembers.slice(0, 4).map((member, index) => (
              <Avatar key={index} className="w-7 h-7 border-2 border-card">
                <AvatarImage src={member.avatar} />
                <AvatarFallback className="text-xs bg-secondary text-secondary-foreground">
                  {member.initials}
                </AvatarFallback>
              </Avatar>
            ))}
            {teamMembers.length > 4 && (
              <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-xs font-medium text-secondary-foreground border-2 border-card">
                +{teamMembers.length - 4}
              </div>
            )}
          </div>
        </div>
        <span className="text-xs text-muted-foreground">
          {teamMembers.length} membros
        </span>
      </div>
    </div>
  );
}
