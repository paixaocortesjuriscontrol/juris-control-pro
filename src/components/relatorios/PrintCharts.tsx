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
    <div className="mb-4">
      <h4 className="text-xs font-semibold text-gray-700 mb-2">{title}</h4>
      <div className="flex items-center gap-4">
        {/* Gráfico de pizza */}
        <div 
          className="w-24 h-24 rounded-full flex-shrink-0"
          style={{
            background: `conic-gradient(${gradientStops})`,
          }}
        />
        
        {/* Legenda */}
        <div className="flex flex-col gap-0.5 text-xs">
          {segments.map((item) => (
            <div key={item.name} className="flex items-center gap-1">
              <div 
                className="w-2 h-2 rounded-sm flex-shrink-0" 
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
    <div className="mb-4">
      <h4 className="text-xs font-semibold text-gray-700 mb-2">{title}</h4>
      <div className="flex items-center gap-4">
        {/* Gráfico de donut */}
        <div className="relative w-24 h-24 flex-shrink-0">
          <div 
            className="w-full h-full rounded-full"
            style={{
              background: `conic-gradient(${gradientStops})`,
            }}
          />
          <div className="absolute inset-3 bg-white rounded-full flex items-center justify-center">
            <span className="text-sm font-bold text-gray-800">{centerLabel || total}</span>
          </div>
        </div>
        
        {/* Legenda */}
        <div className="flex flex-col gap-0.5 text-xs">
          {segments.map((item) => (
            <div key={item.name} className="flex items-center gap-1">
              <div 
                className="w-2 h-2 rounded-sm flex-shrink-0" 
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
    <div className="mb-4">
      <h4 className="text-xs font-semibold text-gray-700 mb-2">{title}</h4>
      <div className="space-y-1">
        {filteredData.map((item) => (
          <div key={item.name} className="flex items-center gap-2">
            <span className="w-32 min-w-[8rem] text-xs text-gray-600 leading-tight truncate flex-shrink-0" title={item.name}>
              {item.name}
            </span>
            <div className="flex-1 h-4 bg-gray-100 rounded overflow-hidden flex items-center">
              <div 
                className="h-full rounded flex items-center justify-end pr-1"
                style={{ 
                  width: `${Math.max((item.value / max) * 100, 8)}%`,
                  backgroundColor: item.color,
                  minWidth: '24px'
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

// Gráfico de barras agrupadas (Novos vs Encerrados) - MELHORADO
export function PrintGroupedBarChart({ 
  data, 
  title 
}: { 
  data: BarChartData[]; 
  title: string;
}) {
  const hasData = data.some(d => d.novos > 0 || d.encerrados > 0);
  if (!hasData) return null;

  const max = Math.max(...data.flatMap(d => [d.novos, d.encerrados]), 1);

  return (
    <div className="mb-4">
      <h4 className="text-xs font-semibold text-gray-700 mb-2">{title}</h4>
      
      {/* Legenda */}
      <div className="flex gap-4 mb-2 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm bg-blue-500" />
          <span>Novos</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm bg-green-500" />
          <span>Encerrados</span>
        </div>
      </div>
      
      {/* Container do gráfico */}
      <div className="border border-gray-200 rounded p-2 bg-gray-50">
        <div className="flex items-end justify-between gap-1 h-28">
          {data.map((item) => (
            <div key={item.mes} className="flex-1 flex flex-col items-center">
              <div className="flex items-end gap-0.5 h-20 w-full justify-center">
                {/* Barra Novos */}
                <div className="flex flex-col items-center w-3">
                  <span className="text-[8px] text-gray-600 mb-0.5">{item.novos || ''}</span>
                  <div 
                    className="w-full bg-blue-500 rounded-t"
                    style={{ height: `${max > 0 ? Math.max((item.novos / max) * 64, item.novos > 0 ? 4 : 0) : 0}px` }}
                  />
                </div>
                {/* Barra Encerrados */}
                <div className="flex flex-col items-center w-3">
                  <span className="text-[8px] text-gray-600 mb-0.5">{item.encerrados || ''}</span>
                  <div 
                    className="w-full bg-green-500 rounded-t"
                    style={{ height: `${max > 0 ? Math.max((item.encerrados / max) * 64, item.encerrados > 0 ? 4 : 0) : 0}px` }}
                  />
                </div>
              </div>
              <span className="text-[9px] text-gray-600 mt-1 font-medium">{item.mes}</span>
            </div>
          ))}
        </div>
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

  const max = Math.max(...data.map(d => d.total), 1);

  return (
    <div className="mb-4">
      <h4 className="text-xs font-semibold text-gray-700 mb-2">{title}</h4>
      <div className="border border-gray-200 rounded p-2 bg-gray-50">
        <div className="flex items-end gap-1 h-20 justify-center">
          {data.map((item) => (
            <div key={item.ano} className="flex-1 flex flex-col items-center max-w-16">
              <span className="text-[9px] text-gray-600 mb-0.5 font-medium">{item.total}</span>
              <div 
                className="w-full bg-indigo-500 rounded-t max-w-8"
                style={{ height: `${max > 0 ? Math.max((item.total / max) * 56, item.total > 0 ? 4 : 0) : 0}px` }}
              />
              <span className="text-[9px] text-gray-500 mt-1">{item.ano}</span>
            </div>
          ))}
        </div>
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
    <div className="mb-4">
      <h4 className="text-xs font-semibold text-gray-700 mb-2">{title}</h4>
      
      {/* Barra empilhada */}
      <div className="h-6 flex rounded overflow-hidden mb-2">
        {data.filter(d => d.value > 0).map((item) => (
          <div 
            key={item.name}
            className="flex items-center justify-center"
            style={{ 
              width: `${(item.value / total) * 100}%`,
              backgroundColor: item.color,
              minWidth: item.value > 0 ? '16px' : '0'
            }}
          >
            <span className="text-xs font-medium text-white">{item.value}</span>
          </div>
        ))}
      </div>
      
      {/* Legenda */}
      <div className="flex flex-wrap gap-2 text-xs">
        {data.map((item) => (
          <div key={item.name} className="flex items-center gap-1">
            <div 
              className="w-2 h-2 rounded-sm" 
              style={{ backgroundColor: item.color }}
            />
            <span className="text-gray-700">{item.name}: {item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
