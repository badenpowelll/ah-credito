import { useState } from 'react'
import logo from '../assets/logo.jpg'
import { api } from '../lib/api'

export async function sair() {
  try { await api.post('/logout') } catch { /* sessão já encerrada */ }
  location.reload()
}

export default function Login({ onEntrar }) {
  const [u, setU] = useState('')
  const [s, setS] = useState('')
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
          <input id="senha" type="password" autoComplete="current-password" value={s} onChange={(e) => setS(e.target.value)} required />
        </div>
        {erro && <div className="login-erro" role="alert">{erro}</div>}
        <button className="btn primary" disabled={enviando} style={{ justifyContent: 'center', padding: 11 }}>{enviando ? 'Entrando…' : 'Acessar'}</button>
      </form>
    </div>
  )
}
