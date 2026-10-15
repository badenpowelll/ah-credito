import { useRef, useState } from 'react'
import { BancoInput, CepField, Field, Modal, MoneyInput, StatusBadge, ZapLinks } from './ui'
import { Documentos, ListaDocs, SeletorArquivos, enviarVarios, useDocumentos } from './Documentos'
import { useStore } from '../lib/store'
import { brl, fmtData, moedaCampo, parseMoeda, statusDe, uid } from '../lib/utils'

const VAZIO = {
  nome: '', rg: '', email: '', telefone: '', cpf: '', cep: '', endereco: '', numero: '', complemento: '', cidade: '', tipoEndereco: 'Residencial',
  valorEmprestado: '', valorParcela: '', jurosPct: '', diaVencimento: '10',
  banco: '', agencia: '', conta: '', tipoConta: 'Corrente', titularConta: '', tipoChavePix: 'CPF', chavePix: '', obs: '',
}
const TIPOS_PIX = ['CPF', 'CNPJ', 'Telefone', 'E-mail', 'Aleatória']

export function DebtorForm({ inicial, onClose }) {
  const { addDebtor, updateDebtor } = useStore()
  const idRef = useRef(inicial?.id || uid())
  const salvoRef = useRef(Boolean(inicial?.id))
  const [f, setF] = useState(inicial ? { ...VAZIO, ...inicial, valorEmprestado: moedaCampo(inicial.valorEmprestado), valorParcela: moedaCampo(inicial.valorParcela) } : VAZIO)
  const [arquivos, setArquivos] = useState([])
  const [enviando, setEnviando] = useState('')
  const [erro, setErro] = useState('')
  const existentes = useDocumentos(inicial?.id)
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))
  const num = (v) => parseFloat(String(v).replace(',', '.')) || 0

  const achou = (r) => setF((x) => ({ ...x, endereco: r.endereco, cidade: r.cidade }))
  const salvar = async (e) => {
    e.preventDefault()
    setErro('')
    const d = {
      ...f,
      valorEmprestado: parseMoeda(f.valorEmprestado),
      valorParcela: parseMoeda(f.valorParcela),
      jurosPct: num(f.jurosPct),
      diaVencimento: Math.min(31, Math.max(1, parseInt(f.diaVencimento) || 1)),
    }
    if (salvoRef.current) updateDebtor(idRef.current, d)
    else { addDebtor({ ...d, id: idRef.current }); salvoRef.current = true }
    if (!arquivos.length) return onClose()
    const falhas = await enviarVarios(idRef.current, arquivos, (i, n, nome) => setEnviando(`Enviando documento ${i} de ${n}: ${nome}`))
    setEnviando('')
    if (!falhas.length) return onClose()
    setArquivos(falhas.map((x) => x.arquivo))
    setErro(`Cliente salvo, mas não foi possível enviar: ${falhas.map((x) => `${x.arquivo.name} (${x.motivo})`).join('; ')}. Tente anexar de novo.`)
  }

  return (
    <Modal title={inicial?.id ? 'Editar Cliente' : 'Novo Cliente'} onClose={onClose} wide>
      <form onSubmit={salvar}>
        <div className="form">
          <h4 className="full sec">Dados pessoais</h4>
          <Field label="Nome *" full><input value={f.nome} onChange={set('nome')} required /></Field>
          <Field label="CPF"><input value={f.cpf} onChange={set('cpf')} /></Field>
          <Field label="RG"><input value={f.rg} onChange={set('rg')} /></Field>
          <Field label="Telefone / WhatsApp"><input value={f.telefone} onChange={set('telefone')} placeholder="(84) 90000-0000" /></Field>
          <Field label="E-mail"><input type="email" value={f.email} onChange={set('email')} /></Field>

          <h4 className="full sec">Endereço</h4>
          <CepField value={f.cep} onChange={(v) => setF((x) => ({ ...x, cep: v }))} onFound={achou} />
          <Field label="Tipo de endereço">
            <select value={f.tipoEndereco} onChange={set('tipoEndereco')}><option>Residencial</option><option>Trabalho</option></select>
          </Field>
          <Field label="Endereço (rua e bairro)" full><input value={f.endereco} onChange={set('endereco')} /></Field>
          <Field label="Número"><input value={f.numero} onChange={set('numero')} /></Field>
          <Field label="Complemento"><input value={f.complemento} onChange={set('complemento')} /></Field>
          <Field label="Cidade/UF"><input value={f.cidade} onChange={set('cidade')} /></Field>

          <h4 className="full sec">Empréstimo</h4>
          <Field label="Valor emprestado (R$)"><MoneyInput value={f.valorEmprestado} onChange={(v) => setF((x) => ({ ...x, valorEmprestado: v }))} /></Field>
          <Field label="Valor da parcela mensal (R$)"><MoneyInput value={f.valorParcela} onChange={(v) => setF((x) => ({ ...x, valorParcela: v }))} /></Field>
          <Field label="Juros (% ao mês)"><input inputMode="decimal" value={f.jurosPct} onChange={set('jurosPct')} /></Field>
          <Field label="Dia de vencimento"><input type="number" min="1" max="31" value={f.diaVencimento} onChange={set('diaVencimento')} /></Field>

          <h4 className="full sec">Dados bancários do cliente</h4>
          <Field label="Banco"><BancoInput value={f.banco} onChange={(v) => setF((x) => ({ ...x, banco: v }))} /></Field>
          <Field label="Agência"><input value={f.agencia} onChange={set('agencia')} inputMode="numeric" /></Field>
          <Field label="Conta (com dígito)"><input value={f.conta} onChange={set('conta')} /></Field>
          <Field label="Tipo de conta">
            <select value={f.tipoConta} onChange={set('tipoConta')}><option>Corrente</option><option>Poupança</option><option>Pagamento</option></select>
          </Field>
          <Field label="Titular da conta"><input value={f.titularConta} onChange={set('titularConta')} placeholder="Nome do titular" /></Field>
          <Field label="Tipo da chave PIX">
            <select value={f.tipoChavePix} onChange={set('tipoChavePix')}>{TIPOS_PIX.map((t) => <option key={t}>{t}</option>)}</select>
          </Field>
          <Field label="Chave PIX do cliente"><input value={f.chavePix} onChange={set('chavePix')} /></Field>

          <h4 className="full sec">Documentos pessoais</h4>
          <div className="full">
            {inicial?.id && (
              <div style={{ marginBottom: 8 }}>
                {existentes.carregando ? <div className="muted">Carregando documentos…</div> : <ListaDocs docs={existentes.docs} onRemover={existentes.remover} />}
              </div>
            )}
            <SeletorArquivos arquivos={arquivos} setArquivos={setArquivos} />
          </div>

          <Field label="Observações" full><textarea rows="3" value={f.obs} onChange={set('obs')} /></Field>
        </div>
        {erro && <div className="neg" role="alert" style={{ marginTop: 10 }}>{erro}</div>}
        <div className="row" style={{ marginTop: 16 }}>
          <button className="btn primary" disabled={Boolean(enviando)}>{enviando ? 'Salvando…' : 'Salvar'}</button>
          <button type="button" className="btn" onClick={onClose} disabled={Boolean(enviando)}>Cancelar</button>
          {enviando && <span className="muted">{enviando}</span>}
        </div>
      </form>
    </Modal>
  )
}

function Dado({ k, v, copiavel }) {
  const [ok, setOk] = useState(false)
  const copiar = async () => {
    try { await navigator.clipboard.writeText(String(v)); setOk(true); setTimeout(() => setOk(false), 1500) } catch { /* sem permissão para copiar */ }
  }
  return (
    <div className="dado">
      <small className="muted">{k}</small>
      <div className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
        <span style={{ overflowWrap: 'anywhere' }}>{v || '—'}</span>
        {copiavel && v ? <button type="button" className="btn sm" onClick={copiar} aria-label={`Copiar ${k}`}>{ok ? '✔' : 'Copiar'}</button> : null}
      </div>
    </div>
  )
}

const Secao = ({ titulo, children, extra }) => (
  <section style={{ marginTop: 14 }}>
    <div className="row between"><h4 className="sec" style={{ flex: 1 }}>{titulo}</h4>{extra}</div>
    <div className="dados">{children}</div>
  </section>
)

export function DebtorDetail({ debtor, onClose, onEdit }) {
  const { markPaid, unmarkPaid, logs, addLog, deleteLog, setStatusOverride, pixKeys } = useStore()
  const [nota, setNota] = useState('')
  const [copiouBanco, setCopiouBanco] = useState(false)
  const d = debtor
  const st = statusDe(d)
  const meus = logs.filter((l) => l.debtorId === d.id)
  const msg = `Olá ${d.nome.split(' ')[0]}! Passando para lembrar da parcela de ${brl(d.valorParcela)} com vencimento dia ${d.diaVencimento}.${pixKeys[0] ? ` PIX: ${pixKeys[0].chave} (${pixKeys[0].titular} - ${pixKeys[0].banco}).` : ''} Obrigado! — AH Crédito`
  const endereco = [d.endereco, d.numero, d.complemento, d.cidade, d.cep && 'CEP ' + d.cep].filter(Boolean).join(', ')
  const temBanco = d.banco || d.agencia || d.conta || d.chavePix
  const textoBanco = [
    d.titularConta && `Titular: ${d.titularConta}`, d.banco && `Banco: ${d.banco}`, d.agencia && `Agência: ${d.agencia}`,
    d.conta && `Conta: ${d.conta}${d.tipoConta ? ` (${d.tipoConta})` : ''}`, d.chavePix && `PIX${d.tipoChavePix ? ` (${d.tipoChavePix})` : ''}: ${d.chavePix}`,
  ].filter(Boolean).join('\n')
  const copiarBanco = async () => {
    try { await navigator.clipboard.writeText(textoBanco); setCopiouBanco(true); setTimeout(() => setCopiouBanco(false), 1500) } catch { /* sem permissão para copiar */ }
  }

  return (
    <Modal title={d.nome} onClose={onClose} wide>
      <div className="row" style={{ marginBottom: 4 }}>
        <StatusBadge status={st} />
        {d.viaLink && <span className="badge b-a_cobrar">cadastrado pelo link</span>}
        {st === 'pago'
          ? <button className="btn sm" onClick={() => unmarkPaid(d.id)}>Desfazer pagamento</button>
          : <button className="btn sm green" onClick={() => markPaid(d.id)}>✔ Marcar como pago</button>}
        <select className="search" style={{ width: 'auto' }} value={d.statusOverride || ''} onChange={(e) => setStatusOverride(d.id, e.target.value)}>
          <option value="">Status automático</option>
          <option value="pago">Forçar: Pago</option>
          <option value="atrasado">Forçar: Atrasado</option>
          <option value="a_cobrar">Forçar: A cobrar</option>
        </select>
        <button className="btn sm" onClick={onEdit}>Editar</button>
        {d.telefone && <ZapLinks tel={d.telefone} msg={msg} label="WhatsApp" />}
      </div>

      <Secao titulo="Dados pessoais">
        <Dado k="Nome" v={d.nome} />
        <Dado k="CPF" v={d.cpf} copiavel />
        <Dado k="RG" v={d.rg} />
        <Dado k="Telefone / WhatsApp" v={d.telefone} copiavel />
        <Dado k="E-mail" v={d.email} copiavel />
      </Secao>

      <Secao titulo={`Endereço (${d.tipoEndereco || 'Residencial'})`}>
        <Dado k="Endereço completo" v={endereco} />
      </Secao>

      <Secao titulo="Empréstimo">
        <Dado k="Valor emprestado" v={brl(d.valorEmprestado)} />
        <Dado k="Parcela mensal" v={brl(d.valorParcela)} />
        <Dado k="Juros" v={`${d.jurosPct || 0}% ao mês`} />
        <Dado k="Vencimento" v={`Dia ${d.diaVencimento}`} />
        <Dado k="Meses pagos" v={(d.pagos || []).join(', ') || 'nenhum'} />
        <Dado k="Cadastrado em" v={d.criadoEm ? fmtData(d.criadoEm) : ''} />
      </Secao>

      <Secao
        titulo="Dados bancários e PIX do cliente"
        extra={temBanco ? <button className="btn sm" onClick={copiarBanco}>{copiouBanco ? '✔ Copiado' : 'Copiar dados bancários'}</button> : null}
      >
        {temBanco ? (
          <>
            <Dado k="Titular da conta" v={d.titularConta} copiavel />
            <Dado k="Banco" v={d.banco} />
            <Dado k="Agência" v={d.agencia} copiavel />
            <Dado k={`Conta${d.tipoConta ? ` (${d.tipoConta})` : ''}`} v={d.conta} copiavel />
            <Dado k={`Chave PIX${d.tipoChavePix ? ` (${d.tipoChavePix})` : ''}`} v={d.chavePix} copiavel />
          </>
        ) : <div className="muted">Nenhum dado bancário cadastrado. Use Editar para preencher.</div>}
      </Secao>

      <section style={{ marginTop: 14 }}>
        <h4 className="sec">Documentos pessoais</h4>
        <Documentos clienteId={d.id} />
      </section>

      {d.obs && <Secao titulo="Observações"><Dado k="Anotações do cadastro" v={d.obs} /></Secao>}

      <h4 className="sec" style={{ marginTop: 14 }}>Histórico / Anotações</h4>
      <form className="row" onSubmit={(e) => { e.preventDefault(); if (nota.trim()) { addLog(d.id, nota.trim()); setNota('') } }}>
        <input className="search" style={{ flex: 1 }} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ex.: Prometeu pagar dia 15" />
        <button className="btn primary">Adicionar</button>
      </form>
      {meus.length === 0 && <div className="empty">Sem registros</div>}
      {meus.map((l) => (
        <div key={l.id} className="row between" style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
          <div><div className="muted" style={{ fontSize: 11 }}>{fmtData(l.data)} · {l.tipo}</div>{l.texto}</div>
          <button className="btn sm" onClick={() => deleteLog(l.id)}>✕</button>
        </div>
      ))}
    </Modal>
  )
}

export function ResumoCarteira({ debtors }) {
  const ativos = debtors
  const emprestado = ativos.reduce((s, d) => s + (d.valorEmprestado || 0), 0)
  const mensal = ativos.reduce((s, d) => s + (d.valorParcela || 0), 0)
  const recebido = ativos.filter((d) => statusDe(d) === 'pago').reduce((s, d) => s + (d.valorParcela || 0), 0)
  const atrasados = ativos.filter((d) => statusDe(d) === 'atrasado')
  return (
    <div className="grid g5">
      <div className="card kpi"><small>Clientes</small><b>{ativos.length}</b></div>
      <div className="card kpi"><small>Total emprestado</small><b className="gold">{brl(emprestado)}</b></div>
      <div className="card kpi"><small>A receber / mês</small><b>{brl(mensal)}</b></div>
      <div className="card kpi"><small>Recebido no mês</small><b className="pos">{brl(recebido)}</b></div>
      <div className="card kpi"><small>Em atraso</small><b className="neg">{atrasados.length} · {brl(atrasados.reduce((s, d) => s + (d.valorParcela || 0), 0))}</b></div>
    </div>
  )
}

export function ClientesTab({ debtors, onEdit, onOpen, highlight }) {
  const { trashDebtor, markPaid, unmarkPaid } = useStore()
  const [q, setQ] = useState('')
  const [filtro, setFiltro] = useState('todos')
  const lista = debtors.filter((d) => d.nome.toLowerCase().includes(q.toLowerCase()) && (filtro === 'todos' || statusDe(d) === filtro))
  return (
    <div className="card">
      <div className="row" style={{ marginBottom: 12 }}>
        <input className="search" style={{ maxWidth: 280 }} placeholder="Pesquisar por nome..." value={q} onChange={(e) => setQ(e.target.value)} />
        {['todos', 'a_cobrar', 'atrasado', 'pago'].map((s) => (
          <button key={s} className={'tab' + (filtro === s ? ' active' : '')} onClick={() => setFiltro(s)}>
            {{ todos: 'Todos', a_cobrar: 'A COBRAR', atrasado: 'ATRASADO', pago: 'PAGO' }[s]}
          </button>
        ))}
      </div>
      <div className="tbl-wrap">
        <table>
          <thead><tr><th>Cliente</th><th>Vencimento</th><th>Parcela</th><th>Emprestado</th><th>Status</th><th>Ações</th></tr></thead>
          <tbody>
            {lista.length === 0 && <tr><td colSpan="6" className="empty">Nenhum cliente cadastrado ainda.</td></tr>}
            {lista.map((d) => {
              const st = statusDe(d)
              return (
                <tr key={d.id} className={highlight === d.id ? 'hl' : ''}>
                  <td><a href="#" onClick={(e) => { e.preventDefault(); onOpen(d) }} className="gold"><b>{d.nome}</b></a>{d.viaLink && <span className="badge b-a_cobrar" style={{ marginLeft: 6 }}>via link</span>}<div className="muted" style={{ fontSize: 12 }}>{d.telefone}</div></td>
                  <td>Dia {d.diaVencimento}</td>
                  <td>{brl(d.valorParcela)}</td>
                  <td>{brl(d.valorEmprestado)}</td>
                  <td><StatusBadge status={st} /></td>
                  <td>
                    <div className="row" style={{ flexWrap: 'nowrap' }}>
                      {st === 'pago'
                        ? <button className="btn sm" onClick={() => unmarkPaid(d.id)}>Desfazer</button>
                        : <button className="btn sm green" onClick={() => markPaid(d.id)}>Pago</button>}
                      <button className="btn sm" onClick={() => onEdit(d)}>Editar</button>
                      <button className="btn sm" onClick={() => onEdit({ ...d, id: undefined, nome: d.nome + ' (Cópia)' })}>Duplicar</button>
                      <button className="btn sm red" onClick={() => trashDebtor(d.id)}>Lixeira</button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
