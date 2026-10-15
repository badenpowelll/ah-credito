import { useState } from 'react'
import logo from '../assets/logo.jpg'
import { api } from '../lib/api'

export async function sair() {
  try { await api.post('/logout') } catch { /* sessão já encerrada */ }
  location.reload()
}

const Olho = ({ aberto }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
    {!aberto && <path d="M4 4l16 16" />}
  </svg>
)

export default function Login({ onEntrar }) {
  const [u, setU] = useState('')
  const [s, setS] = useState('')
  const [ver, setVer] = useState(false)
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  const enviar = async (e) => {
    e.preventDefault()
    setErro('')
    setEnviando(true)
    try {
      await api.post('/login', { usuario: u, senha: s })
      onEntrar()
    } catch (err) {
      setErro(err.message)
    }
    setEnviando(false)
  }

  return (
    <div className="login">
      <form className="login-box" onSubmit={enviar}>
        <img src={logo} alt="AH Crédito" />
        <h1>Entrar</h1>
        <div className="field">
          <label htmlFor="usuario">Usuário</label>
          <input id="usuario" autoComplete="username" value={u} onChange={(e) => setU(e.target.value)} autoFocus required />
        </div>
        <div className="field">
          <label htmlFor="senha">Senha</label>
          <div className="senha-wrap">
            <input id="senha" type={ver ? 'text' : 'password'} autoComplete="current-password" value={s} onChange={(e) => setS(e.target.value)} required />
            <button type="button" className="olho" onClick={() => setVer((v) => !v)} aria-label={ver ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={ver} title={ver ? 'Ocultar senha' : 'Mostrar senha'}>
              <Olho aberto={ver} />
            </button>
          </div>
        </div>
        {erro && <div className="login-erro" role="alert">{erro}</div>}
        <button className="btn primary" disabled={enviando} style={{ justifyContent: 'center', padding: 11 }}>{enviando ? 'Entrando…' : 'Acessar'}</button>
      </form>
    </div>
  )
}
