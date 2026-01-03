import { forwardRef } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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
          <h2 className="text-2xl font-bold text-gray-900 border-b-2 border-primary pb-2 mb-6">
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

              {/* Processos por Área */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">1.1 Processos por Área de Atuação</h3>
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
                        <td className="border border-gray-300 px-4 py-2">{area.name}</td>
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

              {/* Tipo de Pessoa */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">1.2 Processos por Tipo de Pessoa</h3>
                <div className="grid grid-cols-2 gap-4">
                  {resumoData.processosPorTipoPessoa?.map((tipo: any) => (
                    <div key={tipo.name} className="border border-gray-300 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold" style={{ color: tipo.color }}>{tipo.value}</p>
                      <p className="text-sm text-gray-600">{tipo.name}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* MPT por Status */}
              {resumoData.processosMptStatus && resumoData.processosMptStatus.length > 0 && (
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">1.3 Processos do Ministério Público por Situação</h3>
                  <table className="w-full border-collapse border border-gray-300">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border border-gray-300 px-4 py-2 text-left">Status</th>
                        <th className="border border-gray-300 px-4 py-2 text-right">Quantidade</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resumoData.processosMptStatus.filter((s: any) => s.value > 0).map((status: any) => (
                        <tr key={status.name}>
                          <td className="border border-gray-300 px-4 py-2">{status.name}</td>
                          <td className="border border-gray-300 px-4 py-2 text-right">{status.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Movimentação Mensal */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">1.4 Movimentação Mensal</h3>
                <table className="w-full border-collapse border border-gray-300">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-300 px-4 py-2 text-left">Mês</th>
                      <th className="border border-gray-300 px-4 py-2 text-right">Novos</th>
                      <th className="border border-gray-300 px-4 py-2 text-right">Encerrados</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resumoData.processosMensais?.map((mes: any) => (
                      <tr key={mes.mes}>
                        <td className="border border-gray-300 px-4 py-2">{mes.mes}</td>
                        <td className="border border-gray-300 px-4 py-2 text-right">{mes.novos}</td>
                        <td className="border border-gray-300 px-4 py-2 text-right">{mes.encerrados}</td>
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
          <h2 className="text-2xl font-bold text-gray-900 border-b-2 border-primary pb-2 mb-6">
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

              {/* Status de Prazos */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">2.1 Status dos Prazos</h3>
                <table className="w-full border-collapse border border-gray-300">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-300 px-4 py-2 text-left">Status</th>
                      <th className="border border-gray-300 px-4 py-2 text-right">Quantidade</th>
                      <th className="border border-gray-300 px-4 py-2 text-right">Percentual</th>
                    </tr>
                  </thead>
                  <tbody>
                    {atividadesData.prazosStatus?.map((status: any) => (
                      <tr key={status.name}>
                        <td className="border border-gray-300 px-4 py-2">{status.name}</td>
                        <td className="border border-gray-300 px-4 py-2 text-right">{status.value}</td>
                        <td className="border border-gray-300 px-4 py-2 text-right">
                          {atividadesData.totalPrazos > 0 
                            ? ((status.value / atividadesData.totalPrazos) * 100).toFixed(1) 
                            : 0}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Atividades por Área */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">2.2 Atividades por Área de Atuação</h3>
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

              {/* Andamentos por Área */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">2.3 Andamentos por Área</h3>
                <table className="w-full border-collapse border border-gray-300">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-300 px-4 py-2 text-left">Área</th>
                      <th className="border border-gray-300 px-4 py-2 text-right">Quantidade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {atividadesData.andamentosPorArea?.filter((a: any) => a.value > 0).map((area: any) => (
                      <tr key={area.name}>
                        <td className="border border-gray-300 px-4 py-2">{area.name}</td>
                        <td className="border border-gray-300 px-4 py-2 text-right">{area.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Evolução Anual */}
              {atividadesData.evolucaoAndamentos?.length > 0 && (
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">2.4 Evolução dos Andamentos por Ano</h3>
                  <table className="w-full border-collapse border border-gray-300">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border border-gray-300 px-4 py-2 text-left">Ano</th>
                        <th className="border border-gray-300 px-4 py-2 text-right">Andamentos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {atividadesData.evolucaoAndamentos.map((ano: any) => (
                        <tr key={ano.ano}>
                          <td className="border border-gray-300 px-4 py-2">{ano.ano}</td>
                          <td className="border border-gray-300 px-4 py-2 text-right">{ano.total}</td>
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
          <h2 className="text-2xl font-bold text-gray-900 border-b-2 border-primary pb-2 mb-6">
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

              {/* Processos por Cliente */}
              {clientesData.processosPorCliente?.length > 0 && (
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">3.1 Processos por Cliente</h3>
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

              {/* Processos por Vara */}
              {clientesData.processosPorVara?.length > 0 && (
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">3.2 Processos por Vara</h3>
                  <table className="w-full border-collapse border border-gray-300">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border border-gray-300 px-4 py-2 text-left">Vara</th>
                        <th className="border border-gray-300 px-4 py-2 text-right">Processos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clientesData.processosPorVara.map((item: any) => (
                        <tr key={item.vara}>
                          <td className="border border-gray-300 px-4 py-2">{item.vara}</td>
                          <td className="border border-gray-300 px-4 py-2 text-right">{item.total}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Duração por Cliente */}
              {clientesData.duracaoClientes?.length > 0 && (
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">3.3 Duração Média dos Processos por Cliente</h3>
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

              {/* Atividades por Tarefa */}
              {clientesData.atividadesPorTarefa?.length > 0 && (
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">3.4 Atividades por Tipo de Tarefa</h3>
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

              {/* Produtividade */}
              {clientesData.produtividadeAdvogados?.length > 0 && (
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">3.5 Produtividade da Equipe</h3>
                  <table className="w-full border-collapse border border-gray-300">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border border-gray-300 px-4 py-2 text-center">Ranking</th>
                        <th className="border border-gray-300 px-4 py-2 text-left">Advogado</th>
                        <th className="border border-gray-300 px-4 py-2 text-right">Processos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clientesData.produtividadeAdvogados.map((adv: any, index: number) => (
                        <tr key={adv.nome}>
                          <td className="border border-gray-300 px-4 py-2 text-center font-bold">{index + 1}º</td>
                          <td className="border border-gray-300 px-4 py-2">{adv.nome}</td>
                          <td className="border border-gray-300 px-4 py-2 text-right">{adv.processos}</td>
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
          <p>Documento destinado à Diretoria - Uso interno e confidencial.</p>
        </footer>
      </div>
    );
  }
);

RelatorioPrintView.displayName = "RelatorioPrintView";
