import { useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import Login, { estaLogado } from './components/Login'
import CadastroCliente from './pages/CadastroCliente'
import Dashboard from './pages/Dashboard'
import Emprestimos from './pages/Emprestimos'
import { lerTokenDoHash } from './lib/cadastro'

export default function App() {
  const [logado, setLogado] = useState(estaLogado)
  const [termos, setTermos] = useState(() => lerTokenDoHash())
  useEffect(() => {
    const aoMudar = () => setTermos(lerTokenDoHash())
    window.addEventListener('hashchange', aoMudar)
    return () => window.removeEventListener('hashchange', aoMudar)
  }, [])

  // Link enviado ao cliente: página pública de cadastro, sem login.
  if (termos) return <CadastroCliente termos={termos} />
  if (!logado) return <Login onEntrar={() => setLogado(true)} />
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/emprestimos" element={<Emprestimos />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}
