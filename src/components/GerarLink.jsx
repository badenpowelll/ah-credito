import { useMemo, useState } from 'react'
import { Field, Modal, MoneyInput, ZapLinks } from './ui'
import { api } from '../lib/api'
import { msgCadastro } from '../lib/cadastro'
import { useStore } from '../lib/store'
import { brl, fmtData, parseMoeda } from '../lib/utils'
import { baixarModelo, lerPlanilha } from '../lib/planilha'
import { calcular } from '../../shared/parcelas'

const pct = (n) => `${String(n).replace('.', ',')}%`

export default function GerarLink({ onClose }) {
  const [f, setF] = useState({ valor: '', parcela: '', n: '', data: '', modo: 'inicio' })
  const [link, setLink] = useState('')
  const [copiado, setCopiado] = useState('')
  const [erro, setErro] = useState('')
  const [gerando, setGerando] = useState(false)
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))

  const calc = useMemo(
    () => calcular({ valor: parseMoeda(f.valor), parcela: parseMoeda(f.parcela), n: f.n, data: f.data, modo: f.modo }),
    [f],
  )
  const pronto = Boolean(calc) && !calc.semJuros

  const gerar = async (e) => {
    e.preventDefault()
    setErro('')
    setGerando(true)
    try {
      const { token } = await api.post('/links', { v: parseMoeda(f.valor), p: parseMoeda(f.parcela), n: parseInt(f.n, 10), data: f.data, modo: f.modo })
      setLink(location.href.split('#')[0] + '#cad-' + token)
    } catch (err) {
      setErro(err.message)
    }
    setGerando(false)
  }
  const copiar = async () => {
    try { await navigator.clipboard.writeText(link); setCopiado('Link copiado!') } catch { setCopiado('Selecione o link e copie (Ctrl+C).') }
  }

  return (
    <Modal title="Gerar Link de Cadastro" onClose={onClose}>
      <p className="muted" style={{ marginTop: -6 }}>
        Defina o empréstimo e as parcelas e gere um link único para o cliente. O cadastro preenchido entra direto em Clientes.
      </p>
      {!link ? (
        <form onSubmit={gerar} className="form" style={{ gridTemplateColumns: '1fr' }}>
          <Field label="Valor Emprestado (R$) *"><MoneyInput value={f.valor} onChange={(v) => setF((x) => ({ ...x, valor: v }))} required /></Field>
          <Field label="Valor da parcela (R$) *"><MoneyInput value={f.parcela} onChange={(v) => setF((x) => ({ ...x, parcela: v }))} required /></Field>
          <Field label="Quantidade de parcelas *">
            <input type="number" min="1" max="120" inputMode="numeric" placeholder="Ex.: 12" value={f.n} onChange={set('n')} required />
          </Field>
          <Field label="Data *  (clique para abrir o calendário)">
            <input type="date" value={f.data} onChange={set('data')} required />
          </Field>
          <fieldset className="opcoes">
            <legend>Esta data é…</legend>
            <label><input type="radio" name="modo" checked={f.modo === 'inicio'} onChange={() => setF((x) => ({ ...x, modo: 'inicio' }))} /> o <b>início do contrato</b>: a 1ª parcela vence 30 dias (1 mês) depois</label>
            <label><input type="radio" name="modo" checked={f.modo === 'parcela'} onChange={() => setF((x) => ({ ...x, modo: 'parcela' }))} /> o <b>vencimento da 1ª parcela</b>: as parcelas começam nesta data</label>
          </fieldset>

          <div className="calc" aria-live="polite">
            <b>Cálculo automático</b>
            {!calc && <div className="muted">Preencha valor, parcela, quantidade e data para ver o total, os juros e as datas.</div>}
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

          {erro && <div className="neg" role="alert">{erro}</div>}
          <button className="btn primary" disabled={gerando || !pronto} style={{ justifyContent: 'center', padding: 11 }}>{gerando ? 'Gerando…' : 'Gerar Novo Link'}</button>
        </form>
      ) : (
        <div className="form" style={{ gridTemplateColumns: '1fr' }}>
          {calc && <div className="muted" style={{ textAlign: 'center' }}>{calc.n}x de {brl(calc.parcela)} · juros de {brl(calc.juros)} · {fmtData(calc.primeira)} a {fmtData(calc.ultima)}</div>}
          <div className="row" style={{ flexWrap: 'nowrap' }}>
            <input className="search" readOnly value={link} onFocus={(e) => e.target.select()} aria-label="Link de cadastro" />
            <button className="btn" onClick={copiar} aria-label="Copiar link">⧉</button>
          </div>
          <div className="row">
            <button className="btn" style={{ flex: 1, justifyContent: 'center' }} onClick={copiar}>Copiar Link</button>
            <ZapLinks msg={msgCadastro(link)} label="WhatsApp" small={false} block />
          </div>
          {copiado && <div className="pos">{copiado}</div>}
          <div className="muted" style={{ fontSize: 12 }}>O link vale para um único cadastro.</div>
          <button className="btn" style={{ justifyContent: 'center' }} onClick={() => { setLink(''); setCopiado('') }}>Gerar Outro Link</button>
        </div>
      )}
    </Modal>
  )
}

/** Importação de clientes por planilha (.xlsx). */
export function ImportarCadastro({ onClose }) {
  const { addDebtor, debtors } = useStore()
  const [res, setRes] = useState('')
  const [lista, setLista] = useState(null)
  const [lendo, setLendo] = useState(false)
  const [arquivo, setArquivo] = useState('')

  const escolher = async (e) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    setArquivo(f.name)
    setRes('')
    setLendo(true)
    try {
      setLista(await lerPlanilha(f, debtors))
    } catch {
      setLista(null)
      setRes('Não foi possível ler o arquivo. Use o modelo (.xlsx) ou um arquivo .csv.')
    }
    setLendo(false)
  }

  const validos = lista?.linhas.filter((l) => l.situacao === 'ok') || []
  const confirmar = () => {
    validos.forEach((l) => addDebtor(l.cliente))
    const ign = lista.linhas.length - validos.length
    setRes(`✔ ${validos.length} cliente(s) importado(s)${ign ? ` · ${ign} linha(s) ignorada(s)` : ''}.`)
    setLista(null)
    setArquivo('')
  }

  return (
    <Modal title="Importar Cadastro" onClose={onClose} wide>
      <p className="muted" style={{ marginTop: 0 }}>
        Baixe o modelo, preencha uma linha por cliente e envie o mesmo arquivo aqui. Você confere o resultado antes de confirmar.
      </p>
      <div className="row" style={{ marginBottom: 12 }}>
        <button className="btn" onClick={baixarModelo}>⬇ Baixar modelo de planilha</button>
        <label className="btn primary" style={{ cursor: 'pointer' }}>
          📤 Escolher planilha preenchida
          <input type="file" accept=".xlsx,.xls,.csv" onChange={escolher} style={{ display: 'none' }} aria-label="Planilha preenchida" />
        </label>
        {arquivo && <span className="muted">{arquivo}</span>}
      </div>
      {lendo && <div className="muted">Lendo planilha…</div>}
      {lista?.colunasFaltando?.length > 0 && (
        <div className="neg">Faltam colunas obrigatórias: {lista.colunasFaltando.join(', ')}. Use o modelo sem alterar os títulos.</div>
      )}
      {lista && !lista.colunasFaltando.length && (
        lista.linhas.length === 0 ? <div className="empty">Nenhum cliente encontrado na planilha.</div> : (
          <>
            <div className="row between" style={{ marginBottom: 8 }}>
              <b>{validos.length} pronto(s) para importar · {lista.linhas.length - validos.length} ignorada(s)</b>
              <button className="btn primary" disabled={!validos.length} onClick={confirmar}>Importar {validos.length} cliente(s)</button>
            </div>
            <div className="tbl-wrap" style={{ maxHeight: 320, overflowY: 'auto' }}>
              <table>
                <thead><tr><th>Linha</th><th>Nome</th><th>Parcela</th><th>Vence</th><th>Situação</th></tr></thead>
                <tbody>
                  {lista.linhas.map((l) => (
                    <tr key={l.linha}>
                      <td>{l.linha}</td>
                      <td>{l.cliente.nome || '—'}</td>
                      <td>{brl(l.cliente.valorParcela)}</td>
                      <td>{Number.isFinite(l.cliente.diaVencimento) ? `dia ${l.cliente.diaVencimento}` : '—'}</td>
                      <td>{l.situacao === 'ok' ? <span className="badge b-pago">OK</span> : <span className={'badge ' + (l.situacao === 'erro' ? 'b-atrasado' : 'b-a_cobrar')}>{l.motivo}</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )
      )}
      {res && <div className={res.startsWith('✔') ? 'pos' : 'neg'} style={{ marginTop: 10 }}>{res}</div>}
    </Modal>
  )
}
