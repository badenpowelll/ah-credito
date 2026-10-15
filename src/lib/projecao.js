import { proximoDiaUtil, somaMeses, taxaMensal } from '../../shared/parcelas.js'

const dois = (n) => String(n).padStart(2, '0')
const mesDe = (d) => `${d.getFullYear()}-${dois(d.getMonth() + 1)}`
const arred = (n) => Math.round((n + Number.EPSILON) * 100) / 100

/**
 * Projeção do que há para receber nos próximos 12 meses (a partir do mês atual), separando cada parcela em
 * juros e capital (valor emprestado devolvido). Os juros incidem sobre o saldo devedor (parcelas iguais, Tabela Price):
 *  - Clientes com parcelamento definido: as datas vêm do 1º vencimento e a taxa é a que fecha as parcelas.
 *  - Clientes sem parcelamento: a parcela mensal se repete a partir do mês atual até quitar o valor emprestado,
 *    com a taxa "juros ao mês" do cadastro.
 * Parcelas já pagas não entram. Parcelas vencidas e não pagas (só dá para saber nos clientes com parcelamento)
 * entram no mês atual e aparecem também em "atrasadas".
 */
export function projetar12Meses(debtors, hoje = new Date()) {
  const atual = mesDe(hoje)
  const hojeS = `${atual}-${dois(hoje.getDate())}`
  const meses = Array.from({ length: 12 }, (_, i) => somaMeses(`${atual}-01`, i).slice(0, 7))
  const pos = Object.fromEntries(meses.map((m, i) => [m, i]))
  const linhas = meses.map((mes) => ({ mes, parcelas: 0, juros: 0, principal: 0, qtd: 0, clientes: new Set() }))
  const atrasadas = { valor: 0, quantidade: 0 }
  let semDados = 0

  for (const d of debtors) {
    const P = Number(d.valorParcela) || 0
    const V = Number(d.valorEmprestado) || 0
    if (!(P > 0) || !(V > 0)) { semDados++; continue }
    const pagos = new Set(d.pagos || [])
    const comPlano = Boolean(d.parcelas && d.primeiroVencimento)
    const n = comPlano ? Number(d.parcelas) : null
    const taxa = comPlano ? (taxaMensal(V, P, n) ?? 0) : (Number(d.jurosPct) || 0) / 100

    // cronograma de amortização desde o início do empréstimo
    const limite = comPlano ? n : pagos.size + 24
    const cronograma = []
    let saldo = V
    for (let k = 0; k < limite && saldo > 0.005; k++) {
      let juros = saldo * taxa
      let valor = P
      let principal = valor - juros
      if (principal < 0) { principal = 0; juros = Math.min(P, juros) }
      if (principal > saldo) { principal = saldo; valor = principal + juros }
      saldo -= principal
      cronograma.push({ valor, juros, principal })
    }

    const somar = (mes, p, atrasada) => {
      const l = linhas[pos[mes]]
      l.parcelas += p.valor; l.juros += p.juros; l.principal += p.principal; l.qtd++; l.clientes.add(d.id)
      if (atrasada) { atrasadas.valor += p.valor; atrasadas.quantidade++ }
    }

    if (comPlano) {
      cronograma.forEach((p, k) => {
        const nominal = somaMeses(d.primeiroVencimento, k)
        if (pagos.has(nominal.slice(0, 7))) return
        const data = proximoDiaUtil(nominal) // domingo passa para segunda
        if (data < hojeS) somar(atual, p, true)
        else if (pos[data.slice(0, 7)] !== undefined) somar(data.slice(0, 7), p, false)
      })
    } else {
      const restantes = cronograma.slice(pagos.size)
      const primeiro = pagos.has(atual) ? somaMeses(`${atual}-01`, 1).slice(0, 7) : atual
      restantes.forEach((p, j) => {
        const mes = somaMeses(`${primeiro}-01`, j).slice(0, 7)
        if (pos[mes] !== undefined) somar(mes, p, false)
      })
    }
  }

  const lista = linhas.map((l) => ({ mes: l.mes, parcelas: arred(l.parcelas), juros: arred(l.juros), principal: arred(l.principal), qtd: l.qtd, clientes: l.clientes.size }))
  const soma = (campo) => arred(lista.reduce((s, l) => s + l[campo], 0))
  return {
    meses: lista,
    total: { parcelas: soma('parcelas'), juros: soma('juros'), principal: soma('principal') },
    atrasadas: { valor: arred(atrasadas.valor), quantidade: atrasadas.quantidade },
    semDados,
  }
}
