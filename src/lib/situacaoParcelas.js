import { proximoDiaUtil, somaMeses } from '../../shared/parcelas.js'
import { hojeISO } from './utils'

/** Situação de uma parcela: paga (o mês dela está em "pagos"), atrasada (venceu e não foi paga) ou em dia. */
export function statusParcela(dataISO, pagos = [], hoje = hojeISO(), mesChave = dataISO.slice(0, 7)) {
  if (new Set(pagos).has(mesChave)) return 'pago'
  return dataISO < hoje ? 'atrasado' : 'em_dia'
}

/** Todas as parcelas de um cliente com parcelamento definido, já com a situação de cada uma. */
export function listaParcelas(d, hoje = hojeISO()) {
  if (!d?.parcelas || !d.primeiroVencimento) return []
  return Array.from({ length: Number(d.parcelas) }, (_, i) => {
    const nominal = somaMeses(d.primeiroVencimento, i)
    const data = proximoDiaUtil(nominal) // domingo passa para segunda
    return { n: i + 1, data, nominal, mes: nominal.slice(0, 7), valor: Number(d.valorParcela) || 0, status: statusParcela(data, d.pagos, hoje, nominal.slice(0, 7)) }
  })
}

export const ROTULO_PARCELA = { pago: 'PAGO', atrasado: 'ATRASADO', em_dia: 'EM DIA' }
export const CLASSE_PARCELA = { pago: 'b-pago', atrasado: 'b-atrasado', em_dia: 'b-a_cobrar' } // verde, vermelho, amarelo
