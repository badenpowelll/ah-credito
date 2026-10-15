import { useState } from 'react'
import { Field, Modal, MoneyInput } from './ui'
import { gerarLink, lerCodigo, msgCadastro, telefoneWhats } from '../lib/cadastro'
import { useStore } from '../lib/store'
import { parseMoeda, useLocalStorage } from '../lib/utils'

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
            <a className="btn green" style={{ flex: 1, justifyContent: 'center' }} target="_blank" rel="noreferrer" href={`https://wa.me/?text=${encodeURIComponent(msgCadastro(link))}`}>WhatsApp</a>
          </div>
          {copiado && <div className="pos">{copiado}</div>}
          <button className="btn" style={{ justifyContent: 'center' }} onClick={() => { setLink(''); setCopiado('') }}>Gerar Outro Link</button>
        </div>
      )}
    </Modal>
  )
}

export function ImportarCadastro({ onClose }) {
  const { addDebtor } = useStore()
  const [texto, setTexto] = useState('')
  const [res, setRes] = useState('')

  const importar = () => {
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
  return (
    <Modal title="Importar Cadastro" onClose={onClose}>
      <p className="muted" style={{ marginTop: -6 }}>Cole aqui a mensagem que o cliente enviou depois de preencher o link.</p>
      <textarea className="search" rows="6" value={texto} onChange={(e) => setTexto(e.target.value)} aria-label="Mensagem do cliente" />
      <div className="row" style={{ marginTop: 12 }}>
        <button className="btn primary" onClick={importar}>Importar cliente</button>
        {res && <span className={res.startsWith('✔') ? 'pos' : 'neg'}>{res}</span>}
      </div>
    </Modal>
  )
}
