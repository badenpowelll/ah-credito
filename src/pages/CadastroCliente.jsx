import { useEffect, useState } from 'react'
import logo from '../assets/logo.jpg'
import { CepField, Field } from '../components/ui'
import { api } from '../lib/api'
import { EMPRESA, resumoEmprestimo } from '../lib/cadastro'

/** Página pública (sem login) aberta pelo link enviado ao cliente. O cadastro entra direto no sistema. */
export default function CadastroCliente({ token }) {
  const [termos, setTermos] = useState(null)
  const [estado, setEstado] = useState('carregando') // carregando | form | enviado | invalido
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [f, setF] = useState({ nome: '', cpf: '', rg: '', telefone: '', email: '', cep: '', endereco: '', numero: '', complemento: '', cidade: '', tipoEndereco: 'Residencial' })
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))
  const achou = (r) => setF((x) => ({ ...x, endereco: r.endereco, cidade: r.cidade }))

  useEffect(() => {
    api.get(`/public/cadastro/${encodeURIComponent(token)}`).then(
      (t) => { setTermos(t); setEstado('form') },
      (e) => { setErro(e.message); setEstado('invalido') },
    )
  }, [token])

  const enviar = async (e) => {
    e.preventDefault()
    setErro('')
    setEnviando(true)
    try {
      await api.post(`/public/cadastro/${encodeURIComponent(token)}`, f)
      setEstado('enviado')
    } catch (err) {
      setErro(err.message)
    }
    setEnviando(false)
  }

  return (
    <div className="login">
      <div className="login-box" style={{ maxWidth: 560 }}>
        <img src={logo} alt={EMPRESA} />
        <h1>Cadastro de Cliente</h1>
        {estado === 'carregando' && <div className="muted" style={{ textAlign: 'center' }}>Carregando…</div>}
        {estado === 'invalido' && <div className="login-erro" role="alert" style={{ textAlign: 'center' }}>{erro || 'Link inválido.'}<br />Peça um novo link à {EMPRESA}.</div>}
        {estado === 'enviado' && (
          <div className="pos" style={{ textAlign: 'center' }}>
            <b>Cadastro enviado!</b><br />A {EMPRESA} já recebeu seus dados e dará continuidade ao atendimento.
          </div>
        )}
        {estado === 'form' && (
          <>
            <div className="muted" style={{ textAlign: 'center' }}>{resumoEmprestimo(termos)}</div>
            <form onSubmit={enviar} className="form">
              <Field label="Nome completo *" full><input value={f.nome} onChange={set('nome')} required /></Field>
              <Field label="CPF *"><input value={f.cpf} onChange={set('cpf')} required /></Field>
              <Field label="RG"><input value={f.rg} onChange={set('rg')} /></Field>
              <Field label="Telefone / WhatsApp *"><input value={f.telefone} onChange={set('telefone')} required /></Field>
              <Field label="E-mail"><input type="email" value={f.email} onChange={set('email')} /></Field>
              <CepField label="CEP *" value={f.cep} onChange={(v) => setF((x) => ({ ...x, cep: v }))} onFound={achou} />
              <Field label="Tipo de endereço">
                <select value={f.tipoEndereco} onChange={set('tipoEndereco')}><option>Residencial</option><option>Trabalho</option></select>
              </Field>
              <Field label="Endereço (rua e bairro) *" full><input value={f.endereco} onChange={set('endereco')} required /></Field>
              <Field label="Número *"><input value={f.numero} onChange={set('numero')} required /></Field>
              <Field label="Complemento"><input value={f.complemento} onChange={set('complemento')} /></Field>
              <Field label="Cidade/UF"><input value={f.cidade} onChange={set('cidade')} /></Field>
              {erro && <div className="login-erro full" role="alert">{erro}</div>}
              <div className="full"><button className="btn primary" disabled={enviando} style={{ width: '100%', justifyContent: 'center', padding: 11 }}>{enviando ? 'Enviando…' : 'Enviar cadastro'}</button></div>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
