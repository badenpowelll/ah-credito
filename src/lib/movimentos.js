import { hojeISO } from './utils'

/**
 * Movimentos de caixa gerados automaticamente a partir dos empréstimos (nada é gravado a mais: são calculados
 * sempre que a tela abre, então Empréstimos e Dashboard nunca divergem).
 *  - Saída: cada empréstimo concedido (valor emprestado), na data do contrato ou do cadastro.
 *  - Entrada: cada parcela marcada como paga (valor da parcela), na data em que foi marcada.
 */
export function movimentosDeEmprestimos(debtors, logs) {
  const saida = []
  for (const d of debtors) {
    const dataEmprestimo = d.dataContrato || d.criadoEm
    if (Number(d.valorEmprestado) > 0 && dataEmprestimo) {
      saida.push({
        id: `auto-emp-${d.id}`, auto: true, clienteId: d.id, data: dataEmprestimo, tipo: 'saida',
        descricao: `Empréstimo concedido — ${d.nome}`, categoria: 'Empréstimos concedidos', pagamento: '—', valor: Number(d.valorEmprestado),
      })
    }
    for (const mes of d.pagos || []) {
      if (!(Number(d.valorParcela) > 0)) continue
      const registro = logs.find((l) => l.debtorId === d.id && l.tipo === 'pagamento' && l.texto.includes(mes))
      const dia = String(Math.min(28, Number(d.diaVencimento) || 1)).padStart(2, '0')
      saida.push({
        id: `auto-pg-${d.id}-${mes}`, auto: true, clienteId: d.id,
        data: registro ? hojeISO(new Date(registro.data)) : `${mes}-${dia}`, tipo: 'entrada',
        descricao: `Parcela recebida — ${d.nome} (${mes.slice(5)}/${mes.slice(0, 4)})`, categoria: 'Parcelas de empréstimos', pagamento: '—', valor: Number(d.valorParcela),
      })
    }
  }
  return saida
}
