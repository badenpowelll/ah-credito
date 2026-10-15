import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Field, Hero } from '../components/ui'
import { api } from '../lib/api'
import { fmtBytes } from '../lib/utils'

const ACAO = {
  login: ['Entrou no sistema', 'b-pago'], login_falhou: ['Login recusado', 'b-atrasado'], logout: ['Saiu do sistema', ''],
  criar: ['Criou', 'b-pago'], alterar: ['Alterou', 'b-a_cobrar'], excluir: ['Excluiu', 'b-atrasado'],
  documento_enviar: ['Anexou documento', 'b-pago'], documento_ver: ['Visualizou documento', ''], documento_baixar: ['Baixou documento', ''], documento_excluir: ['Excluiu documento', 'b-atrasado'],
  backup: ['Baixou backup', 'b-a_cobrar'], link_gerar: ['Gerou link de cadastro', ''], cadastro_publico: ['Cliente se cadastrou pelo link', 'b-pago'],
  acesso_negado: ['Acesso negado', 'b-atrasado'], auditoria_exportar: ['Exportou a auditoria', 'b-a_cobrar'],
}
const ENTIDADE = { debtors: 'Cliente', transactions: 'Movimentação', pix: 'Chave PIX', logs: 'Histórico', documentos: 'Documento', links: 'Link', sistema: 'Sistema', auditoria: 'Auditoria' }
const CAMPO = {
  nome: 'Nome', cpf: 'CPF', rg: 'RG', telefone: 'Telefone', email: 'E-mail', cep: 'CEP', endereco: 'Endereço', numero: 'Número', cidade: 'Cidade',
  valorEmprestado: 'Valor emprestado', valorParcela: 'Valor da parcela', jurosPct: 'Juros ao mês', diaVencimento: 'Dia de vencimento', parcelas: 'Parcelas',
  pagos: 'Meses pagos', banco: 'Banco', agencia: 'Agência', conta: 'Conta', chavePix: 'Chave PIX', deletedAt: 'Lixeira', statusOverride: 'Status forçado',
  descricao: 'Descrição', valor: 'Valor', categoria: 'Categoria', tipo: 'Tipo', data: 'Data', obs: 'Observações',
  primeiroVencimento: '1º vencimento', ultimoVencimento: 'Último vencimento', totalAPagar: 'Total a pagar', valorJuros: 'Valor dos juros',
  jurosPctTotal: 'Juros no total (%)', dataContrato: 'Início do contrato', tipoConta: 'Tipo de conta', titularConta: 'Titular da conta',
  tipoChavePix: 'Tipo da chave PIX', complemento: 'Complemento', tipoEndereco: 'Tipo de endereço', email: 'E-mail',
}
const quando = (iso) => new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
const duracao = (s) => {
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60)
  return [d && `${d} d`, (d || h) && `${h} h`, `${m} min`].filter(Boolean).join(' ')
}

function Detalhe({ l }) {
  const d = l.detalhe || {}
  const partes = []
  if (d.item) partes.push(d.item)
  if (d.nome) partes.push(d.nome)
  if (d.motivo) partes.push(d.motivo)
  if (d.cliente) partes.push(`cliente ${d.cliente}`)
  if (d.valor) partes.push(`R$ ${d.valor}`)
  if (d.parcelas) partes.push(`${d.parcelas} parcelas`)
  if (d.linhas) partes.push(`${d.linhas} linhas`)
  if (d.rota) partes.push(d.rota)
  return (
    <div>
      {partes.join(' · ') || '—'}
      {d.campos?.length > 0 && (
        <details>
          <summary className="muted" style={{ cursor: 'pointer', fontSize: 12 }}>{d.campos.length} campo(s): {d.campos.map((c) => CAMPO[c] || c).join(', ')}</summary>
          <ul style={{ margin: '4px 0 0 16px', padding: 0, fontSize: 12 }}>
            {d.campos.map((c) => <li key={c}><b>{CAMPO[c] || c}:</b> {d.mudou?.[c]?.antes ?? '—'} → {d.mudou?.[c]?.depois ?? '—'}</li>)}
          </ul>
        </details>
      )}
    </div>
  )
}

/** Tabela de registros com filtros, "carregar mais" e exportação. */
function Registro({ base = {}, completo = true }) {
  const [f, setF] = useState({ q: '', usuario: '', acao: '', entidade: '', de: '', ate: '' })
  const [itens, setItens] = useState([])
  const [proximo, setProximo] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))

  const consulta = useCallback((extra = {}) => {
    const p = new URLSearchParams({ ...base, ...Object.fromEntries(Object.entries(f).filter(([, v]) => v)), ...extra })
    return p.toString()
  }, [base, f])

  const buscar = useCallback(async (anexar = false, antes) => {
    setCarregando(true)
    try {
      const r = await api.get('/auditoria?' + consulta(antes ? { antes, limite: 100 } : { limite: 100 }))
      setItens((l) => (anexar ? [...l, ...r.itens] : r.itens))
      setProximo(r.proximo)
      setErro('')
    } catch (e) {
      setErro(e.message)
    }
    setCarregando(false)
  }, [consulta])

  useEffect(() => { buscar(false) }, []) // eslint-disable-line

  const exportar = async () => {
    try {
      const r = await fetch('/api/auditoria/exportar?' + consulta(), { credentials: 'same-origin' })
      if (!r.ok) throw new Error()
      const url = URL.createObjectURL(await r.blob())
      const a = document.createElement('a')
      a.href = url
      a.download = `auditoria-ah-credito-${new Date().toLocaleDateString('sv-SE')}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setErro('Não foi possível exportar. Tente de novo.')
    }
  }

  return (
    <div className="card">
      <form className="form" onSubmit={(e) => { e.preventDefault(); buscar(false) }} style={{ marginBottom: 10 }}>
        <Field label="Buscar"><input value={f.q} onChange={set('q')} placeholder="usuário, cliente, IP, campo…" /></Field>
        <Field label="Usuário"><input value={f.usuario} onChange={set('usuario')} placeholder="e-mail ou nome de acesso" /></Field>
        {completo && (
          <>
            <Field label="Ação">
              <select value={f.acao} onChange={set('acao')}>
                <option value="">Todas</option>
                {Object.entries(ACAO).map(([k, [rot]]) => <option key={k} value={k}>{rot}</option>)}
              </select>
            </Field>
            <Field label="Tipo de item">
              <select value={f.entidade} onChange={set('entidade')}>
                <option value="">Todos</option>
                {Object.entries(ENTIDADE).map(([k, rot]) => <option key={k} value={k}>{rot}</option>)}
              </select>
            </Field>
          </>
        )}
        <Field label="De"><input type="date" value={f.de} onChange={set('de')} /></Field>
        <Field label="Até"><input type="date" value={f.ate} onChange={set('ate')} /></Field>
        <div className="row full">
          <button className="btn primary">Filtrar</button>
          <button type="button" className="btn" onClick={() => { setF({ q: '', usuario: '', acao: '', entidade: '', de: '', ate: '' }); setTimeout(() => buscar(false), 0) }}>Limpar</button>
          <button type="button" className="btn" onClick={exportar}>⬇ Exportar CSV</button>
        </div>
      </form>
      {erro && <div className="neg" role="alert">{erro}</div>}
      <div className="tbl-wrap">
        <table>
          <thead><tr><th>Quando</th><th>Usuário</th><th>Ação</th><th>Item</th><th>Detalhes</th><th>IP</th></tr></thead>
          <tbody>
            {!carregando && itens.length === 0 && <tr><td colSpan="6" className="empty">Nenhum registro encontrado.</td></tr>}
            {itens.map((l) => {
              const [rot, cls] = ACAO[l.acao] || [l.acao, '']
              return (
                <tr key={l.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{quando(l.quando)}</td>
                  <td>{l.usuario || <span className="muted">visitante</span>}</td>
                  <td><span className={'badge ' + cls}>{rot}</span></td>
                  <td>{ENTIDADE[l.entidade] || l.entidade || '—'}</td>
                  <td><Detalhe l={l} /></td>
                  <td className="muted" style={{ fontSize: 12 }}>{l.ip}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="row" style={{ marginTop: 10 }}>
        {carregando && <span className="muted">Carregando…</span>}
        {proximo && !carregando && <button className="btn" onClick={() => buscar(true, proximo)}>Carregar mais</button>}
        {!proximo && !carregando && itens.length > 0 && <span className="muted">Fim da lista ({itens.length} registro(s))</span>}
      </div>
    </div>
  )
}

function Barra({ valor, total, rotulo }) {
  const p = total ? Math.min(100, (valor / total) * 100) : 0
  return (
    <div>
      <div className="row between"><span>{rotulo}</span><span className="muted">{fmtBytes(valor)} de {fmtBytes(total)} ({p.toFixed(1).replace('.', ',')}%)</span></div>
      <div style={{ height: 8, borderRadius: 99, background: 'var(--panel2)', overflow: 'hidden', marginTop: 4 }}>
        <div style={{ width: `${p}%`, height: '100%', background: p > 80 ? 'var(--red)' : 'var(--gold)' }} />
      </div>
    </div>
  )
}

export default function Auditoria() {
  const [sp] = useSearchParams()
  const refs = useRef({})
  const [resumo, setResumo] = useState(null)
  const [usuarios, setUsuarios] = useState([])
  const [saude, setSaude] = useState(null)
  const [erro, setErro] = useState('')

  useEffect(() => {
    const s = sp.get('secao')
    if (s && refs.current[s]) refs.current[s].scrollIntoView({ behavior: 'smooth', block: 'start' })
    else window.scrollTo({ top: 0 })
  }, [sp])
  const reg = (id) => (el) => { refs.current[id] = el }

  const atualizar = useCallback(async () => {
    try {
      const [r, u, s] = await Promise.all([api.get('/auditoria/resumo'), api.get('/auditoria/usuarios'), api.get('/auditoria/saude')])
      setResumo(r); setUsuarios(u); setSaude(s); setErro('')
    } catch (e) {
      setErro(e.message)
    }
  }, [])
  useEffect(() => {
    atualizar()
    const id = setInterval(atualizar, 30000)
    return () => clearInterval(id)
  }, [atualizar])

  const dias = (resumo?.dias || []).map((d) => ({ dia: d.dia.slice(8) + '/' + d.dia.slice(5, 7), Eventos: d.eventos, Alterações: d.alteracoes, 'Logins recusados': d.falhas }))

  return (
    <>
      <Hero title="Auditoria" subtitle="Registro de acessos e alterações — visível somente ao analista de sistemas" />
      {erro && <div className="banner" role="alert" style={{ borderColor: 'var(--red)' }}>{erro}</div>}

      <section ref={reg('resumo')}>
        <div className="row between" style={{ marginBottom: 10 }}>
          <h2 style={{ fontSize: 18 }}>Visão geral (últimas 24 horas)</h2>
          <button className="btn sm" onClick={atualizar}>↻ Atualizar</button>
        </div>
        <div className="grid g5">
          <div className="card kpi"><small>Registros nas 24 h</small><b>{resumo?.eventos24 ?? '—'}</b></div>
          <div className="card kpi"><small>Logins</small><b className="pos">{resumo?.logins24 ?? '—'}</b></div>
          <div className="card kpi"><small>Logins recusados</small><b className={resumo?.falhas24 ? 'neg' : ''}>{resumo?.falhas24 ?? '—'}</b></div>
          <div className="card kpi"><small>Alterações de dados</small><b className="gold">{resumo?.alteracoes24 ?? '—'}</b></div>
          <div className="card kpi"><small>Usuários ativos</small><b>{resumo?.usuarios24 ?? '—'}</b></div>
        </div>
        <div className="card" style={{ marginTop: 14 }}>
          <h3>Atividade dos últimos 14 dias</h3>
          {dias.length === 0 ? <div className="empty">Ainda sem registros.</div> : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={dias}>
                <CartesianGrid stroke="#2c2c33" /><XAxis dataKey="dia" stroke="#9b968a" /><YAxis stroke="#9b968a" allowDecimals={false} />
                <Tooltip contentStyle={{ background: '#151518', border: '1px solid #2c2c33' }} /><Legend />
                <Bar dataKey="Eventos" fill="#4c8dff" /><Bar dataKey="Alterações" fill="#d4a437" /><Bar dataKey="Logins recusados" fill="#e5484d" />
              </BarChart>
            </ResponsiveContainer>
          )}
          <div className="muted" style={{ fontSize: 12 }}>Total de registros guardados: {resumo?.total ?? '—'}. Os registros não podem ser alterados nem apagados pelo sistema.</div>
        </div>
      </section>

      <section ref={reg('atividades')}>
        <h2 style={{ fontSize: 18, marginBottom: 10 }}>Registro de atividades</h2>
        <Registro />
      </section>

      <section ref={reg('acessos')}>
        <h2 style={{ fontSize: 18, marginBottom: 10 }}>Acessos (logins, saídas e acessos negados)</h2>
        <Registro base={{ grupo: 'acessos' }} completo={false} />
      </section>

      <section ref={reg('usuarios')}>
        <h2 style={{ fontSize: 18, marginBottom: 10 }}>Usuários com acesso</h2>
        <div className="card tbl-wrap">
          <table>
            <thead><tr><th>Usuário</th><th>Papel</th><th>Criado em</th><th>Último acesso</th><th>Alterações feitas</th></tr></thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.usuario}>
                  <td>{u.usuario}</td>
                  <td><span className={'badge ' + (u.papel === 'analista' ? 'b-a_cobrar' : '')}>{u.papel === 'analista' ? 'Analista de sistemas' : 'Usuário'}</span></td>
                  <td>{quando(u.criado_em)}</td>
                  <td>{u.ultimo_acesso ? quando(u.ultimo_acesso) : <span className="muted">nunca</span>}</td>
                  <td>{u.alteracoes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section ref={reg('saude')}>
        <div className="row between" style={{ marginBottom: 10 }}>
          <h2 style={{ fontSize: 18 }}>Saúde do sistema</h2>
          <span className="muted" style={{ fontSize: 12 }}>Atualiza sozinho a cada 30 segundos</span>
        </div>
        {saude && (
          <div className="grid g2">
            <div className="card">
              <h3>Servidor e banco de dados</h3>
              <div className="dados">
                <div className="dado"><small className="muted">Banco de dados</small><b className="pos">● Respondendo</b></div>
                <div className="dado"><small className="muted">Tempo de resposta do banco</small><b>{String(saude.latenciaMs).replace('.', ',')} ms</b></div>
                <div className="dado"><small className="muted">No ar há</small><b>{duracao(saude.disponivelHaSegundos)}</b></div>
                <div className="dado"><small className="muted">Iniciado em</small><b>{quando(saude.iniciadoEm)}</b></div>
                <div className="dado"><small className="muted">Memória do servidor</small><b>{saude.memoriaMB} MB</b></div>
                <div className="dado"><small className="muted">Versão do Node</small><b>{saude.node}</b></div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
                <Barra rotulo="Documentos guardados" valor={saude.armazenamento.bytesDocumentos} total={saude.armazenamento.limiteBytes} />
                {saude.armazenamento.bytesBanco != null && <Barra rotulo="Banco de dados inteiro (plano de 1 GB)" valor={saude.armazenamento.bytesBanco} total={saude.armazenamento.limiteBytes} />}
              </div>
            </div>
            <div className="card">
              <h3>Registros guardados</h3>
              <table>
                <tbody>
                  {[['Clientes', saude.contagens.clientes], ['Movimentações lançadas', saude.contagens.movimentacoes], ['Chaves PIX', saude.contagens.chavesPix],
                    ['Anotações e envios (histórico)', saude.contagens.historico], ['Documentos pessoais', saude.contagens.documentos], ['Usuários', saude.contagens.usuarios],
                    ['Links de cadastro gerados', saude.contagens.linksGerados], ['Links já utilizados', saude.contagens.linksUsados]]
                    .map(([k, v]) => <tr key={k}><td>{k}</td><td className="num"><b>{v}</b></td></tr>)}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </>
  )
}
