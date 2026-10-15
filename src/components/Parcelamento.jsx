import { useMemo } from 'react'
import { calcular } from '../../shared/parcelas'
import { brl, fmtData, parseMoeda } from '../lib/utils'

export const pct = (n) => `${String(n).replace('.', ',')}%`

/** Cálculo do parcelamento a partir dos campos de texto da tela (valor e parcela em formato brasileiro). */
export function useCalculo({ valor, parcela, n, data, modo }) {
  return useMemo(
    () => calcular({ valor: parseMoeda(valor), parcela: parseMoeda(parcela), n, data, modo }),
    [valor, parcela, n, data, modo],
  )
}

/** Escolha do que a data do calendário significa. */
export function OpcoesData({ modo, onChange, nome = 'modo' }) {
  return (
    <fieldset className="opcoes">
      <legend>Esta data é…</legend>
      <label><input type="radio" name={nome} checked={modo === 'inicio'} onChange={() => onChange('inicio')} /><span>o <b>início do contrato</b>: a 1ª parcela vence 30 dias (1 mês) depois</span></label>
      <label><input type="radio" name={nome} checked={modo === 'parcela'} onChange={() => onChange('parcela')} /><span>o <b>vencimento da 1ª parcela</b>: as parcelas começam nesta data</span></label>
    </fieldset>
  )
}

/** Painel "Cálculo automático": total, juros, taxa e datas. */
export function PainelCalculo({ calc }) {
  return (
    <div className="calc" aria-live="polite">
      <b>Cálculo automático</b>
      {!calc && <div className="muted">Preencha valor emprestado, valor da parcela, quantidade de parcelas e a data para ver o total, os juros e as datas.</div>}
      {calc && calc.semJuros && <div className="neg">As parcelas somam menos que o valor emprestado. Confira o valor da parcela.</div>}
      {calc && !calc.semJuros && (
        <>
          <div className="calc-grade">
            <div><small className="muted">Total a pagar</small><b>{brl(calc.total)}</b></div>
            <div><small className="muted">Valor dos juros</small><b className="gold">{brl(calc.juros)}</b></div>
            <div><small className="muted">Juros sobre o valor emprestado</small><b>{pct(calc.jurosPctTotal)} no total</b></div>
            <div><small className="muted">Taxa equivalente</small><b>{pct(calc.taxaMes)} ao mês</b></div>
            <div><small className="muted">1ª parcela</small><b>{fmtData(calc.primeira)}</b></div>
            <div><small className="muted">Última parcela</small><b>{fmtData(calc.ultima)}</b></div>
          </div>
          <div className="muted" style={{ fontSize: 12 }}>{calc.n}x de {brl(calc.parcela)} para pagar {brl(calc.valor)}, sempre no mesmo dia de cada mês.</div>
          <details>
            <summary className="muted" style={{ cursor: 'pointer', fontSize: 12 }}>Ver as {calc.n} datas de vencimento</summary>
            <ol className="datas">
              {calc.datas.map((d, i) => <li key={d}>{i + 1}ª · {fmtData(d)} · {brl(calc.parcela)}</li>)}
            </ol>
          </details>
        </>
      )}
    </div>
  )
}
