import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend, LabelList } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface CoordDistribution {
  nome: string;
  total: number;
  distribuidos: number;
  naoDistribuidos: number;
  area: string;
}

interface ProcessosDistribuicaoChartProps {
  data: CoordDistribution[];
}

const areaColors: Record<string, string> = {
  civil: "hsl(217 91% 60%)",
  trabalhista: "hsl(142 76% 36%)",
  empresarial: "hsl(262 83% 58%)",
  direito_privado: "hsl(38 92% 50%)",
};

const getAreaColor = (area: string): string => {
  return areaColors[area] || "hsl(215 25% 45%)";
};

const naoDistribuidoColor = "hsl(215 25% 65%)";

// Custom tooltip with total
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null;
  
  const distribuidos = payload.find((p: any) => p.dataKey === 'distribuidos')?.value || 0;
  const naoDistribuidos = payload.find((p: any) => p.dataKey === 'naoDistribuidos')?.value || 0;
  const total = distribuidos + naoDistribuidos;
  
  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
      <p className="font-semibold text-foreground mb-2">{label}</p>
      <div className="space-y-1 text-sm">
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Total:</span>
          <span className="font-bold text-foreground">{total.toLocaleString('pt-BR')}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Distribuídos:</span>
          <span className="font-medium text-green-600">{distribuidos.toLocaleString('pt-BR')}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Não Distribuídos:</span>
          <span className="font-medium text-muted-foreground">{naoDistribuidos.toLocaleString('pt-BR')}</span>
        </div>
      </div>
    </div>
  );
};

// Custom label that shows total on top of bar
const renderTotalLabel = (props: any) => {
  const { x, y, width, value, index, data } = props;
  const entry = data[index];
  if (!entry) return null;
  
  const total = entry.distribuidos + entry.naoDistribuidos;
  if (total === 0) return null;
  
  return (
    <text
      x={x + width / 2}
      y={y - 8}
      fill="hsl(var(--foreground))"
      textAnchor="middle"
      fontSize={11}
      fontWeight={700}
    >
      {total.toLocaleString('pt-BR')}
    </text>
  );
};

export function ProcessosDistribuicaoChart({ data }: ProcessosDistribuicaoChartProps) {
  if (!data || data.length === 0) {
    return null;
  }

  // Calculate totals for summary
  const totalGeral = data.reduce((sum, d) => sum + d.distribuidos + d.naoDistribuidos, 0);
  const totalDistribuidos = data.reduce((sum, d) => sum + d.distribuidos, 0);
  const totalNaoDistribuidos = data.reduce((sum, d) => sum + d.naoDistribuidos, 0);

  return (
    <Card className="animate-slide-up">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-serif">Processos por Coordenação</CardTitle>
          <span className="text-2xl font-bold text-primary">{totalGeral.toLocaleString('pt-BR')}</span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 25, right: 10, left: -10, bottom: 0 }}
              barGap={2}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
              <XAxis 
                dataKey="nome" 
                tick={({ x, y, payload }) => {
                  // Simplify coordination name (remove "Coordenação")
                  const simpleName = payload.value.replace(/Coordena[çc][aã]o\s*/gi, '');
                  const words = simpleName.split(' ');
                  const lines: string[] = [];
                  let currentLine = '';
                  
                  words.forEach((word: string) => {
                    if (currentLine.length + word.length > 10) {
                      if (currentLine) lines.push(currentLine.trim());
                      currentLine = word + ' ';
                    } else {
                      currentLine += word + ' ';
                    }
                  });
                  if (currentLine.trim()) lines.push(currentLine.trim());
                  
                  return (
                    <g transform={`translate(${x},${y})`}>
                      {lines.map((line, index) => (
                        <text
                          key={index}
                          x={0}
                          y={index * 12}
                          dy={12}
                          textAnchor="middle"
                          fill="hsl(var(--muted-foreground))"
                          fontSize={10}
                        >
                          {line}
                        </text>
                      ))}
                    </g>
                  );
                }}
                tickLine={false}
                axisLine={{ stroke: "hsl(var(--border))" }}
                height={50}
                interval={0}
              />
              <YAxis 
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: "hsl(var(--border))" }}
                tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }}
                formatter={(value) => <span className="text-muted-foreground">{value}</span>}
              />
              <Bar 
                dataKey="distribuidos" 
                name="Distribuídos" 
                stackId="a"
                radius={[0, 0, 0, 0]}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-dist-${index}`} fill={getAreaColor(entry.area)} />
                ))}
              </Bar>
              <Bar 
                dataKey="naoDistribuidos" 
                name="Não Distribuídos" 
                stackId="a"
                radius={[4, 4, 0, 0]}
                fill={naoDistribuidoColor}
              >
                <LabelList 
                  content={(props) => renderTotalLabel({ ...props, data })}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        
        {/* Summary row */}
        <div className="flex justify-center gap-6 mt-3 pt-3 border-t text-sm">
          <div className="text-center">
            <span className="text-muted-foreground">Distribuídos: </span>
            <span className="font-semibold text-green-600">{totalDistribuidos.toLocaleString('pt-BR')}</span>
          </div>
          <div className="text-center">
            <span className="text-muted-foreground">Não Distribuídos: </span>
            <span className="font-semibold">{totalNaoDistribuidos.toLocaleString('pt-BR')}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
