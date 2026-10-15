import { useState } from 'react'
import { Field, Modal, MoneyInput, ZapLinks } from './ui'
import { api } from '../lib/api'
import { msgCadastro } from '../lib/cadastro'
import { useStore } from '../lib/store'
import { brl, fmtData, parseMoeda } from '../lib/utils'
import { baixarModelo, lerPlanilha } from '../lib/planilha'
import { OpcoesData, PainelCalculo, useCalculo } from './Parcelamento'

export default function GerarLink({ onClose }) {
  const [f, setF] = useState({ valor: '', parcela: '', n: '', data: '', modo: 'inicio' })
  const [link, setLink] = useState('')
  const [copiado, setCopiado] = useState('')
  const [erro, setErro] = useState('')
  const [gerando, setGerando] = useState(false)
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))

  const calc = useCalculo({ valor: f.valor, parcela: f.parcela, n: f.n, data: f.data, modo: f.modo })
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
          <OpcoesData modo={f.modo} onChange={(m) => setF((x) => ({ ...x, modo: m }))} />
          <PainelCalculo calc={calc} />

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
