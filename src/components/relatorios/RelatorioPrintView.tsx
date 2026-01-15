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

    let idx = 0;
    const numResumo = showResumo ? ++idx : 0;
    const numAtividades = showAtividades ? ++idx : 0;
    const numClientes = showClientes ? ++idx : 0;
    const numDashboard = showCompleto ? ++idx : 0;
    const numCoordenacoes = showCompleto ? ++idx : 0;
    const numAudiencias = showCompleto ? ++idx : 0;
    const numIntimacoes = showCompleto ? ++idx : 0;
    const numDjen = showCompleto ? ++idx : 0;
    const numNotificacoes = showCompleto ? ++idx : 0;

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
        {/* Cabeçalho */}
        <div className="text-center border-b-2 border-gray-800 pb-4 mb-6 print-no-break">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">RELATÓRIO GERENCIAL</h1>
          <p className="text-base text-gray-600">{subtitle}</p>
          <p className="text-xs text-gray-500 mt-1">Gerado em: {dataGeracao}</p>
        </div>

        {/* ========== SEÇÃO DASHBOARD ========== */}
        {showCompleto && completoData?.dashboardStats && (
          <section className="mb-12 report-section">
            <h2 className="text-2xl font-bold text-gray-900 border-b-2 border-indigo-600 pb-2 mb-6">
              {numDashboard}. VISÃO GERAL DO ESCRITÓRIO
            </h2>

            <div className="grid grid-cols-4 gap-4 mb-8">
              <div className="border border-gray-300 rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-blue-600">{completoData.dashboardStats.totalProcessos}</p>
                <p className="text-sm text-gray-600">Total Processos</p>
              </div>
              <div className="border border-gray-300 rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-green-600">{completoData.dashboardStats.processosAtivos}</p>
                <p className="text-sm text-gray-600">Ativos</p>
              </div>
              <div className="border border-gray-300 rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-purple-600">{completoData.dashboardStats.processosDistribuidos}</p>
                <p className="text-sm text-gray-600">Distribuídos</p>
              </div>
              <div className="border border-gray-300 rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-amber-600">{completoData.dashboardStats.processosNaoDistribuidos}</p>
                <p className="text-sm text-gray-600">Não Distribuídos</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="border border-gray-300 rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-red-600">{completoData.dashboardStats.prazosUrgentes}</p>
                <p className="text-sm text-gray-600">Prazos Urgentes (3 dias)</p>
              </div>
              <div className="border border-gray-300 rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-blue-600">{completoData.dashboardStats.totalAdvogados}</p>
                <p className="text-sm text-gray-600">Advogados Cadastrados</p>
              </div>
              <div className="border border-gray-300 rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-indigo-600">{completoData.dashboardStats.totalCoordenacoes}</p>
                <p className="text-sm text-gray-600">Coordenações</p>
              </div>
            </div>
          </section>
        )}

        {/* ========== SEÇÃO RESUMO ========== */}
        {showResumo && (
          <section className="mb-12 report-section">
            <h2 className="text-2xl font-bold text-gray-900 border-b-2 border-blue-600 pb-2 mb-6">
              {numResumo}. RESUMO EXECUTIVO
            </h2>

            {resumoData && (
              <>
                {/* Cards de Resumo */}
                <div className="grid grid-cols-4 gap-4 mb-8">
                  <div className="border border-gray-300 rounded-lg p-4 text-center">
                    <p className="text-3xl font-bold text-blue-600">{resumoData.totalProcessos}</p>
                    <p className="text-sm text-gray-600">Total de Processos</p>
                  </div>
                  <div className="border border-gray-300 rounded-lg p-4 text-center">
                    <p className="text-3xl font-bold text-green-600">{resumoData.processosAtivosAnoAtual}</p>
                    <p className="text-sm text-gray-600">Ativos em {new Date().getFullYear()}</p>
                  </div>
                  <div className="border border-gray-300 rounded-lg p-4 text-center">
                    <p className="text-3xl font-bold text-purple-600">{resumoData.mediaEnvolvidos}</p>
                    <p className="text-sm text-gray-600">Média de Envolvidos</p>
                  </div>
                  <div className="border border-gray-300 rounded-lg p-4 text-center">
                    <p className="text-3xl font-bold text-amber-600">{resumoData.totalMovimentacoes}</p>
                    <p className="text-sm text-gray-600">Total de Andamentos</p>
                  </div>
                </div>

                {/* Gráficos lado a lado */}
                <div className="grid grid-cols-2 gap-8 mb-8">
                  <PrintDonutChart
                    data={resumoData.processosPerArea || []}
                    title={`${numResumo}.1 Processos por Área de Atuação`}
                    centerLabel={resumoData.totalProcessos?.toString()}
                  />
                  <PrintDonutChart
                    data={resumoData.processosPorTipoPessoa || []}
                    title={`${numResumo}.2 Processos por Tipo de Pessoa`}
                  />
                </div>

                <div className="mb-8">
                  <PrintGroupedBarChart
                    data={resumoData.processosMensais || []}
                    title={`${numResumo}.3 Movimentação Mensal (Novos vs Encerrados)`}
                  />
                </div>

                {resumoData.processosMptStatus && resumoData.processosMptStatus.length > 0 && (
                  <div className="mb-8">
                    <PrintStatusChart
                      data={resumoData.processosMptStatus}
                      title={`${numResumo}.4 Processos do Ministério Público por Situação`}
                      total={resumoData.processosMptStatus.reduce((acc: number, s: any) => acc + s.value, 0)}
                    />
                  </div>
                )}

                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">{numResumo}.5 Detalhamento por Área</h3>
                  <table className="w-full border-collapse border border-gray-300">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border border-gray-300 px-4 py-2 text-left">Área</th>
                        <th className="border border-gray-300 px-4 py-2 text-right">Quantidade</th>
                        <th className="border border-gray-300 px-4 py-2 text-right">Percentual</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resumoData.processosPerArea
                        ?.filter((a: any) => a.value > 0)
                        .map((area: any) => (
                          <tr key={area.name}>
                            <td className="border border-gray-300 px-4 py-2">
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded" style={{ backgroundColor: area.color }} />
                                {area.name}
                              </div>
                            </td>
                            <td className="border border-gray-300 px-4 py-2 text-right">{area.value}</td>
                            <td className="border border-gray-300 px-4 py-2 text-right">
                              {resumoData.totalProcessos > 0
                                ? ((area.value / resumoData.totalProcessos) * 100).toFixed(1)
                                : 0}%
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        )}

        {/* ========== SEÇÃO ATIVIDADES ========== */}
        {showAtividades && (
          <section className="mb-12 report-section">
            <h2 className="text-2xl font-bold text-gray-900 border-b-2 border-green-600 pb-2 mb-6">
              {numAtividades}. CONTROLE DE ATIVIDADES E PRAZOS
            </h2>

            {atividadesData && (
              <>
                <div className="grid grid-cols-3 gap-4 mb-8">
                  <div className="border border-gray-300 rounded-lg p-4 text-center">
                    <p className="text-3xl font-bold text-gray-800">{atividadesData.totalPrazos}</p>
                    <p className="text-sm text-gray-600">Total de Prazos</p>
                  </div>
                  <div className="border border-gray-300 rounded-lg p-4 text-center">
                    <p className="text-3xl font-bold text-green-600">{atividadesData.atividadesConcluidas}</p>
                    <p className="text-sm text-gray-600">Concluídas</p>
                  </div>
                  <div className="border border-gray-300 rounded-lg p-4 text-center">
                    <p className="text-3xl font-bold text-amber-600">{atividadesData.atividadesNaoConcluidas}</p>
                    <p className="text-sm text-gray-600">Pendentes/Atrasadas</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-8 mb-8">
                  <PrintStatusChart
                    data={atividadesData.prazosStatus || []}
                    title={`${numAtividades}.1 Status dos Prazos`}
                    total={atividadesData.totalPrazos || 0}
                  />
                  <PrintDonutChart
                    data={atividadesData.andamentosPorArea || []}
                    title={`${numAtividades}.2 Andamentos por Área`}
                  />
                </div>

                {atividadesData.evolucaoAndamentos?.length > 0 && (
                  <div className="mb-8">
                    <PrintYearlyChart
                      data={atividadesData.evolucaoAndamentos}
                      title={`${numAtividades}.3 Evolução dos Andamentos por Ano`}
                    />
                  </div>
                )}

                {atividadesData.atividadesPorArea?.some((a: any) => a.concluidas > 0 || a.pendentes > 0) && (
                  <div className="mb-8">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">
                      {numAtividades}.4 Atividades por Área de Atuação
                    </h3>
                    <table className="w-full border-collapse border border-gray-300">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="border border-gray-300 px-4 py-2 text-left">Área</th>
                          <th className="border border-gray-300 px-4 py-2 text-right">Concluídas</th>
                          <th className="border border-gray-300 px-4 py-2 text-right">Pendentes</th>
                          <th className="border border-gray-300 px-4 py-2 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {atividadesData.atividadesPorArea
                          ?.filter((a: any) => a.concluidas > 0 || a.pendentes > 0)
                          .map((area: any) => (
                            <tr key={area.name}>
                              <td className="border border-gray-300 px-4 py-2">{area.name}</td>
                              <td className="border border-gray-300 px-4 py-2 text-right text-green-600">
                                {area.concluidas}
                              </td>
                              <td className="border border-gray-300 px-4 py-2 text-right text-amber-600">
                                {area.pendentes}
                              </td>
                              <td className="border border-gray-300 px-4 py-2 text-right font-semibold">
                                {area.concluidas + area.pendentes}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </section>
        )}

        {/* ========== SEÇÃO CLIENTES ========== */}
        {showClientes && (
          <section className="mb-12 report-section">
            <h2 className="text-2xl font-bold text-gray-900 border-b-2 border-purple-600 pb-2 mb-6">
              {numClientes}. ANÁLISE POR CLIENTES
            </h2>

            {clientesData && (
              <>
                <div className="grid grid-cols-4 gap-4 mb-8">
                  <div className="border border-gray-300 rounded-lg p-4 text-center">
                    <p className="text-3xl font-bold text-blue-600">{clientesData.processosPorCliente?.length || 0}</p>
                    <p className="text-sm text-gray-600">Clientes Ativos</p>
                  </div>
                  <div className="border border-gray-300 rounded-lg p-4 text-center">
                    <p className="text-3xl font-bold text-green-600">
                      {clientesData.processosPorCliente?.reduce((acc: number, c: any) => acc + c.ativos, 0) || 0}
                    </p>
                    <p className="text-sm text-gray-600">Processos Ativos</p>
                  </div>
                  <div className="border border-gray-300 rounded-lg p-4 text-center">
                    <p className="text-3xl font-bold text-purple-600">
                      {clientesData.processosPorCliente?.reduce((acc: number, c: any) => acc + c.encerrados, 0) || 0}
                    </p>
                    <p className="text-sm text-gray-600">Encerrados</p>
                  </div>
                  <div className="border border-gray-300 rounded-lg p-4 text-center">
                    <p className="text-3xl font-bold text-amber-600">
                      {clientesData.processosPorCliente?.reduce((acc: number, c: any) => acc + c.prazosPendentes, 0) || 0}
                    </p>
                    <p className="text-sm text-gray-600">Prazos Pendentes</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-8 mb-8">
                  {clientesData.processosPorVara?.length > 0 && (
                    <PrintHorizontalBarChart
                      data={clientesData.processosPorVara.slice(0, 8).map((v: any) => ({
                        name: v.vara || "N/A",
                        value: v.total,
                        color: "#8B5CF6",
                      }))}
                      title={`${numClientes}.1 Processos por Vara (Top 8)`}
                    />
                  )}
                  {clientesData.produtividadeAdvogados?.length > 0 && (
                    <PrintHorizontalBarChart
                      data={clientesData.produtividadeAdvogados.map((a: any, i: number) => ({
                        name: a.nome || "N/A",
                        value: a.processos,
                        color: ["#3B82F6", "#22C55E", "#F59E0B", "#EF4444", "#8B5CF6"][i % 5],
                      }))}
                      title={`${numClientes}.2 Produtividade da Equipe`}
                    />
                  )}
                </div>

                {clientesData.processosPorCliente?.length > 0 && (
                  <div className="mb-8">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">{numClientes}.3 Processos por Cliente</h3>
                    <table className="w-full border-collapse border border-gray-300 text-sm">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="border border-gray-300 px-3 py-2 text-left">Cliente</th>
                          <th className="border border-gray-300 px-3 py-2 text-center">Tipo</th>
                          <th className="border border-gray-300 px-3 py-2 text-right">Total</th>
                          <th className="border border-gray-300 px-3 py-2 text-right">Ativos</th>
                          <th className="border border-gray-300 px-3 py-2 text-right">Encerrados</th>
                          <th className="border border-gray-300 px-3 py-2 text-right">Prazos Pend.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {clientesData.processosPorCliente.map((cliente: any) => (
                          <tr key={cliente.nome}>
                            <td className="border border-gray-300 px-3 py-2">{cliente.nome}</td>
                            <td className="border border-gray-300 px-3 py-2 text-center">
                              {cliente.tipo === "pessoa_fisica" ? "PF" : "PJ"}
                            </td>
                            <td className="border border-gray-300 px-3 py-2 text-right font-semibold">{cliente.total}</td>
                            <td className="border border-gray-300 px-3 py-2 text-right text-green-600">{cliente.ativos}</td>
                            <td className="border border-gray-300 px-3 py-2 text-right">{cliente.encerrados}</td>
                            <td className="border border-gray-300 px-3 py-2 text-right text-amber-600">{cliente.prazosPendentes}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {clientesData.duracaoClientes?.length > 0 && (
                  <div className="mb-8">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">
                      {numClientes}.4 Duração Média dos Processos por Cliente
                    </h3>
                    <table className="w-full border-collapse border border-gray-300">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="border border-gray-300 px-4 py-2 text-left">Cliente</th>
                          <th className="border border-gray-300 px-4 py-2 text-right">Processos</th>
                          <th className="border border-gray-300 px-4 py-2 text-right">Média (dias)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {clientesData.duracaoClientes.map((cliente: any) => (
                          <tr key={cliente.nome}>
                            <td className="border border-gray-300 px-4 py-2">{cliente.nome}</td>
                            <td className="border border-gray-300 px-4 py-2 text-right">{cliente.processos}</td>
                            <td className="border border-gray-300 px-4 py-2 text-right">{cliente.mediaDias}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {clientesData.atividadesPorTarefa?.length > 0 && (
                  <div className="mb-8">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">
                      {numClientes}.5 Atividades por Tipo de Tarefa
                    </h3>
                    <table className="w-full border-collapse border border-gray-300">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="border border-gray-300 px-4 py-2 text-left">Tarefa</th>
                          <th className="border border-gray-300 px-4 py-2 text-right">Total</th>
                          <th className="border border-gray-300 px-4 py-2 text-right">Concluídas</th>
                          <th className="border border-gray-300 px-4 py-2 text-right">Atrasadas</th>
                        </tr>
                      </thead>
                      <tbody>
                        {clientesData.atividadesPorTarefa.map((tarefa: any) => (
                          <tr key={tarefa.titulo}>
                            <td className="border border-gray-300 px-4 py-2">{tarefa.titulo}</td>
                            <td className="border border-gray-300 px-4 py-2 text-right">{tarefa.total}</td>
                            <td className="border border-gray-300 px-4 py-2 text-right text-green-600">{tarefa.concluidas}</td>
                            <td className="border border-gray-300 px-4 py-2 text-right text-red-600">{tarefa.atrasadas}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </section>
        )}

        {/* ========== SEÇÃO COORDENAÇÕES ========== */}
        {showCompleto && completoData?.coordenacoes && completoData.coordenacoes.length > 0 && (
          <section className="mb-12 report-section">
            <h2 className="text-2xl font-bold text-gray-900 border-b-2 border-teal-600 pb-2 mb-6">
              {numCoordenacoes}. ESTRUTURA DAS COORDENAÇÕES
            </h2>

            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="border border-gray-300 rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-teal-600">{completoData.coordenacoes.length}</p>
                <p className="text-sm text-gray-600">Coordenações</p>
              </div>
              <div className="border border-gray-300 rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-blue-600">
                  {completoData.coordenacoes.reduce((acc, c) => acc + c.totalMembros, 0)}
                </p>
                <p className="text-sm text-gray-600">Total de Membros</p>
              </div>
              <div className="border border-gray-300 rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-purple-600">
                  {completoData.coordenacoes.reduce((acc, c) => acc + c.totalProcessos, 0)}
                </p>
                <p className="text-sm text-gray-600">Processos Vinculados</p>
              </div>
            </div>

            {/* Tabela resumo por coordenação */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">{numCoordenacoes}.1 Resumo por Coordenação</h3>
              <table className="w-full border-collapse border border-gray-300 text-sm">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-3 py-2 text-left">Coordenação</th>
                    <th className="border border-gray-300 px-3 py-2 text-left">Coordenador</th>
                    <th className="border border-gray-300 px-3 py-2 text-center">Membros</th>
                    <th className="border border-gray-300 px-3 py-2 text-right">Processos</th>
                    <th className="border border-gray-300 px-3 py-2 text-right">Distribuídos</th>
                    <th className="border border-gray-300 px-3 py-2 text-right">Não Distrib.</th>
                  </tr>
                </thead>
                <tbody>
                  {completoData.coordenacoes.map((coord) => (
                    <tr key={coord.id}>
                      <td className="border border-gray-300 px-3 py-2 font-medium">{coord.nome}</td>
                      <td className="border border-gray-300 px-3 py-2">{coord.coordenador}</td>
                      <td className="border border-gray-300 px-3 py-2 text-center">{coord.totalMembros}</td>
                      <td className="border border-gray-300 px-3 py-2 text-right font-semibold">{coord.totalProcessos}</td>
                      <td className="border border-gray-300 px-3 py-2 text-right text-green-600">{coord.processosDistribuidos}</td>
                      <td className="border border-gray-300 px-3 py-2 text-right text-amber-600">{coord.processosNaoDistribuidos}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Detalhamento por membro */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">{numCoordenacoes}.2 Processos por Membro</h3>
              {completoData.coordenacoes.map((coord) => (
                coord.membros.length > 0 && (
                  <div key={coord.id} className="mb-6">
                    <h4 className="text-base font-medium text-gray-700 mb-2 bg-gray-50 px-3 py-2 rounded">
                      {coord.nome} ({coord.membros.length} membros)
                    </h4>
                    <table className="w-full border-collapse border border-gray-300 text-sm">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="border border-gray-300 px-3 py-2 text-left">Membro</th>
                          <th className="border border-gray-300 px-3 py-2 text-left">Cargo</th>
                          <th className="border border-gray-300 px-3 py-2 text-right">Processos Atribuídos</th>
                        </tr>
                      </thead>
                      <tbody>
                        {coord.membros.map((m, i) => (
                          <tr key={i}>
                            <td className="border border-gray-300 px-3 py-2">{m.nome}</td>
                            <td className="border border-gray-300 px-3 py-2">{m.cargo}</td>
                            <td className="border border-gray-300 px-3 py-2 text-right font-semibold">{m.processos}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              ))}
            </div>
          </section>
        )}

        {/* ========== SEÇÃO AUDIÊNCIAS ========== */}
        {showCompleto && completoData?.audienciasStats && (
          <section className="mb-12 report-section">
            <h2 className="text-2xl font-bold text-gray-900 border-b-2 border-orange-600 pb-2 mb-6">
              {numAudiencias}. PAINEL DE AUDIÊNCIAS
            </h2>

            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="border border-gray-300 rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-gray-800">{completoData.audienciasStats.total}</p>
                <p className="text-sm text-gray-600">Total de Audiências</p>
              </div>
              <div className="border border-gray-300 rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-amber-600">{completoData.audienciasStats.pendentes}</p>
                <p className="text-sm text-gray-600">Pendentes</p>
              </div>
              <div className="border border-gray-300 rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-red-600">{completoData.audienciasStats.proximas7Dias}</p>
                <p className="text-sm text-gray-600">Próx. 7 Dias</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="border border-gray-300 rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-green-600">{completoData.audienciasStats.confirmadas}</p>
                <p className="text-sm text-gray-600">Confirmadas</p>
              </div>
              <div className="border border-gray-300 rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-blue-600">{completoData.audienciasStats.tratadas}</p>
                <p className="text-sm text-gray-600">Tratadas</p>
              </div>
              <div className="border border-gray-300 rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-gray-500">{completoData.audienciasStats.ignoradas}</p>
                <p className="text-sm text-gray-600">Ignoradas</p>
              </div>
            </div>
          </section>
        )}

        {/* ========== SEÇÃO INTIMAÇÕES ========== */}
        {showCompleto && completoData?.intimacoesStats && (
          <section className="mb-12 report-section">
            <h2 className="text-2xl font-bold text-gray-900 border-b-2 border-rose-600 pb-2 mb-6">
              {numIntimacoes}. PAINEL DE INTIMAÇÕES
            </h2>

            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="border border-gray-300 rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-gray-800">{completoData.intimacoesStats.total}</p>
                <p className="text-sm text-gray-600">Total de Intimações</p>
              </div>
              <div className="border border-gray-300 rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-amber-600">{completoData.intimacoesStats.pendentes}</p>
                <p className="text-sm text-gray-600">Pendentes</p>
              </div>
              <div className="border border-gray-300 rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-red-600">{completoData.intimacoesStats.vencidas}</p>
                <p className="text-sm text-gray-600">Vencidas</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="border border-gray-300 rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-orange-600">{completoData.intimacoesStats.proximas7Dias}</p>
                <p className="text-sm text-gray-600">Próx. 7 Dias</p>
              </div>
              <div className="border border-gray-300 rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-blue-600">{completoData.intimacoesStats.emAndamento}</p>
                <p className="text-sm text-gray-600">Em Andamento</p>
              </div>
              <div className="border border-gray-300 rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-green-600">{completoData.intimacoesStats.tratadas}</p>
                <p className="text-sm text-gray-600">Tratadas</p>
              </div>
            </div>
          </section>
        )}

        {/* ========== SEÇÃO DJEN ========== */}
        {showCompleto && completoData?.djenStats && (
          <section className="mb-12 report-section">
            <h2 className="text-2xl font-bold text-gray-900 border-b-2 border-cyan-600 pb-2 mb-6">
              {numDjen}. ANÁLISE DJEN (PUBLICAÇÕES)
            </h2>

            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="border border-gray-300 rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-gray-800">{completoData.djenStats.totalPublicacoes}</p>
                <p className="text-sm text-gray-600">Total de Publicações</p>
              </div>
              <div className="border border-gray-300 rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-amber-600">{completoData.djenStats.publicacoesNaoLidas}</p>
                <p className="text-sm text-gray-600">Não Lidas</p>
              </div>
              <div className="border border-gray-300 rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-green-600">{completoData.djenStats.publicacoesHoje}</p>
                <p className="text-sm text-gray-600">Capturadas Hoje</p>
              </div>
            </div>

            {completoData.djenStats.porCoordenacao.length > 0 && (
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">{numDjen}.1 Publicações por Coordenação</h3>
                <table className="w-full border-collapse border border-gray-300">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-300 px-4 py-2 text-left">Coordenação</th>
                      <th className="border border-gray-300 px-4 py-2 text-right">Total</th>
                      <th className="border border-gray-300 px-4 py-2 text-right">Não Lidas</th>
                      <th className="border border-gray-300 px-4 py-2 text-right">% Lidas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {completoData.djenStats.porCoordenacao.map((c) => (
                      <tr key={c.coordenacao}>
                        <td className="border border-gray-300 px-4 py-2">{c.coordenacao}</td>
                        <td className="border border-gray-300 px-4 py-2 text-right">{c.total}</td>
                        <td className="border border-gray-300 px-4 py-2 text-right text-amber-600">{c.naoLidas}</td>
                        <td className="border border-gray-300 px-4 py-2 text-right text-green-600">
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

        {/* ========== SEÇÃO NOTIFICAÇÕES ========== */}
        {showCompleto && completoData?.notificacoesStats && (
          <section className="mb-12 report-section">
            <h2 className="text-2xl font-bold text-gray-900 border-b-2 border-pink-600 pb-2 mb-6">
              {numNotificacoes}. CENTRAL DE NOTIFICAÇÕES
            </h2>

            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="border border-gray-300 rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-gray-800">{completoData.notificacoesStats.total}</p>
                <p className="text-sm text-gray-600">Total de Notificações</p>
              </div>
              <div className="border border-gray-300 rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-amber-600">{completoData.notificacoesStats.naoLidas}</p>
                <p className="text-sm text-gray-600">Não Lidas</p>
              </div>
              <div className="border border-gray-300 rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-red-600">{completoData.notificacoesStats.prazosUrgentes}</p>
                <p className="text-sm text-gray-600">Prazos Urgentes (3 dias)</p>
              </div>
            </div>
          </section>
        )}

        {/* Rodapé */}
        <footer className="mt-12 pt-6 border-t-2 border-gray-300 text-center text-sm text-gray-500">
          <p>Este relatório foi gerado automaticamente pelo sistema Juris Control.</p>
          <p className="mt-1">Documento destinado à Diretoria - Uso interno e confidencial.</p>
        </footer>
      </div>
    );
  }
);

RelatorioPrintView.displayName = "RelatorioPrintView";
