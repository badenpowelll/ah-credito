import { useState } from 'react'
import logo from '../assets/logo.jpg'

// Acesso de teste (verificação feita no navegador, sem servidor).
const USUARIO = 'teste'
const SENHA = 'AH@2026teste'
const CHAVE = 'ahc:auth'

export const estaLogado = () => {
  try { return sessionStorage.getItem(CHAVE) === '1' } catch { return false }
}
export const sair = () => {
  try { sessionStorage.removeItem(CHAVE) } catch { /* sem armazenamento */ }
  location.reload()
}

export default function Login({ onEntrar }) {
  const [u, setU] = useState('')
  const [s, setS] = useState('')
  const [erro, setErro] = useState('')

  const enviar = (e) => {
    e.preventDefault()
    if (u.trim().toLowerCase() === USUARIO && s === SENHA) {
      try { sessionStorage.setItem(CHAVE, '1') } catch { /* sem armazenamento */ }
      onEntrar()
    } else {
      setErro('Usuário ou senha incorretos.')
    }
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
        <button className="btn primary" style={{ justifyContent: 'center', padding: 11 }}>Acessar</button>
      </form>
    </div>
  )
}
