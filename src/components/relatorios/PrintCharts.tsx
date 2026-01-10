interface ChartData {
  name: string;
  value: number;
  color: string;
}

interface BarChartData {
  mes: string;
  novos: number;
  encerrados: number;
}

// Gráfico de pizza para impressão (CSS puro)
export function PrintPieChart({ 
  data, 
  title 
}: { 
  data: ChartData[]; 
  title: string;
}) {
  const total = data.reduce((acc, item) => acc + item.value, 0);
  if (total === 0) return null;

  // Calcular segmentos para gráfico de pizza com conic-gradient
  let accumulated = 0;
  const segments = data
    .filter(item => item.value > 0)
    .map(item => {
      const percentage = (item.value / total) * 100;
      const start = accumulated;
      accumulated += percentage;
      return { ...item, percentage, start, end: accumulated };
    });

  const gradientStops = segments
    .map(seg => `${seg.color} ${seg.start}% ${seg.end}%`)
    .join(', ');

  return (
    <div className="mb-6">
      <h4 className="text-sm font-semibold text-gray-700 mb-3">{title}</h4>
      <div className="flex items-center gap-6">
        {/* Gráfico de pizza */}
        <div 
          className="w-32 h-32 rounded-full flex-shrink-0"
          style={{
            background: `conic-gradient(${gradientStops})`,
          }}
        />
        
        {/* Legenda */}
        <div className="flex flex-col gap-1 text-xs">
          {segments.map((item) => (
            <div key={item.name} className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-sm flex-shrink-0" 
                style={{ backgroundColor: item.color }}
              />
              <span className="text-gray-700">
                {item.name}: <strong>{item.value}</strong> ({item.percentage.toFixed(1)}%)
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Gráfico de donut para impressão
export function PrintDonutChart({ 
  data, 
  title,
  centerLabel 
}: { 
  data: ChartData[]; 
  title: string;
  centerLabel?: string;
}) {
  const total = data.reduce((acc, item) => acc + item.value, 0);
  if (total === 0) return null;

  let accumulated = 0;
  const segments = data
    .filter(item => item.value > 0)
    .map(item => {
      const percentage = (item.value / total) * 100;
      const start = accumulated;
      accumulated += percentage;
      return { ...item, percentage, start, end: accumulated };
    });

  const gradientStops = segments
    .map(seg => `${seg.color} ${seg.start}% ${seg.end}%`)
    .join(', ');

  return (
    <div className="mb-6">
      <h4 className="text-sm font-semibold text-gray-700 mb-3">{title}</h4>
      <div className="flex items-center gap-6">
        {/* Gráfico de donut */}
        <div className="relative w-32 h-32 flex-shrink-0">
          <div 
            className="w-full h-full rounded-full"
            style={{
              background: `conic-gradient(${gradientStops})`,
            }}
          />
          <div className="absolute inset-4 bg-white rounded-full flex items-center justify-center">
            <span className="text-lg font-bold text-gray-800">{centerLabel || total}</span>
          </div>
        </div>
        
        {/* Legenda */}
        <div className="flex flex-col gap-1 text-xs">
          {segments.map((item) => (
            <div key={item.name} className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-sm flex-shrink-0" 
                style={{ backgroundColor: item.color }}
              />
              <span className="text-gray-700">
                {item.name}: <strong>{item.value}</strong>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Gráfico de barras horizontal para impressão
export function PrintHorizontalBarChart({ 
  data, 
  title,
  maxValue
}: { 
  data: ChartData[]; 
  title: string;
  maxValue?: number;
}) {
  const filteredData = data.filter(item => item.value > 0);
  if (filteredData.length === 0) return null;

  const max = maxValue || Math.max(...filteredData.map(d => d.value));

  return (
    <div className="mb-6">
      <h4 className="text-sm font-semibold text-gray-700 mb-3">{title}</h4>
      <div className="space-y-2">
        {filteredData.map((item) => (
          <div key={item.name} className="flex items-start gap-2">
            <span className="w-40 min-w-[10rem] text-xs text-gray-600 leading-tight break-words flex-shrink-0">
              {item.name}
            </span>
            <div className="flex-1 h-5 bg-gray-100 rounded overflow-hidden self-center">
              <div 
                className="h-full rounded flex items-center justify-end pr-2"
                style={{ 
                  width: `${(item.value / max) * 100}%`,
                  backgroundColor: item.color,
                  minWidth: item.value > 0 ? '24px' : '0'
                }}
              >
                <span className="text-xs font-medium text-white">{item.value}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Gráfico de barras agrupadas (Novos vs Encerrados)
export function PrintGroupedBarChart({ 
  data, 
  title 
}: { 
  data: BarChartData[]; 
  title: string;
}) {
  const hasData = data.some(d => d.novos > 0 || d.encerrados > 0);
  if (!hasData) return null;

  const max = Math.max(...data.flatMap(d => [d.novos, d.encerrados]));

  return (
    <div className="mb-6">
      <h4 className="text-sm font-semibold text-gray-700 mb-3">{title}</h4>
      
      {/* Legenda */}
      <div className="flex gap-4 mb-3 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm bg-blue-500" />
          <span>Novos</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm bg-green-500" />
          <span>Encerrados</span>
        </div>
      </div>
      
      {/* Barras */}
      <div className="flex items-end gap-2 h-32">
        {data.map((item) => (
          <div key={item.mes} className="flex-1 flex flex-col items-center">
            <div className="flex items-end gap-1 h-24">
              {/* Barra Novos */}
              <div className="w-4 flex flex-col items-center">
                <span className="text-[9px] text-gray-600 mb-0.5">{item.novos}</span>
                <div 
                  className="w-full bg-blue-500 rounded-t"
                  style={{ height: `${max > 0 ? (item.novos / max) * 80 : 0}px` }}
                />
              </div>
              {/* Barra Encerrados */}
              <div className="w-4 flex flex-col items-center">
                <span className="text-[9px] text-gray-600 mb-0.5">{item.encerrados}</span>
                <div 
                  className="w-full bg-green-500 rounded-t"
                  style={{ height: `${max > 0 ? (item.encerrados / max) * 80 : 0}px` }}
                />
              </div>
            </div>
            <span className="text-xs text-gray-600 mt-1">{item.mes}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Gráfico de evolução anual (linha simplificada com barras)
export function PrintYearlyChart({ 
  data, 
  title 
}: { 
  data: { ano: string; total: number }[]; 
  title: string;
}) {
  if (!data || data.length === 0) return null;

  const max = Math.max(...data.map(d => d.total));

  return (
    <div className="mb-6">
      <h4 className="text-sm font-semibold text-gray-700 mb-3">{title}</h4>
      <div className="flex items-end gap-1 h-24">
        {data.map((item) => (
          <div key={item.ano} className="flex-1 flex flex-col items-center">
            <span className="text-[9px] text-gray-600 mb-0.5">{item.total}</span>
            <div 
              className="w-full bg-purple-500 rounded-t"
              style={{ height: `${max > 0 ? (item.total / max) * 72 : 0}px` }}
            />
            <span className="text-[9px] text-gray-500 mt-1">{item.ano}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Gráfico de status (barras empilhadas simplificadas)
export function PrintStatusChart({ 
  data, 
  title,
  total
}: { 
  data: ChartData[]; 
  title: string;
  total: number;
}) {
  if (total === 0) return null;

  return (
    <div className="mb-6">
      <h4 className="text-sm font-semibold text-gray-700 mb-3">{title}</h4>
      
      {/* Barra empilhada */}
      <div className="h-8 flex rounded overflow-hidden mb-3">
        {data.filter(d => d.value > 0).map((item) => (
          <div 
            key={item.name}
            className="flex items-center justify-center"
            style={{ 
              width: `${(item.value / total) * 100}%`,
              backgroundColor: item.color,
              minWidth: item.value > 0 ? '20px' : '0'
            }}
          >
            <span className="text-xs font-medium text-white">{item.value}</span>
          </div>
        ))}
      </div>
      
      {/* Legenda */}
      <div className="flex flex-wrap gap-3 text-xs">
        {data.map((item) => (
          <div key={item.name} className="flex items-center gap-1">
            <div 
              className="w-3 h-3 rounded-sm" 
              style={{ backgroundColor: item.color }}
            />
            <span className="text-gray-700">{item.name}: {item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
