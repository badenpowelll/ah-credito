import { useState } from 'react'

/** Assistente local (sem IA/servidor): responde com regras sobre os dados do navegador. */
export default function Robo({ titulo, sugestoes, responder }) {
  const [msgs, setMsgs] = useState([])
  const [texto, setTexto] = useState('')

  const enviar = (q) => {
    const pergunta = (q ?? texto).trim()
    if (!pergunta) return
    setMsgs((m) => [...m, { de: 'user', t: pergunta }, { de: 'bot', t: responder(pergunta) }])
    setTexto('')
  }

  return (
    <div className="card">
      <h3>{titulo}</h3>
      <div className="row">
        {sugestoes.map((s) => (
          <button key={s} className="btn sm" onClick={() => enviar(s)}>{s}</button>
        ))}
      </div>
      <div className="chat">
        {msgs.length === 0 && <div className="muted">Escolha uma pergunta acima ou escreva a sua.</div>}
        {msgs.map((m, i) => (
          <div key={i} className={'msg ' + m.de}>{m.t}</div>
        ))}
      </div>
      <form className="row" onSubmit={(e) => { e.preventDefault(); enviar() }}>
        <input className="search" style={{ flex: 1 }} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Digite sua pergunta…" />
        <button className="btn primary">Enviar</button>
      </form>
    </div>
  )
}
