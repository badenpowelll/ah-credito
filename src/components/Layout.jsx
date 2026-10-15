import logo from '../assets/logo.jpg'
import { useState } from 'react'
import { sair } from './Login'
import { useStore } from '../lib/store'
import { NavLink, useLocation, useSearchParams } from 'react-router-dom'

/** Exatamente 2 menus, cada um com seus submenus (itens = abas/seções das páginas). */
export const MENUS = [
  {
    title: 'Dashboard',
    to: '/',
    icon: '▦',
    param: 'secao',
    subs: [
      { id: 'resumo', label: 'Resumo Geral' },
      { id: 'carteira', label: 'Carteira de Empréstimos' },
      { id: 'projecao', label: 'Projeção 12 meses' },
      { id: 'graficos', label: 'Gráficos' },
      { id: 'devedores', label: 'Situação dos Clientes' },
      { id: 'movimentacoes', label: 'Movimentações' },
      { id: 'nova', label: 'Nova Movimentação' },
      { id: 'robo-financeiro', label: 'Robô Financeiro' },
    ],
  },
  {
    title: 'Empréstimos',
    to: '/emprestimos',
    icon: '$',
    param: 'aba',
    subs: [
      { id: 'devedores', label: 'Clientes' },
      { id: 'calendario', label: 'Calendário' },
      { id: 'mapa', label: 'Mapa' },
      { id: 'informacoes', label: 'Cadastro e Chaves PIX' },
      { id: 'novo', label: 'Novo Cliente' },
      { id: 'link', label: 'Gerar Link de Cadastro' },
      { id: 'importar', label: 'Importar Cadastro' },
      { id: 'cobranca', label: 'Robô de Cobrança' },
      { id: 'credito', label: 'Robô de Crédito' },
      { id: 'lixeira', label: 'Lixeira' },
      { id: 'pdf', label: 'Baixar PDF' },
    ],
  },
]

export const MENU_MANUAL = {
  title: 'Manual de Utilização',
  to: '/manual',
  icon: '?',
  param: 'secao',
  subs: [
    { id: 'mapa', label: 'Mapa mental' },
    { id: 'acesso', label: 'Primeiros passos' },
    { id: 'dash-resumo', label: 'Dashboard' },
    { id: 'emp-clientes', label: 'Clientes' },
    { id: 'emp-novo', label: 'Novo cliente e documentos' },
    { id: 'emp-ficha', label: 'Ficha do cliente' },
    { id: 'emp-calendario', label: 'Calendário e mapa' },
    { id: 'emp-pix', label: 'PIX e link de cadastro' },
    { id: 'emp-planilha', label: 'Planilha' },
    { id: 'emp-cobranca', label: 'Robôs' },
    { id: 'cuidados', label: 'Dúvidas e cuidados' },
  ],
}
MENUS.push(MENU_MANUAL)

// Só o analista de sistemas enxerga este menu (o servidor também confere o papel em cada pedido).
export const MENU_AUDITORIA = {
  title: 'Auditoria',
  to: '/auditoria',
  icon: '◎',
  param: 'secao',
  subs: [
    { id: 'resumo', label: 'Visão geral' },
    { id: 'atividades', label: 'Registro de atividades' },
    { id: 'acessos', label: 'Acessos' },
    { id: 'usuarios', label: 'Usuários' },
    { id: 'sla', label: 'Monitoramento de SLA' },
    { id: 'saude', label: 'Saúde do sistema' },
    { id: 'demo', label: 'Dados de demonstração' },
  ],
}

async function baixarBackup() {
  try {
    const r = await fetch('/api/backup', { credentials: 'same-origin' })
    if (!r.ok) throw new Error('falha')
    const url = URL.createObjectURL(await r.blob())
    const a = document.createElement('a')
    a.href = url
    a.download = `backup-ah-credito-${new Date().toLocaleDateString('sv-SE')}.json`
    a.click()
    URL.revokeObjectURL(url)
  } catch {
    alert('Não foi possível gerar o backup. Tente de novo.')
  }
}

export default function Layout({ children }) {
  const loc = useLocation()
  const [sp] = useSearchParams()
  const { erroSync, usuario } = useStore()
  const menus = usuario?.papel === 'analista' ? [...MENUS, MENU_AUDITORIA] : MENUS
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState({ '/': true, '/emprestimos': true, '/manual': false, '/auditoria': false })

  return (
    <div className="shell">
      <aside className={'sidebar' + (open ? ' open' : '')}>
        <div className="brand">
          <img src={logo} alt="AH Crédito" />
        </div>
        <nav>
          {menus.map((m) => {
            const active = loc.pathname === m.to
            const isOpen = expanded[m.to]
            return (
              <div key={m.to} className="menu-group">
                <div className={'menu-item' + (active ? ' active' : '')}>
                  <NavLink to={m.to} onClick={() => setOpen(false)} className="menu-link">
                    <span className="ico">{m.icon}</span> {m.title}
                  </NavLink>
                  <button
                    className="chev"
                    aria-label={`Submenus de ${m.title}`}
                    onClick={() => setExpanded((e) => ({ ...e, [m.to]: !e[m.to] }))}
                  >
                    {isOpen ? '▾' : '▸'}
                  </button>
                </div>
                {isOpen && (
                  <div className="submenu">
                    {m.subs.map((s) => {
                      const cur = active && sp.get(m.param) === s.id
                      return (
                        <NavLink
                          key={s.id}
                          to={`${m.to}?${m.param}=${s.id}&t=${Date.now()}`}
                          className={'sub-item' + (cur ? ' active' : '')}
                          onClick={() => setOpen(false)}
                        >
                          {s.label}
                        </NavLink>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </nav>
        <div className="side-foot">
          {usuario?.usuario && <div className="muted" style={{ fontSize: 11, marginBottom: 6, overflowWrap: 'anywhere' }}>Conectado: {usuario.usuario}</div>}
          <button className="btn sm" onClick={baixarBackup} title="Baixa um arquivo com todos os dados cadastrados">⬇ Backup</button>{' '}
          <button className="btn sm" onClick={sair}>Sair</button>
          <div style={{ marginTop: 8 }}>AH Crédito · Crédito Pessoal</div>
        </div>
      </aside>
      {open && <div className="scrim" onClick={() => setOpen(false)} />}
      <div className="main">
        <header className="topbar">
          <button className="burger" onClick={() => setOpen(true)} aria-label="Abrir menu">
            ☰
          </button>
          <img src={logo} alt="" className="top-logo" />
          <strong>AH Crédito</strong>
        </header>
        <main className="content">
          {erroSync && <div className="banner" role="alert" style={{ borderColor: 'var(--red)' }}>{erroSync}</div>}
          {children}
        </main>
      </div>
    </div>
  )
}
