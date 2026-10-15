import { useCallback, useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import Login from './components/Login'
import CadastroCliente from './pages/CadastroCliente'
import Dashboard from './pages/Dashboard'
import Emprestimos from './pages/Emprestimos'
import Manual from './pages/Manual'
import { api } from './lib/api'
import { StoreProvider } from './lib/store'

const tokenDoHash = () => (location.hash.startsWith('#cad-') ? location.hash.slice(5) : null)

function Carregando({ texto = 'Carregando…' }) {
  return <div className="login"><div className="muted">{texto}</div></div>
}

function Sistema() {
  const [estado, setEstado] = useState('verificando') // verificando | deslogado | carregando | pronto | erro
  const [dados, setDados] = useState(null)

  const carregar = useCallback(async () => {
    setEstado('carregando')
    try {
      setDados(await api.get('/data'))
      setEstado('pronto')
    } catch (e) {
      setEstado(e.status === 401 ? 'deslogado' : 'erro')
    }
  }, [])

  useEffect(() => {
    api.get('/me').then(carregar, (e) => setEstado(e.status === 401 ? 'deslogado' : 'erro'))
  }, [carregar])

  if (estado === 'verificando' || estado === 'carregando') return <Carregando />
  if (estado === 'erro') {
    return (
      <div className="login">
        <div className="login-box">
          <h1>Sem conexão</h1>
          <div className="muted" style={{ textAlign: 'center' }}>Não foi possível falar com o servidor.</div>
          <button className="btn primary" style={{ justifyContent: 'center' }} onClick={() => location.reload()}>Tentar de novo</button>
        </div>
      </div>
    )
  }
  if (estado === 'deslogado') return <Login onEntrar={carregar} />

  return (
    <StoreProvider dados={dados} onSessaoExpirada={() => setEstado('deslogado')}>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/emprestimos" element={<Emprestimos />} />
          <Route path="/manual" element={<Manual />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </StoreProvider>
  )
}

export default function App() {
  const [token, setToken] = useState(tokenDoHash)
  useEffect(() => {
    const aoMudar = () => setToken(tokenDoHash())
    window.addEventListener('hashchange', aoMudar)
    return () => window.removeEventListener('hashchange', aoMudar)
  }, [])

  // Link enviado ao cliente: página pública de cadastro, sem login.
  if (token) return <CadastroCliente token={token} />
  return <Sistema />
}
