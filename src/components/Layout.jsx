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

export default function Layout({ children }) {
  const loc = useLocation()
  const [sp] = useSearchParams()
  const { erroSync } = useStore()
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState({ '/': true, '/emprestimos': true, '/manual': false })

  return (
    <div className="shell">
      <aside className={'sidebar' + (open ? ' open' : '')}>
        <div className="brand">
          <img src={logo} alt="AH Crédito" />
        </div>
        <nav>
          {MENUS.map((m) => {
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
