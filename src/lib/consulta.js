import { MESES, brl, fmtData, mesAtual, statusDe } from './utils'

/** Consulta local aos dados do sistema. Só informa o que está cadastrado; não dá opinião nem avalia risco. */

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
const tem = (q, ...ps) => ps.some((p) => q.includes(p))
const ROTULO = { pago: 'PAGO', atrasado: 'ATRASADO', a_cobrar: 'A COBRAR' }

export function diasAtraso(d, hoje = new Date()) {
  return statusDe(d, hoje) === 'atrasado' ? Math.max(0, hoje.getDate() - Number(d.diaVencimento || 1)) : 0
}
const linhaCliente = (d) => `• ${d.nome} — parcela ${brl(d.valorParcela)}, vence dia ${d.diaVencimento} (${ROTULO[statusDe(d)]})`
const soma = (l, f) => l.reduce((s, x) => s + (Number(f(x)) || 0), 0)

function fichaCliente(d, logs) {
  const st = statusDe(d)
  const nl = logs.filter((l) => l.debtorId === d.id).slice(0, 3)
  return [
    `${d.nome} — ${ROTULO[st]}${st === 'atrasado' ? ` (${diasAtraso(d)} dia(s) de atraso)` : ''}`,
    `Telefone: ${d.telefone || 'não cadastrado'}`,
    `Endereço: ${[d.endereco, d.numero, d.complemento, d.cidade, d.cep && 'CEP ' + d.cep].filter(Boolean).join(', ') || 'não cadastrado'}`,
    `Emprestado: ${brl(d.valorEmprestado)} · Parcela mensal: ${brl(d.valorParcela)} · Juros: ${d.jurosPct || 0}% a.m.`,
    `Vencimento: dia ${d.diaVencimento} · Meses pagos: ${(d.pagos || []).join(', ') || 'nenhum'}`,
    d.cpf ? `CPF: ${d.cpf}${d.rg ? ` · RG: ${d.rg}` : ''}${d.email ? ` · E-mail: ${d.email}` : ''}` : null,
    d.banco || d.agencia || d.conta
      ? `Banco: ${[d.banco, d.agencia && `ag. ${d.agencia}`, d.conta && `conta ${d.conta}${d.tipoConta ? ` (${d.tipoConta})` : ''}`, d.titularConta && `titular ${d.titularConta}`].filter(Boolean).join(' · ')}`
      : null,
    d.chavePix ? `PIX do cliente${d.tipoChavePix ? ` (${d.tipoChavePix})` : ''}: ${d.chavePix}` : null,
    nl.length ? 'Últimas anotações:\n' + nl.map((l) => `  - ${fmtData(l.data)}: ${l.texto}`).join('\n') : null,
  ].filter(Boolean).join('\n')
}

function resumoCarteira(debtors) {
  const por = (s) => debtors.filter((d) => statusDe(d) === s)
  const at = por('atrasado'), ac = por('a_cobrar'), pg = por('pago')
  return [
    `Clientes cadastrados: ${debtors.length}`,
    `Total emprestado: ${brl(soma(debtors, (d) => d.valorEmprestado))}`,
    `A receber por mês: ${brl(soma(debtors, (d) => d.valorParcela))}`,
    `Recebido no mês: ${brl(soma(pg, (d) => d.valorParcela))} (${pg.length} cliente(s))`,
    `A cobrar: ${ac.length} cliente(s) · ${brl(soma(ac, (d) => d.valorParcela))}`,
    `Atrasados: ${at.length} cliente(s) · ${brl(soma(at, (d) => d.valorParcela))}`,
  ].join('\n')
}

function resumoFinanceiro(transactions) {
  const m = mesAtual()
  const doMes = transactions.filter((t) => t.data.startsWith(m))
  const e = (l) => soma(l.filter((t) => t.tipo === 'entrada'), (t) => t.valor)
  const s = (l) => soma(l.filter((t) => t.tipo === 'saida'), (t) => t.valor)
  return [
    `Total de entradas: ${brl(e(transactions))}`,
    `Total de saídas: ${brl(s(transactions))}`,
    `Saldo atual: ${brl(e(transactions) - s(transactions))}`,
    `Mês atual (${MESES[+m.slice(5) - 1]}/${m.slice(0, 4)}): entradas ${brl(e(doMes))} · saídas ${brl(s(doMes))} · saldo ${brl(e(doMes) - s(doMes))}`,
  ].join('\n')
}

export function responder(pergunta, { debtors, transactions, pixKeys, logs, trashed = [] }) {
  const q = norm(pergunta)
  const hoje = new Date()
  const nada = (o) => `Não há ${o} cadastrados no sistema.`

  // 1) Cliente citado pelo nome
  const achado = debtors.filter((d) => {
    const nome = norm(d.nome)
    return q.includes(nome) || nome.split(' ').some((p) => p.length >= 3 && new RegExp(`\\b${p}\\b`).test(q))
  })
  if (achado.length && !tem(q, 'todos os clientes', 'lista de clientes')) return achado.map((d) => fichaCliente(d, logs)).join('\n\n')

  // 2) Financeiro (movimentações)
  if (tem(q, 'saldo', 'entrada', 'saida', 'despesa', 'categoria', 'movimenta', 'gasto', 'financeiro', 'resumo do mes', 'caixa')) {
    if (!transactions.length) return nada('movimentações')
    if (tem(q, 'categoria', 'despesa', 'gasto')) {
      const c = {}
      transactions.filter((t) => t.tipo === 'saida').forEach((t) => { const k = t.categoria || 'Sem categoria'; c[k] = (c[k] || 0) + t.valor })
      const l = Object.entries(c).sort((a, b) => b[1] - a[1])
      return l.length ? 'Despesas por categoria:\n' + l.map(([k, v]) => `• ${k}: ${brl(v)}`).join('\n') : 'Não há saídas cadastradas.'
    }
    if (tem(q, 'ultima', 'recente', 'movimenta')) {
      return 'Últimas movimentações:\n' + [...transactions].sort((a, b) => b.data.localeCompare(a.data)).slice(0, 8)
        .map((t) => `• ${fmtData(t.data)} · ${t.tipo === 'entrada' ? 'Entrada' : 'Saída'} · ${t.descricao} · ${brl(t.valor)}`).join('\n')
    }
    return resumoFinanceiro(transactions)
  }

  // 3) Chaves PIX
  if (tem(q, 'pix', 'chave')) return pixKeys.length ? 'Chaves PIX cadastradas:\n' + pixKeys.map((k) => `• PIX ${k.titular} — ${k.banco}: ${k.chave}`).join('\n') : nada('chaves PIX')

  if (tem(q, 'lixeira', 'excluido', 'removido')) return trashed.length ? 'Na lixeira:\n' + trashed.map((d) => `• ${d.nome} (removido em ${fmtData(d.deletedAt)})`).join('\n') : 'A lixeira está vazia.'

  // 4) Clientes
  if (!debtors.length) return nada('clientes')
  const lista = (titulo, l) => (l.length ? `${titulo} (${l.length}):\n${l.map(linhaCliente).join('\n')}` : `${titulo}: nenhum cliente.`)

  if (tem(q, 'atrasad', 'atraso', 'inadimpl', 'ranking', 'risco', 'limite', 'atencao', 'imediat')) {
    const l = debtors.filter((d) => statusDe(d) === 'atrasado').sort((a, b) => diasAtraso(b) - diasAtraso(a))
    return l.length ? `Clientes atrasados (${l.length}), do maior para o menor atraso:\n` + l.map((d) => `• ${d.nome} — ${diasAtraso(d)} dia(s) de atraso, parcela ${brl(d.valorParcela)}, vencimento dia ${d.diaVencimento}`).join('\n') : 'Nenhum cliente atrasado.'
  }
  if (tem(q, 'a cobrar', 'pendente', 'cobrar')) return lista('Clientes a cobrar', debtors.filter((d) => statusDe(d) === 'a_cobrar'))
  if (tem(q, 'pago', 'pagaram', 'quitou', 'recebido', 'receb')) {
    const pg = debtors.filter((d) => statusDe(d) === 'pago')
    return `Recebido no mês: ${brl(soma(pg, (d) => d.valorParcela))}\n` + lista('Clientes que pagaram no mês', pg) + `\nAinda a receber no mês: ${brl(soma(debtors.filter((d) => statusDe(d) !== 'pago'), (d) => d.valorParcela))}`
  }
  if (tem(q, 'venc', 'proximo', 'hoje', 'semana')) {
    const d0 = hoje.getDate()
    const l = debtors.filter((d) => statusDe(d) !== 'pago').map((d) => ({ d, f: Number(d.diaVencimento) - d0 })).filter((x) => x.f >= 0 && x.f <= 7).sort((a, b) => a.f - b.f)
    return l.length ? 'Vencimentos nos próximos 7 dias:\n' + l.map(({ d, f }) => `• ${f === 0 ? 'HOJE' : `em ${f} dia(s)`} (dia ${d.diaVencimento}) — ${d.nome}, ${brl(d.valorParcela)}`).join('\n') : 'Nenhum vencimento (sem pagamento) nos próximos 7 dias.'
  }
  if (tem(q, 'lista', 'todos', 'clientes', 'cadastrad', 'quem')) return lista('Clientes cadastrados', debtors)
  if (tem(q, 'emprestado', 'carteira', 'resumo', 'total', 'quanto', 'geral', 'saude')) return resumoCarteira(debtors)

  return 'Não entendi a pergunta. Posso informar: resumo da carteira, clientes atrasados, a cobrar ou pagos, vencimentos dos próximos dias, ficha de um cliente (digite o nome), chaves PIX, saldo e despesas.'
}
