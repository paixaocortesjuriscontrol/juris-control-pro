import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { Newspaper, Radar, RefreshCw, FileWarning, Globe } from "lucide-react";

const monitoracaoCards = [
  {
    title: "Monitoramento DJEN",
    description: "Acompanhe publicações do Diário de Justiça Eletrônico Nacional por OAB, nome ou número de processo",
    icon: Newspaper,
    path: "/monitoramento-djen",
    color: "from-blue-500 to-blue-600",
  },
  {
    title: "Monitoramento Distribuição",
    description: "Monitore novas distribuições de processos nos tribunais antes da citação oficial",
    icon: Globe,
    path: "/monitoramento-distribuicao",
    color: "from-green-500 to-green-600",
  },
  {
    title: "Monitoração 360°",
    description: "Varredura estratégica de termos em movimentações processuais com alertas automáticos",
    icon: Radar,
    path: "/monitoramento-360",
    color: "from-purple-500 to-purple-600",
  },
  {
    title: "Capturas Intimações",
    description: "Configure coletas automáticas de intimações nos portais PJe, eSAJ e Projudi",
    icon: FileWarning,
    path: "/capturas-intimacoes",
    color: "from-orange-500 to-orange-600",
  },
  {
    title: "Redistribuições",
    description: "Acompanhe redistribuições de processos entre varas e juízos",
    icon: RefreshCw,
    path: "/redistribuicoes",
    color: "from-rose-500 to-rose-600",
  },
];

export default function MonitoracaoHub() {
  const navigate = useNavigate();

  return (
    <MainLayout title="Central de Monitoração" subtitle="Gerencie todos os monitoramentos automatizados do sistema">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {monitoracaoCards.map((card) => (
          <Card
            key={card.path}
            className="cursor-pointer hover:shadow-lg transition-all duration-300 hover:-translate-y-1 group overflow-hidden"
            onClick={() => navigate(card.path)}
          >
            <div className={`h-2 bg-gradient-to-r ${card.color}`} />
            <CardHeader className="pb-3">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl bg-gradient-to-br ${card.color} text-white shadow-lg group-hover:scale-110 transition-transform`}>
                  <card.icon className="w-6 h-6" />
                </div>
                <CardTitle className="text-lg">{card.title}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-sm leading-relaxed">
                {card.description}
              </CardDescription>
            </CardContent>
          </Card>
        ))}
      </div>
    </MainLayout>
  );
}
