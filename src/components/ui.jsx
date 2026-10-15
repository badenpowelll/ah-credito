import logo from '../assets/logo.jpg'
import { useRef, useState } from 'react'
import { STATUS_LABEL, buscaCep, formataCep, soDigitos } from '../lib/utils'

export function Modal({ title, onClose, children, wide }) {
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={wide ? { maxWidth: 960 } : undefined}>
        <div className="row between">
          <h2>{title}</h2>
          <button className="btn sm" onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

export const Field = ({ label, full, children }) => (
  <div className={'field' + (full ? ' full' : '')}>
    <label>{label}</label>
    {children}
  </div>
)

export const StatusBadge = ({ status }) => <span className={`badge b-${status}`}>{STATUS_LABEL[status]}</span>

export function Hero({ title, subtitle }) {
  return (
    <div className="hero">
      <img src={logo} alt="AH Crédito" />
      <div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
    </div>
  )
}

/** CEP com máscara: ao completar 8 dígitos busca o endereço e chama onFound. */
export function CepField({ value, onChange, onFound, label = 'CEP', full }) {
  const [msg, setMsg] = useState({ t: '', ok: true })
  const ultimo = useRef('')
  const mudou = async (e) => {
    const v = formataCep(e.target.value)
    onChange(v)
    const d = soDigitos(v)
    ultimo.current = d
    if (d.length < 8) return setMsg({ t: '', ok: true })
    setMsg({ t: 'Buscando endereço…', ok: true })
    const r = await buscaCep(d)
    if (ultimo.current !== d) return
    if (r) { onFound(r); setMsg({ t: '✔ Endereço preenchido automaticamente', ok: true }) }
    else setMsg({ t: 'CEP não encontrado ou sem conexão. Preencha o endereço manualmente.', ok: false })
  }
  return (
    <Field label={label} full={full}>
      <input inputMode="numeric" autoComplete="postal-code" placeholder="00000-000" maxLength={9} value={value} onChange={mudou} />
      {msg.t && <small style={{ color: msg.ok ? 'var(--muted)' : 'var(--red)' }}>{msg.t}</small>}
    </Field>
  )
}
