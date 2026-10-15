import { useState } from 'react'
import { CepField, Field, Modal, StatusBadge } from './ui'
import { useStore } from '../lib/store'
import { brl, fmtData, statusDe, whatsLink } from '../lib/utils'

const VAZIO = {
  nome: '', telefone: '', cpf: '', cep: '', endereco: '', numero: '', complemento: '', cidade: '', tipoEndereco: 'Residencial',
  valorEmprestado: '', valorParcela: '', jurosPct: '', diaVencimento: '10', chavePix: '', obs: '',
}

export function DebtorForm({ inicial, onClose }) {
  const { addDebtor, updateDebtor } = useStore()
  const [f, setF] = useState(inicial ? { ...VAZIO, ...inicial } : VAZIO)
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))
  const num = (v) => parseFloat(String(v).replace(',', '.')) || 0

  const achou = (r) => setF((x) => ({ ...x, endereco: r.endereco, cidade: r.cidade }))
  const salvar = (e) => {
    e.preventDefault()
    const d = {
      ...f,
      valorEmprestado: num(f.valorEmprestado),
      valorParcela: num(f.valorParcela),
      jurosPct: num(f.jurosPct),
      diaVencimento: Math.min(31, Math.max(1, parseInt(f.diaVencimento) || 1)),
    }
    if (inicial?.id) updateDebtor(inicial.id, d)
    else addDebtor(d)
    onClose()
  }
  return (
    <Modal title={inicial?.id ? 'Editar Cliente' : 'Novo Cliente'} onClose={onClose}>
      <form onSubmit={salvar}>
        <div className="form">
          <Field label="Nome *" full><input value={f.nome} onChange={set('nome')} required /></Field>
          <Field label="Telefone / WhatsApp"><input value={f.telefone} onChange={set('telefone')} placeholder="(84) 90000-0000" /></Field>
          <Field label="CPF"><input value={f.cpf} onChange={set('cpf')} /></Field>
          <CepField value={f.cep} onChange={(v) => setF((x) => ({ ...x, cep: v }))} onFound={achou} />
          <Field label="Tipo de endereço">
            <select value={f.tipoEndereco} onChange={set('tipoEndereco')}><option>Residencial</option><option>Trabalho</option></select>
          </Field>
          <Field label="Endereço (rua e bairro)" full><input value={f.endereco} onChange={set('endereco')} /></Field>
          <Field label="Número"><input value={f.numero} onChange={set('numero')} /></Field>
          <Field label="Complemento"><input value={f.complemento} onChange={set('complemento')} /></Field>
          <Field label="Cidade/UF"><input value={f.cidade} onChange={set('cidade')} /></Field>
          <Field label="Valor emprestado (R$)"><input inputMode="decimal" value={f.valorEmprestado} onChange={set('valorEmprestado')} /></Field>
          <Field label="Valor da parcela mensal (R$)"><input inputMode="decimal" value={f.valorParcela} onChange={set('valorParcela')} /></Field>
          <Field label="Juros (% ao mês)"><input inputMode="decimal" value={f.jurosPct} onChange={set('jurosPct')} /></Field>
          <Field label="Dia de vencimento"><input type="number" min="1" max="31" value={f.diaVencimento} onChange={set('diaVencimento')} /></Field>
          <Field label="Chave PIX do cliente"><input value={f.chavePix} onChange={set('chavePix')} /></Field>
          <Field label="Observações" full><textarea rows="3" value={f.obs} onChange={set('obs')} /></Field>
        </div>
        <div className="row" style={{ marginTop: 16 }}>
          <button className="btn primary">Salvar</button>
          <button type="button" className="btn" onClick={onClose}>Cancelar</button>
        </div>
      </form>
    </Modal>
  )
}

export function DebtorDetail({ debtor, onClose, onEdit }) {
  const { markPaid, unmarkPaid, logs, addLog, deleteLog, setStatusOverride, pixKeys } = useStore()
  const [nota, setNota] = useState('')
  const d = debtor
  const st = statusDe(d)
  const meus = logs.filter((l) => l.debtorId === d.id)
  const msg = `Olá ${d.nome.split(' ')[0]}! Passando para lembrar da parcela de ${brl(d.valorParcela)} com vencimento dia ${d.diaVencimento}.${pixKeys[0] ? ` PIX: ${pixKeys[0].chave} (${pixKeys[0].titular} - ${pixKeys[0].banco}).` : ''} Obrigado! — AH Crédito`
  return (
    <Modal title={d.nome} onClose={onClose}>
      <div className="row" style={{ marginBottom: 12 }}>
        <StatusBadge status={st} />
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
        {d.telefone && <a className="btn sm" target="_blank" rel="noreferrer" href={whatsLink(d.telefone, msg)}>WhatsApp</a>}
      </div>
      <div className="form" style={{ marginBottom: 14 }}>
        {[['Telefone', d.telefone], ['CPF', d.cpf], ['Endereço', [d.endereco, d.numero, d.complemento, d.cidade, d.cep && 'CEP ' + d.cep].filter(Boolean).join(', ')],
          ['Emprestado', brl(d.valorEmprestado)], ['Parcela mensal', brl(d.valorParcela)], ['Juros', `${d.jurosPct || 0}% a.m.`],
          ['Vencimento', `Dia ${d.diaVencimento}`], ['Chave PIX', d.chavePix], ['Meses pagos', (d.pagos || []).join(', ') || '—'], ['Observações', d.obs]]
          .map(([k, v]) => <div key={k}><div className="muted" style={{ fontSize: 12 }}>{k}</div>{v || '—'}</div>)}
      </div>
      <h3 style={{ margin: '10px 0' }}>Histórico / Anotações</h3>
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
                  <td className="row">
                    {st === 'pago'
                      ? <button className="btn sm" onClick={() => unmarkPaid(d.id)}>Desfazer</button>
                      : <button className="btn sm green" onClick={() => markPaid(d.id)}>Pago</button>}
                    <button className="btn sm" onClick={() => onEdit(d)}>Editar</button>
                    <button className="btn sm" onClick={() => onEdit({ ...d, id: undefined, nome: d.nome + ' (Cópia)' })}>Duplicar</button>
                    <button className="btn sm red" onClick={() => trashDebtor(d.id)}>Lixeira</button>
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
