import logo from '../assets/logo.jpg'
import { useLayoutEffect, useRef, useState } from 'react'
import { CLASSE_PARCELA, ROTULO_PARCELA } from '../lib/situacaoParcelas'
import { STATUS_LABEL, buscaCep, formataCep, soDigitos, useBancos, whatsApp, whatsWeb } from '../lib/utils'

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

/**
 * Campo em reais: ao digitar 1000 já mostra 1.000,00. O cursor fica antes da vírgula;
 * digitar "," pula para os centavos.
 */
export function MoneyInput({ value, onChange, ...rest }) {
  const ref = useRef(null)
  const caret = useRef(null)

  useLayoutEffect(() => {
    if (caret.current != null && ref.current && document.activeElement === ref.current) {
      ref.current.setSelectionRange(caret.current, caret.current)
    }
    caret.current = null
  }, [value])

  const mudou = (e) => {
    const raw = e.target.value
    const pos = e.target.selectionStart ?? raw.length
    const digitos = (s) => s.replace(/\D/g, '')
    const virgulas = (raw.match(/,/g) || []).length
    let inteiro, dec, naCasaDecimal = false, k = 0, d = 0

    if (virgulas > 1) {
      // o usuário digitou ",": a vírgula nova está em pos-1; o cursor vai para os centavos
      inteiro = digitos(raw.slice(0, pos - 1))
      dec = digitos(raw.slice(pos)).slice(0, 2)
      naCasaDecimal = true
    } else if (virgulas === 0) {
      inteiro = digitos(raw)
      dec = ''
      k = digitos(raw.slice(0, pos)).length
    } else {
      const ci = raw.indexOf(',')
      inteiro = digitos(raw.slice(0, ci))
      dec = digitos(raw.slice(ci + 1)).slice(0, 2)
      if (pos <= ci) k = digitos(raw.slice(0, pos)).length
      else { naCasaDecimal = true; d = Math.min(2, digitos(raw.slice(ci + 1, pos)).length) }
    }
    inteiro = inteiro.replace(/^0+(?=\d)/, '')
    if (!inteiro && !/[1-9]/.test(dec)) { caret.current = null; return onChange('') }
    if (!inteiro) inteiro = '0'
    const milhar = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
    const texto = milhar + ',' + dec.padEnd(2, '0')

    if (naCasaDecimal) caret.current = milhar.length + 1 + d
    else {
      let contados = 0, idx = 0
      while (idx < milhar.length && contados < k) { if (milhar[idx] !== '.') contados++; idx++ }
      caret.current = idx
    }
    onChange(texto)
    // Se o texto não mudou (ex.: digitou "," antes dos centavos) o React não redesenha; fixa o cursor assim mesmo.
    const alvo = caret.current
    setTimeout(() => {
      if (ref.current && document.activeElement === ref.current && alvo != null) ref.current.setSelectionRange(alvo, alvo)
    }, 0)
  }

  return <input ref={ref} inputMode="decimal" placeholder="0,00" {...rest} value={value} onChange={mudou} />
}

/** Banco com sugestões da BrasilAPI: digite o nome ou o código e escolha da lista. */
export function BancoInput({ value, onChange, ...rest }) {
  const bancos = useBancos()
  return (
    <>
      <input list="lista-bancos" autoComplete="off" placeholder="Digite o nome ou o código do banco" {...rest} value={value} onChange={(e) => onChange(e.target.value)} />
      <datalist id="lista-bancos">{bancos.map((b) => <option key={b} value={b} />)}</datalist>
    </>
  )
}

/** Envio por WhatsApp sem passar pela página intermediária do WhatsApp (preserva os emojis). */
export function ZapLinks({ tel, msg, label = 'WhatsApp', onSend, primary = false, small = true, block = false }) {
  const base = 'btn' + (small ? ' sm' : '')
  const estilo = block ? { flex: 1, justifyContent: 'center' } : undefined
  return (
    <span className="row" style={{ gap: 6, flexWrap: 'nowrap', ...(block ? { flex: 1 } : {}) }}>
      <a className={`${base} ${primary ? 'primary' : 'green'}`} style={estilo} href={whatsApp(tel, msg)} onClick={onSend} title="Abrir no app do WhatsApp">{label}</a>
      <a className={base} target="_blank" rel="noreferrer" href={whatsWeb(tel, msg)} onClick={onSend} title="Abrir no WhatsApp Web">Web</a>
    </span>
  )
}

/** Selo da parcela: PAGO (verde), ATRASADO (vermelho) ou EM DIA (amarelo). */
export const SituacaoParcela = ({ status }) => <span className={`badge ${CLASSE_PARCELA[status]}`}>{ROTULO_PARCELA[status]}</span>
