import { useState } from 'react'
import logo from '../assets/logo.jpg'
import { CepField, Field } from '../components/ui'
import { EMPRESA, gerarCodigo, resumoEmprestimo } from '../lib/cadastro'

/** Página pública (sem login) aberta pelo link enviado ao cliente. */
export default function CadastroCliente({ termos }) {
  const [f, setF] = useState({ nome: '', cpf: '', rg: '', telefone: '', email: '', cep: '', endereco: '', numero: '', complemento: '', cidade: '', tipoEndereco: 'Residencial' })
  const [codigo, setCodigo] = useState('')
  const [msg, setMsg] = useState('')
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))

  const achou = (r) => setF((x) => ({ ...x, endereco: r.endereco, cidade: r.cidade }))
  const enviar = (e) => {
    e.preventDefault()
    setCodigo(gerarCodigo({ ...f, v: termos.v, j: termos.j, d: termos.d, f: termos.f }))
  }
  const texto = `✅ Novo cadastro — ${EMPRESA}\n\nCliente: ${f.nome}\n\nCódigo do cadastro (cole em "Importar cadastro"):\n${codigo}`
  const copiar = async () => {
    try { await navigator.clipboard.writeText(texto); setMsg('Dados copiados! Envie para a empresa.') } catch { setMsg('Selecione o código acima e copie (Ctrl+C).') }
  }

  return (
    <div className="login">
      <div className="login-box" style={{ maxWidth: 560 }}>
        <img src={logo} alt={EMPRESA} />
        <h1>Cadastro de Cliente</h1>
        <div className="muted" style={{ textAlign: 'center' }}>{resumoEmprestimo(termos)}</div>
        {!codigo ? (
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
            <div className="full"><button className="btn primary" style={{ width: '100%', justifyContent: 'center', padding: 11 }}>Enviar cadastro</button></div>
          </form>
        ) : (
          <div className="form" style={{ gridTemplateColumns: '1fr' }}>
            <div className="pos"><b>Cadastro preenchido!</b> Falta só enviar os dados para a {EMPRESA}.</div>
            <textarea className="search" readOnly rows="4" value={codigo} onFocus={(e) => e.target.select()} aria-label="Código do cadastro" />
            <div className="row">
              {termos.w && <a className="btn green" style={{ flex: 1, justifyContent: 'center' }} target="_blank" rel="noreferrer" href={`https://api.whatsapp.com/send?phone=${termos.w}&text=${encodeURIComponent(texto)}`}>Enviar pelo WhatsApp</a>}
              <button className="btn" style={{ flex: 1, justifyContent: 'center' }} onClick={copiar}>Copiar dados</button>
            </div>
            {msg && <div className="pos">{msg}</div>}
          </div>
        )}
      </div>
    </div>
  )
}
