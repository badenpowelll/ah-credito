import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Field, Hero, MoneyInput, StatusBadge } from '../components/ui'
import Robo from '../components/Robo'
import { ResumoCarteira } from '../components/Clientes'
import { projetar12Meses } from '../lib/projecao'
import { responder } from '../lib/consulta'
import { useStore } from '../lib/store'
import { MESES, brl, fmtData, hojeISO, moedaCampo, parseMoeda, statusDe } from '../lib/utils'

const CORES = ['#d4a437', '#4c8dff', '#2fb36d', '#e5484d', '#a06cf0', '#35c2c9', '#f08c3c']
const VAZIA = { data: hojeISO(), tipo: 'entrada', descricao: '', categoria: '', pagamento: 'PIX', valor: '' }

export default function Dashboard() {
  const { movimentos: transactions, incluirEmprestimos, setIncluirEmprestimos, addTransaction, updateTransaction, deleteTransaction, debtors, pixKeys, logs, trashed } = useStore()
  const [sp] = useSearchParams()
  const anoAtual = new Date().getFullYear()
  const [ano, setAno] = useState(anoAtual)
  const [semestre, setSemestre] = useState('todos')
  const [form, setForm] = useState(VAZIA)
  const [editId, setEditId] = useState(null)
  const refs = useRef({})

  useEffect(() => {
    const s = sp.get('secao')
    if (s && refs.current[s]) refs.current[s].scrollIntoView({ behavior: 'smooth', block: 'start' })
    else if (!s) window.scrollTo({ top: 0 })
  }, [sp])
  const reg = (id) => (el) => (refs.current[id] = el)

  const projecao = useMemo(() => projetar12Meses(debtors), [debtors])
  const rotuloMes = (m) => `${MESES[+m.slice(5) - 1]}/${m.slice(2, 4)}`
  const anos = useMemo(() => [...new Set([anoAtual, ...transactions.map((t) => +t.data.slice(0, 4))])].sort((a, b) => b - a), [transactions, anoAtual])
  const doAno = useMemo(() => transactions.filter((t) => +t.data.slice(0, 4) === ano), [transactions, ano])
  const filtradas = useMemo(() => {
    if (semestre === 'todos') return doAno
    return doAno.filter((t) => {
      const m = +t.data.slice(5, 7)
      return semestre === '1' ? m <= 6 : m >= 7
    })
  }, [doAno, semestre])

  const soma = (l, tipo) => l.filter((t) => t.tipo === tipo).reduce((s, t) => s + t.valor, 0)
  const totEnt = soma(transactions, 'entrada')
  const totSai = soma(transactions, 'saida')
  const rotuloSem = semestre === '1' ? `1º Semestre ${ano}` : semestre === '2' ? `2º Semestre ${ano}` : `Ano ${ano}`

  const porMes = MESES.map((m, i) => {
    const l = doAno.filter((t) => +t.data.slice(5, 7) === i + 1)
    return { mes: m, Entradas: soma(l, 'entrada'), Saídas: soma(l, 'saida') }
  })
  let acc = 0
  const evolucao = porMes.map((p) => ({ mes: p.mes, Saldo: (acc += p.Entradas - p.Saídas) }))
  const cats = {}
  doAno.filter((t) => t.tipo === 'saida').forEach((t) => { const c = t.categoria || 'Outros'; cats[c] = (cats[c] || 0) + t.valor })
  const pizza = Object.entries(cats).map(([name, value]) => ({ name, value }))

  const resumoClientes = { pago: 0, atrasado: 0, a_cobrar: 0 }
  const valoresClientes = { pago: 0, atrasado: 0, a_cobrar: 0 }
  debtors.forEach((d) => { const s = statusDe(d); resumoClientes[s]++; valoresClientes[s] += Number(d.valorParcela) || 0 })

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const salvar = (e) => {
    e.preventDefault()
    const dados = { ...form, valor: parseMoeda(form.valor) }
    if (!dados.valor) return
    if (editId) updateTransaction(editId, dados)
    else addTransaction(dados)
    setForm(VAZIA)
    setEditId(null)
  }
  const editar = (t) => { setForm({ ...t, valor: moedaCampo(t.valor) }); setEditId(t.id); refs.current.nova?.scrollIntoView({ behavior: 'smooth' }) }

  return (
    <>
      <Hero title="Dashboard" subtitle="Acompanhamento financeiro — AH Crédito" />

      <div ref={reg('resumo')} className="row between">
        <div className="row">
          <Field label="Ano">
            <select value={ano} onChange={(e) => setAno(+e.target.value)}>{anos.map((a) => <option key={a}>{a}</option>)}</select>
          </Field>
          <Field label="Período">
            <select value={semestre} onChange={(e) => setSemestre(e.target.value)}>
              <option value="todos">Ano Inteiro</option>
              <option value="1">1º Semestre</option>
              <option value="2">2º Semestre</option>
            </select>
          </Field>
        </div>
      </div>

      <label className="row no-print" style={{ gap: 8, cursor: 'pointer' }}>
        <input type="checkbox" checked={incluirEmprestimos} onChange={(e) => setIncluirEmprestimos(e.target.checked)} style={{ width: 'auto' }} />
        <span>Incluir os empréstimos no caixa: o valor emprestado entra como <b>saída</b> e cada parcela paga como <b>entrada</b> (automático)</span>
      </label>

      <div className="grid g5">
        <div className="card kpi"><small>Total Entradas</small><b className="pos">{brl(totEnt)}</b></div>
        <div className="card kpi"><small>Total Saídas</small><b className="neg">{brl(totSai)}</b></div>
        <div className="card kpi"><small>Saldo Atual</small><b className={totEnt - totSai >= 0 ? 'gold' : 'neg'}>{brl(totEnt - totSai)}</b></div>
        <div className="card kpi"><small>Total do Ano ({ano})</small><b>{brl(soma(doAno, 'entrada') - soma(doAno, 'saida'))}</b></div>
        <div className="card kpi"><small>Total — {rotuloSem}</small><b>{brl(soma(filtradas, 'entrada') - soma(filtradas, 'saida'))}</b></div>
      </div>

      <section ref={reg('carteira')}>
        <h2 style={{ fontSize: 18, marginBottom: 10 }}>Carteira de empréstimos</h2>
        <ResumoCarteira debtors={debtors} />
      </section>

      <section ref={reg('projecao')}>
        <h2 style={{ fontSize: 18, marginBottom: 4 }}>Projeção dos próximos 12 meses</h2>
        <div className="muted" style={{ marginBottom: 10 }}>O que ainda há para receber, mês a mês, a partir de {rotuloMes(projecao.meses[0].mes)}: valor das parcelas, juros e capital (valor emprestado que volta).</div>
        <div className="grid g5">
          <div className="card kpi"><small>Receber este mês</small><b className="gold">{brl(projecao.meses[0].parcelas)}</b></div>
          <div className="card kpi"><small>Parcelas em 12 meses</small><b>{brl(projecao.total.parcelas)}</b></div>
          <div className="card kpi"><small>Juros em 12 meses</small><b className="pos">{brl(projecao.total.juros)}</b></div>
          <div className="card kpi"><small>Capital em 12 meses</small><b>{brl(projecao.total.principal)}</b></div>
          <div className="card kpi"><small>Atrasadas (já no mês atual)</small><b className={projecao.atrasadas.quantidade ? 'neg' : ''}>{brl(projecao.atrasadas.valor)}</b></div>
        </div>
        <div className="card" style={{ marginTop: 14 }}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={projecao.meses.map((m) => ({ mes: rotuloMes(m.mes), Capital: m.principal, Juros: m.juros }))}>
              <CartesianGrid stroke="#2c2c33" /><XAxis dataKey="mes" stroke="#9b968a" /><YAxis stroke="#9b968a" />
              <Tooltip formatter={brl} contentStyle={{ background: '#151518', border: '1px solid #2c2c33' }} /><Legend />
              <Bar dataKey="Capital" stackId="a" fill="#4c8dff" /><Bar dataKey="Juros" stackId="a" fill="#d4a437" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card tbl-wrap" style={{ marginTop: 14 }}>
          <table>
            <thead><tr><th>Mês</th><th className="num">Parcelas</th><th className="num">Capital (valor emprestado)</th><th className="num">Juros</th><th className="num">A receber no mês</th><th className="num">Acumulado</th></tr></thead>
            <tbody>
              {projecao.meses.map((m, i) => (
                <tr key={m.mes}>
                  <td>{rotuloMes(m.mes)}{i === 0 && <span className="badge b-a_cobrar" style={{ marginLeft: 6 }}>mês atual</span>}</td>
                  <td className="num">{m.qtd}</td>
                  <td className="num">{brl(m.principal)}</td>
                  <td className="num pos">{brl(m.juros)}</td>
                  <td className="num"><b>{brl(m.parcelas)}</b></td>
                  <td className="num muted">{brl(projecao.meses.slice(0, i + 1).reduce((s, x) => s + x.parcelas, 0))}</td>
                </tr>
              ))}
              <tr style={{ background: 'var(--panel2)' }}>
                <td><b>Total (12 meses)</b></td>
                <td className="num"><b>{projecao.meses.reduce((s, m) => s + m.qtd, 0)}</b></td>
                <td className="num"><b>{brl(projecao.total.principal)}</b></td>
                <td className="num pos"><b>{brl(projecao.total.juros)}</b></td>
                <td className="num"><b>{brl(projecao.total.parcelas)}</b></td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
        <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
          Valor das parcelas = capital + juros. Os juros são calculados sobre o saldo devedor de cada cliente (parcelas iguais). Clientes sem parcelamento definido projetam a parcela mensal até quitar o valor emprestado, com os juros do cadastro.
          Parcelas já pagas não entram; parcelas vencidas e não pagas entram no mês atual.{projecao.semDados ? ` ${projecao.semDados} cliente(s) sem valor de empréstimo ou de parcela ficaram fora.` : ''}
        </div>
      </section>

      <div ref={reg('graficos')} className="grid g2">
        <div className="card">
          <h3>Entradas vs Saídas por Mês — {ano}</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={porMes}>
              <CartesianGrid stroke="#2c2c33" /><XAxis dataKey="mes" stroke="#9b968a" /><YAxis stroke="#9b968a" />
              <Tooltip formatter={brl} contentStyle={{ background: '#151518', border: '1px solid #2c2c33' }} /><Legend />
              <Bar dataKey="Entradas" fill="#2fb36d" /><Bar dataKey="Saídas" fill="#e5484d" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <h3>Evolução do Saldo — {ano}</h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={evolucao}>
              <CartesianGrid stroke="#2c2c33" /><XAxis dataKey="mes" stroke="#9b968a" /><YAxis stroke="#9b968a" />
              <Tooltip formatter={brl} contentStyle={{ background: '#151518', border: '1px solid #2c2c33' }} />
              <Line dataKey="Saldo" stroke="#d4a437" strokeWidth={2} dot />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <h3>Despesas por Categoria</h3>
          {pizza.length === 0 ? <div className="empty">Sem despesas no período</div> : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={pizza} dataKey="value" nameKey="name" outerRadius={90} label>
                  {pizza.map((_, i) => <Cell key={i} fill={CORES[i % CORES.length]} />)}
                </Pie>
                <Tooltip formatter={brl} contentStyle={{ background: '#151518', border: '1px solid #2c2c33' }} /><Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
        <div ref={reg('devedores')} className="card">
          <h3>Situação dos Clientes (Empréstimos)</h3>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
            {['pago', 'atrasado', 'a_cobrar'].map((s) => (
              <div key={s} className="card kpi" style={{ background: 'var(--panel2)' }}>
                <StatusBadge status={s} />
                <b>{resumoClientes[s]}</b>
                <small>{brl(valoresClientes[s])}</small>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div ref={reg('nova')} className="card">
        <h3>{editId ? 'Editar Movimentação' : 'Nova Movimentação'}</h3>
        <form onSubmit={salvar}>
          <div className="form">
            <Field label="Data"><input type="date" value={form.data} onChange={set('data')} required /></Field>
            <Field label="Tipo">
              <select value={form.tipo} onChange={set('tipo')}><option value="entrada">Entrada</option><option value="saida">Saída</option></select>
            </Field>
            <Field label="Descrição"><input value={form.descricao} onChange={set('descricao')} required /></Field>
            <Field label="Categoria"><input value={form.categoria} onChange={set('categoria')} placeholder="Ex.: Aluguel, Juros…" /></Field>
            <Field label="Pagamento">
              <select value={form.pagamento} onChange={set('pagamento')}>
                {['PIX', 'Dinheiro', 'Transferência', 'Cartão', 'Boleto'].map((p) => <option key={p}>{p}</option>)}
              </select>
            </Field>
            <Field label="Valor (R$)"><MoneyInput value={form.valor} onChange={(v) => setForm((f) => ({ ...f, valor: v }))} required /></Field>
          </div>
          <div className="row" style={{ marginTop: 14 }}>
            <button className="btn primary">{editId ? 'Atualizar' : 'Adicionar'}</button>
            {editId && <button type="button" className="btn" onClick={() => { setEditId(null); setForm(VAZIA) }}>Cancelar</button>}
          </div>
        </form>
      </div>

      <div ref={reg('movimentacoes')}>
        <h2 style={{ fontSize: 18, marginBottom: 10 }}>Movimentações — {semestre !== 'todos' ? rotuloSem : ano}</h2>
        <div className="card tbl-wrap">
          <table>
            <thead><tr><th>Data</th><th>Tipo</th><th>Descrição</th><th>Categoria</th><th>Pagamento</th><th>Valor</th><th>Ações</th></tr></thead>
            <tbody>
              {filtradas.length === 0 && <tr><td colSpan="7" className="empty">Nenhuma movimentação encontrada</td></tr>}
              {[...filtradas].sort((a, b) => b.data.localeCompare(a.data)).map((t) => (
                <tr key={t.id}>
                  <td>{fmtData(t.data)}</td>
                  <td><span className={'badge ' + (t.tipo === 'entrada' ? 'b-pago' : 'b-atrasado')}>{t.tipo === 'entrada' ? 'Entrada' : 'Saída'}</span></td>
                  <td>{t.descricao}{t.auto && <span className="badge b-a_cobrar" style={{ marginLeft: 6 }}>automático</span>}</td><td>{t.categoria}</td><td>{t.pagamento}</td>
                  <td className={t.tipo === 'entrada' ? 'pos' : 'neg'}>{brl(t.valor)}</td>
                  <td>
                    {t.auto
                      ? <a className="btn sm" href="#/emprestimos?aba=devedores">Ver em Empréstimos</a>
                      : (
                        <div className="row" style={{ flexWrap: 'nowrap' }}>
                          <button className="btn sm" onClick={() => editar(t)}>Editar</button>
                          <button className="btn sm red" onClick={() => confirm('Excluir movimentação?') && deleteTransaction(t.id)}>Excluir</button>
                        </div>
                      )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div ref={reg('robo-financeiro')}>
        <Robo
          titulo="🤖 Robô Financeiro — consulta aos dados cadastrados"
          sugestoes={['Qual meu saldo atual?', 'Despesas por categoria', 'Últimas movimentações', 'Resumo da carteira', 'Clientes atrasados']}
          responder={(q) => responder(q, { debtors, transactions, pixKeys, logs, trashed })}
        />
      </div>
    </>
  )
}
