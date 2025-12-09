import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface CoordDistribution {
  nome: string;
  total: number;
  distribuidos: number;
  naoDistribuidos: number;
  area: "civil" | "trabalhista" | "empresarial";
}

interface ProcessosDistribuicaoChartProps {
  data: CoordDistribution[];
}

const areaColors = {
  civil: "hsl(217 91% 60%)",      // Azul vibrante
  trabalhista: "hsl(142 76% 36%)", // Verde escuro
  empresarial: "hsl(262 83% 58%)", // Roxo vibrante
};

const naoDistribuidoColor = "hsl(215 25% 65%)"; // Cinza azulado

export function ProcessosDistribuicaoChart({ data }: ProcessosDistribuicaoChartProps) {
  if (!data || data.length === 0) {
    return null;
  }

  return (
    <Card className="animate-slide-up">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-serif">Processos por Coordenação</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
              barGap={2}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
              <XAxis 
                dataKey="nome" 
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: "hsl(var(--border))" }}
              />
              <YAxis 
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: "hsl(var(--border))" }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: "hsl(var(--card))", 
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px"
                }}
                labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600 }}
              />
              <Legend 
                wrapperStyle={{ fontSize: "12px" }}
                formatter={(value) => <span className="text-muted-foreground">{value}</span>}
              />
              <Bar 
                dataKey="distribuidos" 
                name="Distribuídos" 
                stackId="a"
                radius={[0, 0, 0, 0]}
                label={{ 
                  position: 'center', 
                  fill: '#fff', 
                  fontSize: 11, 
                  fontWeight: 600,
                  formatter: (value: number) => value > 0 ? value : ''
                }}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-dist-${index}`} fill={areaColors[entry.area]} />
                ))}
              </Bar>
              <Bar 
                dataKey="naoDistribuidos" 
                name="Não Distribuídos" 
                stackId="a"
                radius={[4, 4, 0, 0]}
                fill={naoDistribuidoColor}
                label={{ 
                  position: 'center', 
                  fill: '#fff', 
                  fontSize: 11, 
                  fontWeight: 600,
                  formatter: (value: number) => value > 0 ? value : ''
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
