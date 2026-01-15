import { forwardRef } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  PrintDonutChart,
  PrintGroupedBarChart,
  PrintHorizontalBarChart,
  PrintStatusChart,
  PrintYearlyChart,
} from "./PrintCharts";
import type { RelatorioCompletoData } from "@/hooks/useRelatorioCompletoData";

type RelatorioPrintMode = "completo" | "resumo" | "atividades" | "clientes";

interface RelatorioPrintViewProps {
  resumoData: any;
  atividadesData: any;
  clientesData: any;
  completoData?: RelatorioCompletoData | null;
  mode?: RelatorioPrintMode;
}

export const RelatorioPrintView = forwardRef<HTMLDivElement, RelatorioPrintViewProps>(
  ({ resumoData, atividadesData, clientesData, completoData, mode = "completo" }, ref) => {
    const dataGeracao = format(new Date(), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR });

    const showResumo = mode === "completo" || mode === "resumo";
    const showAtividades = mode === "completo" || mode === "atividades";
    const showClientes = mode === "completo" || mode === "clientes";
    const showCompleto = mode === "completo" && completoData;

    const subtitle =
      mode === "completo"
        ? "Análise Completa do Escritório"
        : mode === "resumo"
          ? "Resumo Executivo"
          : mode === "atividades"
            ? "Controle de Atividades e Prazos"
            : "Análise por Clientes";

    return (
      <div ref={ref} className="bg-white text-black p-6 pdf-capture-hidden" style={{ fontFamily: 'Arial, sans-serif', maxWidth: '210mm' }}>
        {/* Cabeçalho Executivo */}
        <header className="text-center border-b-2 border-gray-800 pb-4 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-1 tracking-wide">RELATÓRIO GERENCIAL</h1>
          <p className="text-base text-gray-700 font-medium">{subtitle}</p>
          <p className="text-xs text-gray-500 mt-1">Gerado em: {dataGeracao}</p>
        </header>

        {/* ========== PÁGINA 1: VISÃO GERAL + RESUMO ========== */}
        
        {/* 1. VISÃO GERAL DO ESCRITÓRIO */}
        {showCompleto && (
          <section className="mb-6 report-section-first">
            <h2 className="text-lg font-bold text-gray-900 border-b-2 border-indigo-600 pb-1 mb-4">
              1. VISÃO GERAL DO ESCRITÓRIO
            </h2>

            <div className="grid grid-cols-4 gap-2 mb-4 print-no-break">
              <div className="border border-gray-300 rounded p-2 text-center bg-white">
                <p className="text-xl font-bold text-blue-600">{completoData?.dashboardStats?.totalProcessos ?? 0}</p>
                <p className="text-xs text-gray-600">Total Processos</p>
              </div>
              <div className="border border-gray-300 rounded p-2 text-center bg-white">
                <p className="text-xl font-bold text-green-600">{completoData?.dashboardStats?.processosAtivos ?? 0}</p>
                <p className="text-xs text-gray-600">Ativos</p>
              </div>
              <div className="border border-gray-300 rounded p-2 text-center bg-white">
                <p className="text-xl font-bold text-purple-600">{completoData?.dashboardStats?.processosDistribuidos ?? 0}</p>
                <p className="text-xs text-gray-600">Distribuídos</p>
              </div>
              <div className="border border-gray-300 rounded p-2 text-center bg-white">
                <p className="text-xl font-bold text-amber-600">{completoData?.dashboardStats?.processosNaoDistribuidos ?? 0}</p>
                <p className="text-xs text-gray-600">Não Distribuídos</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-4 print-no-break">
              <div className="border border-gray-300 rounded p-2 text-center bg-white">
                <p className="text-xl font-bold text-red-600">{completoData?.dashboardStats?.prazosUrgentes ?? 0}</p>
                <p className="text-xs text-gray-600">Prazos Urgentes (3 dias)</p>
              </div>
              <div className="border border-gray-300 rounded p-2 text-center bg-white">
                <p className="text-xl font-bold text-blue-600">{completoData?.dashboardStats?.totalAdvogados ?? 0}</p>
                <p className="text-xs text-gray-600">Advogados</p>
              </div>
              <div className="border border-gray-300 rounded p-2 text-center bg-white">
                <p className="text-xl font-bold text-indigo-600">{completoData?.dashboardStats?.totalCoordenacoes ?? 0}</p>
                <p className="text-xs text-gray-600">Coordenações</p>
              </div>
            </div>
          </section>
        )}

        {/* 2. RESUMO EXECUTIVO */}
        {showResumo && resumoData && (
          <section className="mb-6 report-section">
            <h2 className="text-lg font-bold text-gray-900 border-b-2 border-blue-600 pb-1 mb-4">
              2. RESUMO EXECUTIVO
            </h2>

            {/* Cards de Resumo */}
            <div className="grid grid-cols-4 gap-2 mb-4">
              <div className="border border-gray-300 rounded p-2 text-center">
                <p className="text-xl font-bold text-blue-600">{resumoData.totalProcessos}</p>
                <p className="text-xs text-gray-600">Total de Processos</p>
              </div>
              <div className="border border-gray-300 rounded p-2 text-center">
                <p className="text-xl font-bold text-green-600">{resumoData.processosAtivosAnoAtual}</p>
                <p className="text-xs text-gray-600">Ativos em {new Date().getFullYear()}</p>
              </div>
              <div className="border border-gray-300 rounded p-2 text-center">
                <p className="text-xl font-bold text-purple-600">{resumoData.mediaEnvolvidos}</p>
                <p className="text-xs text-gray-600">Média de Envolvidos</p>
              </div>
              <div className="border border-gray-300 rounded p-2 text-center">
                <p className="text-xl font-bold text-amber-600">{resumoData.totalMovimentacoes}</p>
                <p className="text-xs text-gray-600">Total de Andamentos</p>
              </div>
            </div>

            {/* 2.1 e 2.2 - Gráficos lado a lado */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <PrintDonutChart
                data={resumoData.processosPerArea || []}
                title="2.1 Processos por Área de Atuação"
                centerLabel={resumoData.totalProcessos?.toString()}
              />
              <PrintDonutChart
                data={resumoData.processosPorTipoPessoa || []}
                title="2.2 Processos por Tipo de Pessoa"
              />
            </div>

            {/* 2.3 Movimentação Mensal */}
            <div className="mb-4">
              <PrintGroupedBarChart
                data={resumoData.processosMensais || []}
                title="2.3 Movimentação Mensal (Novos vs Encerrados)"
              />
            </div>

            {/* 2.4 Processos MPT */}
            {resumoData.processosMptStatus && resumoData.processosMptStatus.length > 0 && (
              <div className="mb-4">
                <PrintStatusChart
                  data={resumoData.processosMptStatus}
                  title="2.4 Processos do Ministério Público por Situação"
                  total={resumoData.processosMptStatus.reduce((acc: number, s: any) => acc + s.value, 0)}
                />
              </div>
            )}

            {/* 2.5 Detalhamento por Área */}
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-gray-800 mb-2">2.5 Detalhamento por Área</h3>
              <table className="w-full border-collapse border border-gray-300 text-xs">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-2 py-1 text-left">Área</th>
                    <th className="border border-gray-300 px-2 py-1 text-right">Quantidade</th>
                    <th className="border border-gray-300 px-2 py-1 text-right">Percentual</th>
                  </tr>
                </thead>
                <tbody>
                  {resumoData.processosPerArea
                    ?.filter((a: any) => a.value > 0)
                    .map((area: any) => (
                      <tr key={area.name}>
                        <td className="border border-gray-300 px-2 py-1">
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded" style={{ backgroundColor: area.color }} />
                            {area.name}
                          </div>
                        </td>
                        <td className="border border-gray-300 px-2 py-1 text-right">{area.value}</td>
                        <td className="border border-gray-300 px-2 py-1 text-right">
                          {resumoData.totalProcessos > 0
                            ? ((area.value / resumoData.totalProcessos) * 100).toFixed(1)
                            : 0}%
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ========== PÁGINA 2: CONTROLE DE ATIVIDADES ========== */}
        {showAtividades && atividadesData && (
          <section className="mb-6 report-section page-break-before">
            <h2 className="text-lg font-bold text-gray-900 border-b-2 border-green-600 pb-1 mb-4">
              3. CONTROLE DE ATIVIDADES E PRAZOS
            </h2>

            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="border border-gray-300 rounded p-2 text-center">
                <p className="text-xl font-bold text-gray-800">{atividadesData.totalPrazos}</p>
                <p className="text-xs text-gray-600">Total de Prazos</p>
              </div>
              <div className="border border-gray-300 rounded p-2 text-center">
                <p className="text-xl font-bold text-green-600">{atividadesData.atividadesConcluidas}</p>
                <p className="text-xs text-gray-600">Concluídas</p>
              </div>
              <div className="border border-gray-300 rounded p-2 text-center">
                <p className="text-xl font-bold text-amber-600">{atividadesData.atividadesNaoConcluidas}</p>
                <p className="text-xs text-gray-600">Pendentes/Atrasadas</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <PrintStatusChart
                data={atividadesData.prazosStatus || []}
                title="3.1 Status dos Prazos"
                total={atividadesData.totalPrazos || 0}
              />
              <PrintDonutChart
                data={atividadesData.andamentosPorArea || []}
                title="3.2 Andamentos por Área"
              />
            </div>

            {atividadesData.evolucaoAndamentos?.length > 0 && (
              <div className="mb-4">
                <PrintYearlyChart
                  data={atividadesData.evolucaoAndamentos}
                  title="3.3 Evolução dos Andamentos por Ano"
                />
              </div>
            )}

            {atividadesData.atividadesPorArea?.some((a: any) => a.concluidas > 0 || a.pendentes > 0) && (
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-gray-800 mb-2">3.4 Atividades por Área de Atuação</h3>
                <table className="w-full border-collapse border border-gray-300 text-xs">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-300 px-2 py-1 text-left">Área</th>
                      <th className="border border-gray-300 px-2 py-1 text-right">Concluídas</th>
                      <th className="border border-gray-300 px-2 py-1 text-right">Pendentes</th>
                      <th className="border border-gray-300 px-2 py-1 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {atividadesData.atividadesPorArea
                      ?.filter((a: any) => a.concluidas > 0 || a.pendentes > 0)
                      .map((area: any) => (
                        <tr key={area.name}>
                          <td className="border border-gray-300 px-2 py-1">{area.name}</td>
                          <td className="border border-gray-300 px-2 py-1 text-right text-green-600">{area.concluidas}</td>
                          <td className="border border-gray-300 px-2 py-1 text-right text-amber-600">{area.pendentes}</td>
                          <td className="border border-gray-300 px-2 py-1 text-right font-semibold">{area.concluidas + area.pendentes}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* ========== PÁGINA 3: CLIENTES - PARTE 1 ========== */}
        {showClientes && clientesData && (
          <section className="mb-6 report-section page-break-before">
            <h2 className="text-lg font-bold text-gray-900 border-b-2 border-purple-600 pb-1 mb-4">
              4. ANÁLISE POR CLIENTES
            </h2>

            <div className="grid grid-cols-4 gap-2 mb-4">
              <div className="border border-gray-300 rounded p-2 text-center">
                <p className="text-xl font-bold text-blue-600">{clientesData.processosPorCliente?.length || 0}</p>
                <p className="text-xs text-gray-600">Clientes Ativos</p>
              </div>
              <div className="border border-gray-300 rounded p-2 text-center">
                <p className="text-xl font-bold text-green-600">
                  {clientesData.processosPorCliente?.reduce((acc: number, c: any) => acc + c.ativos, 0) || 0}
                </p>
                <p className="text-xs text-gray-600">Processos Ativos</p>
              </div>
              <div className="border border-gray-300 rounded p-2 text-center">
                <p className="text-xl font-bold text-purple-600">
                  {clientesData.processosPorCliente?.reduce((acc: number, c: any) => acc + c.encerrados, 0) || 0}
                </p>
                <p className="text-xs text-gray-600">Encerrados</p>
              </div>
              <div className="border border-gray-300 rounded p-2 text-center">
                <p className="text-xl font-bold text-amber-600">
                  {clientesData.processosPorCliente?.reduce((acc: number, c: any) => acc + c.prazosPendentes, 0) || 0}
                </p>
                <p className="text-xs text-gray-600">Prazos Pendentes</p>
              </div>
            </div>

            {/* 4.1 Processos por Vara (Top 10) - AZUL */}
            {clientesData.processosPorVara?.length > 0 && (
              <div className="mb-4">
                <PrintHorizontalBarChart
                  data={clientesData.processosPorVara.slice(0, 10).map((v: any) => ({
                    name: v.vara || "N/A",
                    value: v.total,
                    color: "#3B82F6",
                  }))}
                  title="4.1 Processos por Vara (Top 10)"
                />
              </div>
            )}

            {/* 4.2 Produtividade da Equipe */}
            {clientesData.produtividadeAdvogados?.length > 0 && (
              <div className="mb-4">
                <PrintHorizontalBarChart
                  data={clientesData.produtividadeAdvogados.map((a: any, i: number) => ({
                    name: a.nome || "N/A",
                    value: a.processos,
                    color: ["#3B82F6", "#22C55E", "#F59E0B", "#EF4444", "#6366F1"][i % 5],
                  }))}
                  title="4.2 Produtividade da Equipe"
                />
              </div>
            )}

            {/* 4.3 Processos por Cliente (Top 20) */}
            {clientesData.processosPorCliente?.length > 0 && (
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-gray-800 mb-2">4.3 Processos por Cliente (Top 20)</h3>
                <table className="w-full border-collapse border border-gray-300 text-xs" data-pdf-allow-split>
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-300 px-2 py-1 text-left">Cliente</th>
                      <th className="border border-gray-300 px-2 py-1 text-center">Tipo</th>
                      <th className="border border-gray-300 px-2 py-1 text-right">Total</th>
                      <th className="border border-gray-300 px-2 py-1 text-right">Ativos</th>
                      <th className="border border-gray-300 px-2 py-1 text-right">Encerr.</th>
                      <th className="border border-gray-300 px-2 py-1 text-right">Prazos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clientesData.processosPorCliente.slice(0, 20).map((cliente: any) => (
                      <tr key={cliente.nome}>
                        <td className="border border-gray-300 px-2 py-1">{cliente.nome}</td>
                        <td className="border border-gray-300 px-2 py-1 text-center">
                          {cliente.tipo === "pessoa_fisica" ? "PF" : "PJ"}
                        </td>
                        <td className="border border-gray-300 px-2 py-1 text-right font-semibold">{cliente.total}</td>
                        <td className="border border-gray-300 px-2 py-1 text-right text-green-600">{cliente.ativos}</td>
                        <td className="border border-gray-300 px-2 py-1 text-right">{cliente.encerrados}</td>
                        <td className="border border-gray-300 px-2 py-1 text-right text-amber-600">{cliente.prazosPendentes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* ========== PÁGINA 4: CLIENTES - PARTE 2 ========== */}
        {showClientes && clientesData && (
          <section className="mb-6 report-section page-break-before">
            {/* 4.4 Duração Média dos Processos por Cliente */}
            {clientesData.duracaoClientes?.length > 0 && (
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-gray-800 mb-2">4.4 Duração Média dos Processos por Cliente</h3>
                <table className="w-full border-collapse border border-gray-300 text-xs">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-300 px-2 py-1 text-left">Cliente</th>
                      <th className="border border-gray-300 px-2 py-1 text-right">Processos</th>
                      <th className="border border-gray-300 px-2 py-1 text-right">Média (dias)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clientesData.duracaoClientes.map((cliente: any) => (
                      <tr key={cliente.nome}>
                        <td className="border border-gray-300 px-2 py-1">{cliente.nome}</td>
                        <td className="border border-gray-300 px-2 py-1 text-right">{cliente.processos}</td>
                        <td className="border border-gray-300 px-2 py-1 text-right">{cliente.mediaDias}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* 4.5 Atividades por Tipo de Tarefa */}
            {clientesData.atividadesPorTarefa?.length > 0 && (
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-gray-800 mb-2">4.5 Atividades por Tipo de Tarefa</h3>
                <table className="w-full border-collapse border border-gray-300 text-xs">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-300 px-2 py-1 text-left">Tarefa</th>
                      <th className="border border-gray-300 px-2 py-1 text-right">Total</th>
                      <th className="border border-gray-300 px-2 py-1 text-right">Concluídas</th>
                      <th className="border border-gray-300 px-2 py-1 text-right">Atrasadas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clientesData.atividadesPorTarefa.map((tarefa: any) => (
                      <tr key={tarefa.titulo}>
                        <td className="border border-gray-300 px-2 py-1">{tarefa.titulo}</td>
                        <td className="border border-gray-300 px-2 py-1 text-right">{tarefa.total}</td>
                        <td className="border border-gray-300 px-2 py-1 text-right text-green-600">{tarefa.concluidas}</td>
                        <td className="border border-gray-300 px-2 py-1 text-right text-red-600">{tarefa.atrasadas}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* ========== PÁGINA 5-6: ESTRUTURA DAS COORDENAÇÕES ========== */}
        {showCompleto && completoData?.coordenacoes && completoData.coordenacoes.length > 0 && (
          <section className="mb-6 report-section page-break-before">
            <h2 className="text-lg font-bold text-gray-900 border-b-2 border-teal-600 pb-1 mb-4">
              5. ESTRUTURA DAS COORDENAÇÕES
            </h2>

            <div className="grid grid-cols-3 gap-2 mb-4 print-no-break">
              <div className="border border-gray-300 rounded p-2 text-center bg-white">
                <p className="text-xl font-bold text-teal-600">{completoData.coordenacoes.length}</p>
                <p className="text-xs text-gray-600">Coordenações</p>
              </div>
              <div className="border border-gray-300 rounded p-2 text-center bg-white">
                <p className="text-xl font-bold text-blue-600">
                  {completoData.coordenacoes.reduce((acc, c) => acc + c.totalMembros, 0)}
                </p>
                <p className="text-xs text-gray-600">Total de Membros</p>
              </div>
              <div className="border border-gray-300 rounded p-2 text-center bg-white">
                <p className="text-xl font-bold text-purple-600">
                  {completoData.coordenacoes.reduce((acc, c) => acc + c.totalProcessos, 0)}
                </p>
                <p className="text-xs text-gray-600">Processos Vinculados</p>
              </div>
            </div>

            {/* 5.1 Resumo por Coordenação */}
            <div className="mb-4 print-no-break">
              <h3 className="text-sm font-semibold text-gray-800 mb-2">5.1 Resumo por Coordenação</h3>
              <table className="w-full border-collapse border border-gray-300 text-xs">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-2 py-1 text-left">Coordenação</th>
                    <th className="border border-gray-300 px-2 py-1 text-left">Coordenador</th>
                    <th className="border border-gray-300 px-2 py-1 text-center">Membros</th>
                    <th className="border border-gray-300 px-2 py-1 text-right">Processos</th>
                    <th className="border border-gray-300 px-2 py-1 text-right">Distrib.</th>
                    <th className="border border-gray-300 px-2 py-1 text-right">Não Dist.</th>
                  </tr>
                </thead>
                <tbody>
                  {completoData.coordenacoes.map((coord) => (
                    <tr key={coord.id}>
                      <td className="border border-gray-300 px-2 py-1 font-medium">{coord.nome}</td>
                      <td className="border border-gray-300 px-2 py-1">{coord.coordenador}</td>
                      <td className="border border-gray-300 px-2 py-1 text-center">{coord.totalMembros}</td>
                      <td className="border border-gray-300 px-2 py-1 text-right font-semibold">{coord.totalProcessos}</td>
                      <td className="border border-gray-300 px-2 py-1 text-right text-green-600">{coord.processosDistribuidos}</td>
                      <td className="border border-gray-300 px-2 py-1 text-right text-amber-600">{coord.processosNaoDistribuidos}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 5.2 Processos por Membro - Cards compactos */}
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-gray-800 mb-2">5.2 Processos por Membro</h3>
              <div className="grid grid-cols-2 gap-3">
                {completoData.coordenacoes.map((coord) => (
                  coord.membros.length > 0 && (
                    <div key={coord.id} className="border border-gray-200 rounded p-2 bg-gray-50">
                      <h4 className="text-xs font-medium text-teal-700 mb-1 border-b border-teal-200 pb-1">
                        {coord.nome} ({coord.membros.length})
                      </h4>
                      <div className="space-y-0.5">
                        {coord.membros.map((m, i) => (
                          <div key={i} className="flex justify-between text-xs">
                            <span className="text-gray-700 truncate" style={{ maxWidth: '70%' }}>{m.nome}</span>
                            <span className="font-semibold text-gray-800">{m.processos}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ========== PÁGINA 7: AUDIÊNCIAS ========== */}
        {showCompleto && completoData?.audienciasStats && (
          <section className="mb-6 report-section page-break-before">
            <h2 className="text-lg font-bold text-gray-900 border-b-2 border-orange-600 pb-1 mb-4">
              6. PAINEL DE AUDIÊNCIAS
            </h2>

            <div className="grid grid-cols-6 gap-2 mb-4 print-no-break">
              <div className="border border-gray-300 rounded p-2 text-center bg-white">
                <p className="text-lg font-bold text-gray-800">{completoData.audienciasStats.total}</p>
                <p className="text-xs text-gray-600">Total</p>
              </div>
              <div className="border border-gray-300 rounded p-2 text-center bg-white">
                <p className="text-lg font-bold text-amber-600">{completoData.audienciasStats.pendentes}</p>
                <p className="text-xs text-gray-600">Pendentes</p>
              </div>
              <div className="border border-gray-300 rounded p-2 text-center bg-white">
                <p className="text-lg font-bold text-red-600">{completoData.audienciasStats.proximas7Dias}</p>
                <p className="text-xs text-gray-600">Próx. 7 Dias</p>
              </div>
              <div className="border border-gray-300 rounded p-2 text-center bg-white">
                <p className="text-lg font-bold text-green-600">{completoData.audienciasStats.confirmadas}</p>
                <p className="text-xs text-gray-600">Confirmadas</p>
              </div>
              <div className="border border-gray-300 rounded p-2 text-center bg-white">
                <p className="text-lg font-bold text-blue-600">{completoData.audienciasStats.tratadas}</p>
                <p className="text-xs text-gray-600">Tratadas</p>
              </div>
              <div className="border border-gray-300 rounded p-2 text-center bg-white">
                <p className="text-lg font-bold text-gray-500">{completoData.audienciasStats.ignoradas}</p>
                <p className="text-xs text-gray-600">Ignoradas</p>
              </div>
            </div>
          </section>
        )}

        {/* 7. INTIMAÇÕES */}
        {showCompleto && completoData?.intimacoesStats && (
          <section className="mb-6 report-section">
            <h2 className="text-lg font-bold text-gray-900 border-b-2 border-rose-600 pb-1 mb-4">
              7. PAINEL DE INTIMAÇÕES
            </h2>

            <div className="grid grid-cols-6 gap-2 mb-4 print-no-break">
              <div className="border border-gray-300 rounded p-2 text-center bg-white">
                <p className="text-lg font-bold text-gray-800">{completoData.intimacoesStats.total}</p>
                <p className="text-xs text-gray-600">Total</p>
              </div>
              <div className="border border-gray-300 rounded p-2 text-center bg-white">
                <p className="text-lg font-bold text-amber-600">{completoData.intimacoesStats.pendentes}</p>
                <p className="text-xs text-gray-600">Pendentes</p>
              </div>
              <div className="border border-gray-300 rounded p-2 text-center bg-white">
                <p className="text-lg font-bold text-red-600">{completoData.intimacoesStats.vencidas}</p>
                <p className="text-xs text-gray-600">Vencidas</p>
              </div>
              <div className="border border-gray-300 rounded p-2 text-center bg-white">
                <p className="text-lg font-bold text-orange-600">{completoData.intimacoesStats.proximas7Dias}</p>
                <p className="text-xs text-gray-600">Próx. 7 Dias</p>
              </div>
              <div className="border border-gray-300 rounded p-2 text-center bg-white">
                <p className="text-lg font-bold text-blue-600">{completoData.intimacoesStats.emAndamento}</p>
                <p className="text-xs text-gray-600">Em Andamento</p>
              </div>
              <div className="border border-gray-300 rounded p-2 text-center bg-white">
                <p className="text-lg font-bold text-green-600">{completoData.intimacoesStats.tratadas}</p>
                <p className="text-xs text-gray-600">Tratadas</p>
              </div>
            </div>
          </section>
        )}

        {/* 8. DJEN */}
        {showCompleto && completoData?.djenStats && (
          <section className="mb-6 report-section">
            <h2 className="text-lg font-bold text-gray-900 border-b-2 border-cyan-600 pb-1 mb-4">
              8. ANÁLISE DJEN (PUBLICAÇÕES)
            </h2>

            <div className="grid grid-cols-3 gap-2 mb-4 print-no-break">
              <div className="border border-gray-300 rounded p-2 text-center bg-white">
                <p className="text-xl font-bold text-gray-800">{completoData.djenStats.totalPublicacoes}</p>
                <p className="text-xs text-gray-600">Total de Publicações</p>
              </div>
              <div className="border border-gray-300 rounded p-2 text-center bg-white">
                <p className="text-xl font-bold text-amber-600">{completoData.djenStats.publicacoesNaoLidas}</p>
                <p className="text-xs text-gray-600">Não Lidas</p>
              </div>
              <div className="border border-gray-300 rounded p-2 text-center bg-white">
                <p className="text-xl font-bold text-green-600">{completoData.djenStats.publicacoesHoje}</p>
                <p className="text-xs text-gray-600">Capturadas Hoje</p>
              </div>
            </div>

            {completoData.djenStats.porCoordenacao.length > 0 && (
              <div className="mb-4 print-no-break">
                <h3 className="text-sm font-semibold text-gray-800 mb-2">8.1 Publicações por Coordenação</h3>
                <table className="w-full border-collapse border border-gray-300 text-xs">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-300 px-2 py-1 text-left">Coordenação</th>
                      <th className="border border-gray-300 px-2 py-1 text-right">Total</th>
                      <th className="border border-gray-300 px-2 py-1 text-right">Não Lidas</th>
                      <th className="border border-gray-300 px-2 py-1 text-right">% Lidas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {completoData.djenStats.porCoordenacao.map((c) => (
                      <tr key={c.coordenacao}>
                        <td className="border border-gray-300 px-2 py-1">{c.coordenacao}</td>
                        <td className="border border-gray-300 px-2 py-1 text-right">{c.total}</td>
                        <td className="border border-gray-300 px-2 py-1 text-right text-amber-600">{c.naoLidas}</td>
                        <td className="border border-gray-300 px-2 py-1 text-right text-green-600">
                          {c.total > 0 ? (((c.total - c.naoLidas) / c.total) * 100).toFixed(0) : 0}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* 9. NOTIFICAÇÕES */}
        {showCompleto && completoData?.notificacoesStats && (
          <section className="mb-6 report-section">
            <h2 className="text-lg font-bold text-gray-900 border-b-2 border-pink-600 pb-1 mb-4">
              9. CENTRAL DE NOTIFICAÇÕES
            </h2>

            <div className="grid grid-cols-4 gap-2 mb-4 print-no-break">
              <div className="border border-gray-300 rounded p-2 text-center bg-white">
                <p className="text-xl font-bold text-gray-800">{completoData.notificacoesStats.total}</p>
                <p className="text-xs text-gray-600">Total</p>
              </div>
              <div className="border border-gray-300 rounded p-2 text-center bg-white">
                <p className="text-xl font-bold text-amber-600">{completoData.notificacoesStats.naoLidas}</p>
                <p className="text-xs text-gray-600">Não Lidas</p>
              </div>
              <div className="border border-gray-300 rounded p-2 text-center bg-white">
                <p className="text-xl font-bold text-red-600">{completoData.notificacoesStats.prazosUrgentes}</p>
                <p className="text-xs text-gray-600">Prazos Urgentes</p>
              </div>
              <div className="border border-gray-300 rounded p-2 text-center bg-white">
                <p className="text-xl font-bold text-blue-600">{completoData.notificacoesStats.alertasSistema}</p>
                <p className="text-xs text-gray-600">Alertas Sistema</p>
              </div>
            </div>
          </section>
        )}

        {/* Rodapé */}
        <footer className="mt-8 pt-4 border-t border-gray-300 text-center text-xs text-gray-500">
          <p>Juris Control - Sistema de Gestão Jurídica</p>
          <p className="mt-1">Relatório gerado automaticamente em {dataGeracao}</p>
        </footer>
      </div>
    );
  }
);

RelatorioPrintView.displayName = "RelatorioPrintView";
