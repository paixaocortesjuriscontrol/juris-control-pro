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

interface RelatorioPrintViewProps {
  resumoData: any;
  atividadesData: any;
  clientesData: any;
}

export const RelatorioPrintView = forwardRef<HTMLDivElement, RelatorioPrintViewProps>(
  ({ resumoData, atividadesData, clientesData }, ref) => {
    const dataGeracao = format(new Date(), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR });

    return (
      <div ref={ref} className="hidden print:block bg-white text-black p-8 print:p-0">
        {/* Cabeçalho */}
        <div className="text-center border-b-2 border-gray-800 pb-6 mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">RELATÓRIO GERENCIAL</h1>
          <p className="text-lg text-gray-600">Análise Completa do Escritório</p>
          <p className="text-sm text-gray-500 mt-2">Gerado em: {dataGeracao}</p>
        </div>

        {/* ========== SEÇÃO RESUMO ========== */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 border-b-2 border-blue-600 pb-2 mb-6">
            1. RESUMO EXECUTIVO
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
                {/* Processos por Área - Gráfico */}
                <PrintDonutChart
                  data={resumoData.processosPerArea || []}
                  title="1.1 Processos por Área de Atuação"
                  centerLabel={resumoData.totalProcessos?.toString()}
                />

                {/* Tipo de Pessoa - Gráfico */}
                <PrintDonutChart
                  data={resumoData.processosPorTipoPessoa || []}
                  title="1.2 Processos por Tipo de Pessoa"
                />
              </div>

              {/* Movimentação Mensal - Gráfico */}
              <div className="mb-8">
                <PrintGroupedBarChart
                  data={resumoData.processosMensais || []}
                  title="1.3 Movimentação Mensal (Novos vs Encerrados)"
                />
              </div>

              {/* MPT por Status - Gráfico */}
              {resumoData.processosMptStatus && resumoData.processosMptStatus.length > 0 && (
                <div className="mb-8">
                  <PrintStatusChart
                    data={resumoData.processosMptStatus}
                    title="1.4 Processos do Ministério Público por Situação"
                    total={resumoData.processosMptStatus.reduce((acc: number, s: any) => acc + s.value, 0)}
                  />
                </div>
              )}

              {/* Tabela de Resumo por Área */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">1.5 Detalhamento por Área</h3>
                <table className="w-full border-collapse border border-gray-300">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-300 px-4 py-2 text-left">Área</th>
                      <th className="border border-gray-300 px-4 py-2 text-right">Quantidade</th>
                      <th className="border border-gray-300 px-4 py-2 text-right">Percentual</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resumoData.processosPerArea?.filter((a: any) => a.value > 0).map((area: any) => (
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

        {/* ========== SEÇÃO ATIVIDADES ========== */}
        <section className="mb-12 break-before-page">
          <h2 className="text-2xl font-bold text-gray-900 border-b-2 border-green-600 pb-2 mb-6">
            2. CONTROLE DE ATIVIDADES E PRAZOS
          </h2>

          {atividadesData && (
            <>
              {/* Resumo de Atividades */}
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

              {/* Gráficos de Atividades */}
              <div className="grid grid-cols-2 gap-8 mb-8">
                {/* Status de Prazos - Gráfico */}
                <PrintStatusChart
                  data={atividadesData.prazosStatus || []}
                  title="2.1 Status dos Prazos"
                  total={atividadesData.totalPrazos || 0}
                />

                {/* Andamentos por Área - Gráfico */}
                <PrintDonutChart
                  data={atividadesData.andamentosPorArea || []}
                  title="2.2 Andamentos por Área"
                />
              </div>

              {/* Evolução Anual - Gráfico */}
              {atividadesData.evolucaoAndamentos?.length > 0 && (
                <div className="mb-8">
                  <PrintYearlyChart
                    data={atividadesData.evolucaoAndamentos}
                    title="2.3 Evolução dos Andamentos por Ano"
                  />
                </div>
              )}

              {/* Tabela de Atividades por Área */}
              {atividadesData.atividadesPorArea?.some((a: any) => a.concluidas > 0 || a.pendentes > 0) && (
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">2.4 Atividades por Área de Atuação</h3>
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
                      {atividadesData.atividadesPorArea?.filter((a: any) => a.concluidas > 0 || a.pendentes > 0).map((area: any) => (
                        <tr key={area.name}>
                          <td className="border border-gray-300 px-4 py-2">{area.name}</td>
                          <td className="border border-gray-300 px-4 py-2 text-right text-green-600">{area.concluidas}</td>
                          <td className="border border-gray-300 px-4 py-2 text-right text-amber-600">{area.pendentes}</td>
                          <td className="border border-gray-300 px-4 py-2 text-right font-semibold">{area.concluidas + area.pendentes}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </section>

        {/* ========== SEÇÃO CLIENTES ========== */}
        <section className="break-before-page">
          <h2 className="text-2xl font-bold text-gray-900 border-b-2 border-purple-600 pb-2 mb-6">
            3. ANÁLISE POR CLIENTES
          </h2>

          {clientesData && (
            <>
              {/* Resumo Clientes */}
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

              {/* Gráficos de Clientes */}
              <div className="grid grid-cols-2 gap-8 mb-8">
                {/* Top Varas - Gráfico */}
                {clientesData.processosPorVara?.length > 0 && (
                  <PrintHorizontalBarChart
                    data={clientesData.processosPorVara.slice(0, 8).map((v: any) => ({
                      name: v.vara?.substring(0, 20) || "N/A",
                      value: v.total,
                      color: "#8B5CF6"
                    }))}
                    title="3.1 Processos por Vara (Top 8)"
                  />
                )}

                {/* Produtividade - Gráfico */}
                {clientesData.produtividadeAdvogados?.length > 0 && (
                  <PrintHorizontalBarChart
                    data={clientesData.produtividadeAdvogados.map((a: any, i: number) => ({
                      name: a.nome?.substring(0, 15) || "N/A",
                      value: a.processos,
                      color: ["#3B82F6", "#22C55E", "#F59E0B", "#EF4444", "#8B5CF6"][i % 5]
                    }))}
                    title="3.2 Produtividade da Equipe"
                  />
                )}
              </div>

              {/* Processos por Cliente - Tabela */}
              {clientesData.processosPorCliente?.length > 0 && (
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">3.3 Processos por Cliente</h3>
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
                      {clientesData.processosPorCliente.slice(0, 15).map((cliente: any) => (
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
                  {clientesData.processosPorCliente.length > 15 && (
                    <p className="text-xs text-gray-500 mt-2 italic">
                      * Exibindo os 15 principais clientes de um total de {clientesData.processosPorCliente.length}
                    </p>
                  )}
                </div>
              )}

              {/* Duração por Cliente - Tabela */}
              {clientesData.duracaoClientes?.length > 0 && (
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">3.4 Duração Média dos Processos por Cliente</h3>
                  <table className="w-full border-collapse border border-gray-300">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border border-gray-300 px-4 py-2 text-left">Cliente</th>
                        <th className="border border-gray-300 px-4 py-2 text-right">Processos</th>
                        <th className="border border-gray-300 px-4 py-2 text-right">Média (dias)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clientesData.duracaoClientes.slice(0, 10).map((cliente: any) => (
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

              {/* Atividades por Tarefa - Tabela */}
              {clientesData.atividadesPorTarefa?.length > 0 && (
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">3.5 Atividades por Tipo de Tarefa</h3>
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
