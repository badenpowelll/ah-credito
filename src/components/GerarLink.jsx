import { useState } from 'react'
import { Field, Modal, MoneyInput } from './ui'
import { gerarLink, lerCodigo, msgCadastro, telefoneWhats } from '../lib/cadastro'
import { useStore } from '../lib/store'
import { brl, parseMoeda, useLocalStorage } from '../lib/utils'
import { baixarModelo, lerPlanilha } from '../lib/planilha'

export default function GerarLink({ onClose }) {
  const [whats, setWhats] = useLocalStorage('ahc:whats-empresa', '')
  const [f, setF] = useState({ valor: '', juros: '', dia: '', fixo: false })
  const [link, setLink] = useState('')
  const [copiado, setCopiado] = useState('')

  const gerar = (e) => {
    e.preventDefault()
    setLink(gerarLink({ v: parseMoeda(f.valor), j: parseMoeda(f.juros), d: Math.min(31, Math.max(1, parseInt(f.dia) || 1)), f: f.fixo, w: telefoneWhats(whats), t: Date.now().toString(36) }))
  }
  const copiar = async () => {
    try { await navigator.clipboard.writeText(link); setCopiado('Link copiado!') } catch { setCopiado('Selecione o link e copie (Ctrl+C).') }
  }

  return (
    <Modal title="Gerar Link de Cadastro" onClose={onClose}>
      <p className="muted" style={{ marginTop: -6 }}>Defina os valores do empréstimo e gere um link único para o cliente.</p>
      {!link ? (
        <form onSubmit={gerar} className="form" style={{ gridTemplateColumns: '1fr' }}>
          <Field label="Valor Emprestado (R$) *"><MoneyInput value={f.valor} onChange={(v) => setF((x) => ({ ...x, valor: v }))} required /></Field>
          <Field label="Valor dos Juros (R$) *"><MoneyInput value={f.juros} onChange={(v) => setF((x) => ({ ...x, juros: v }))} required /></Field>
          <Field label="Dia do Vencimento *">
            <label className="row" style={{ gap: 8, color: 'var(--text)' }}>
              <input type="checkbox" checked={f.fixo} onChange={(e) => setF({ ...f, fixo: e.target.checked })} style={{ width: 'auto' }} /> Dia fixo do mês
            </label>
            <input type="number" min="1" max="31" placeholder="1-31" value={f.dia} onChange={(e) => setF({ ...f, dia: e.target.value })} required />
          </Field>
          <Field label="Seu WhatsApp (para receber o cadastro preenchido)">
            <input placeholder="(84) 90000-0000" value={whats} onChange={(e) => setWhats(e.target.value)} />
          </Field>
          <button className="btn primary" style={{ justifyContent: 'center', padding: 11 }}>Gerar Novo Link</button>
        </form>
      ) : (
        <div className="form" style={{ gridTemplateColumns: '1fr' }}>
          <div className="row" style={{ flexWrap: 'nowrap' }}>
            <input className="search" readOnly value={link} onFocus={(e) => e.target.select()} aria-label="Link de cadastro" />
            <button className="btn" onClick={copiar} aria-label="Copiar link">⧉</button>
          </div>
          <div className="row">
            <button className="btn" style={{ flex: 1, justifyContent: 'center' }} onClick={copiar}>Copiar Link</button>
            <a className="btn green" style={{ flex: 1, justifyContent: 'center' }} target="_blank" rel="noreferrer" href={`https://api.whatsapp.com/send?text=${encodeURIComponent(msgCadastro(link))}`}>WhatsApp</a>
          </div>
          {copiado && <div className="pos">{copiado}</div>}
          <button className="btn" style={{ justifyContent: 'center' }} onClick={() => { setLink(''); setCopiado('') }}>Gerar Outro Link</button>
        </div>
      )}
    </Modal>
  )
}

export function ImportarCadastro({ onClose }) {
  const { addDebtor, debtors } = useStore()
  const [aba, setAba] = useState('planilha')
  const [texto, setTexto] = useState('')
  const [res, setRes] = useState('')
  const [lista, setLista] = useState(null) // resultado da leitura da planilha
  const [lendo, setLendo] = useState(false)
  const [arquivo, setArquivo] = useState('')

  const importarMensagem = () => {
    const c = lerCodigo(texto)
    if (!c || !c.nome) return setRes('Código não reconhecido. Cole a mensagem completa enviada pelo cliente.')
    addDebtor({
      nome: c.nome, cpf: c.cpf, rg: c.rg, telefone: c.telefone, email: c.email, cep: c.cep,
      endereco: c.endereco, numero: c.numero, complemento: c.complemento, cidade: c.cidade, tipoEndereco: c.tipoEndereco,
      valorEmprestado: c.v, valorParcela: c.j, jurosPct: c.v ? +((c.j / c.v) * 100).toFixed(2) : 0,
      diaVencimento: c.d, viaLink: true,
    })
    setRes(`✔ ${c.nome} foi adicionado em Clientes.`)
    setTexto('')
  }

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
      <div className="tabs" style={{ marginBottom: 12 }}>
        <button className={'tab' + (aba === 'planilha' ? ' active' : '')} onClick={() => { setAba('planilha'); setRes('') }}>📄 Planilha</button>
        <button className={'tab' + (aba === 'mensagem' ? ' active' : '')} onClick={() => { setAba('mensagem'); setRes('') }}>💬 Mensagem do cliente</button>
      </div>

      {aba === 'planilha' ? (
        <>
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
            <>
              {lista.linhas.length === 0 ? <div className="empty">Nenhum cliente encontrado na planilha.</div> : (
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
              )}
            </>
          )}
        </>
      ) : (
        <>
          <p className="muted" style={{ marginTop: 0 }}>Cole aqui a mensagem que o cliente enviou depois de preencher o link.</p>
          <textarea className="search" rows="6" value={texto} onChange={(e) => setTexto(e.target.value)} aria-label="Mensagem do cliente" />
          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn primary" onClick={importarMensagem}>Importar cliente</button>
          </div>
        </>
      )}
      {res && <div className={res.startsWith('✔') ? 'pos' : 'neg'} style={{ marginTop: 10 }}>{res}</div>}
    </Modal>
  )
}
