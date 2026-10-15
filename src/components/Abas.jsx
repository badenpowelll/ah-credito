import { useEffect, useMemo, useState } from 'react'
import L from 'leaflet'
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'
import { BancoInput, Field, Modal, StatusBadge, ZapLinks } from './ui'
import Robo from './Robo'
import { msgDocumentos } from '../lib/cadastro'
import { CFG_PADRAO, filaDeCobranca, rotuloEstagio } from '../lib/cobranca'
import { responder } from '../lib/consulta'
import { useStore } from '../lib/store'
import { MESES, brl, fmtData, localizarCliente, soDigitos, statusDe, useLocalStorage } from '../lib/utils'

const COR = { pago: '#2fb36d', atrasado: '#e5484d', a_cobrar: '#e8b931' }

export function CalendarioTab({ debtors, onOpen }) {
  const [ref, setRef] = useState(() => new Date())
  const ano = ref.getFullYear(), mes = ref.getMonth()
  const dias = new Date(ano, mes + 1, 0).getDate()
  const offset = new Date(ano, mes, 1).getDay()
  const hoje = new Date()
  const celulas = [...Array(offset).fill(null), ...Array.from({ length: dias }, (_, i) => i + 1)]
  const ehMesAtual = ano === hoje.getFullYear() && mes === hoje.getMonth()
  const stDia = (d, dia) => {
    if ((d.pagos || []).includes(`${ano}-${String(mes + 1).padStart(2, '0')}`)) return 'pago'
    if (d.statusOverride) return d.statusOverride
    return ehMesAtual ? statusDe(d) : new Date(ano, mes, dia) < hoje ? 'atrasado' : 'a_cobrar'
  }
  return (
    <div className="card">
      <div className="row between" style={{ marginBottom: 12 }}>
        <button className="btn sm" onClick={() => setRef(new Date(ano, mes - 1, 1))}>◀</button>
        <b>{MESES[mes]} {ano}</b>
        <button className="btn sm" onClick={() => setRef(new Date(ano, mes + 1, 1))}>▶</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4 }}>
        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((d) => <div key={d} className="muted" style={{ textAlign: 'center', fontSize: 12 }}>{d}</div>)}
        {celulas.map((dia, i) => {
          const dd = dia ? debtors.filter((d) => Math.min(+d.diaVencimento, dias) === dia) : []
          return (
            <div key={i} style={{ minHeight: 84, background: dia ? 'var(--panel2)' : 'transparent', borderRadius: 8, padding: 4, border: ehMesAtual && dia === hoje.getDate() ? '1px solid var(--gold)' : '1px solid transparent' }}>
              <div className="muted" style={{ fontSize: 11 }}>{dia}</div>
              {dd.map((d) => (
                <div key={d.id} title={`${d.nome} — ${brl(d.valorParcela)}`} onClick={() => onOpen(d)}
                  style={{ cursor: 'pointer', fontSize: 11, marginTop: 2, padding: '2px 4px', borderRadius: 5, background: COR[stDia(d, dia)] + '33', borderLeft: `3px solid ${COR[stDia(d, dia)]}`, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                  {d.nome}
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}

const pino = (cor, letra) =>
  L.divIcon({
    className: '',
    iconSize: [30, 38],
    iconAnchor: [15, 38],
    popupAnchor: [0, -34],
    html: `<svg width="30" height="38" viewBox="0 0 30 38"><path d="M15 1C7.3 1 1 7.2 1 14.8 1 25 15 37 15 37s14-12 14-22.2C29 7.2 22.7 1 15 1z" fill="${cor}" stroke="#fff" stroke-width="2"/><text x="15" y="19" text-anchor="middle" font-size="12" font-weight="700" fill="#111" font-family="sans-serif">${letra}</text></svg>`,
  })

function AjustaMapa({ pontos }) {
  const map = useMap()
  useEffect(() => {
    if (!pontos.length) return
    if (pontos.length === 1) map.setView([pontos[0].g.lat, pontos[0].g.lng], 15)
    else map.fitBounds(pontos.map((p) => [p.g.lat, p.g.lng]), { padding: [40, 40], maxZoom: 16 })
  }, [pontos.map((p) => p.d.id + p.g.lat).join('|')]) // eslint-disable-line
  return null
}

export function MapaTab({ debtors, onOpen }) {
  const { markPaid } = useStore()
  const [geo, setGeo] = useLocalStorage('ahc:geo2', {})
  const [filtro, setFiltro] = useState('todos')
  const [buscando, setBuscando] = useState(false)
  const chave = (d) => [soDigitos(d.cep), d.endereco, d.numero, d.cidade].join('|')
  const comEndereco = debtors.filter((d) => soDigitos(d.cep).length === 8 || d.endereco)

  useEffect(() => {
    let vivo = true
    ;(async () => {
      const falta = comEndereco.filter((d) => geo[chave(d)] === undefined)
      if (!falta.length) return
      setBuscando(true)
      for (const d of falta) {
        const r = await localizarCliente(d)
        if (!vivo) return
        setGeo((g) => ({ ...g, [chave(d)]: r || null }))
        await new Promise((ok) => setTimeout(ok, 1100))
      }
      if (vivo) setBuscando(false)
    })()
    return () => { vivo = false }
  }, [comEndereco.map(chave).join('#')]) // eslint-disable-line

  const todos = comEndereco.map((d) => ({ d, g: geo[chave(d)], st: statusDe(d) }))
  const pontos = todos.filter((p) => p.g && (filtro === 'todos' || p.st === filtro))
  const semLocal = todos.filter((p) => p.g === null)
  const cont = (s) => todos.filter((p) => p.g && p.st === s).length

  return (
    <div className="card">
      <div className="row between" style={{ marginBottom: 10 }}>
        <div className="tabs">
          {[['todos', 'Todos'], ['atrasado', 'ATRASADO'], ['a_cobrar', 'A COBRAR'], ['pago', 'PAGO']].map(([id, l]) => (
            <button key={id} className={'tab' + (filtro === id ? ' active' : '')} onClick={() => setFiltro(id)}>
              {id !== 'todos' && <i className="dot" style={{ background: COR[id] }} />} {l}{id !== 'todos' ? ` (${cont(id)})` : ` (${todos.filter((p) => p.g).length})`}
            </button>
          ))}
        </div>
        {buscando && <span className="muted">Localizando endereços…</span>}
      </div>
      {comEndereco.length === 0 && <div className="empty">Cadastre clientes com CEP e endereço para ver os pontos no mapa.</div>}
      <div className="map">
        <MapContainer center={[-14.2, -51.9]} zoom={4} style={{ height: '100%' }}>
          <TileLayer attribution="© OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <AjustaMapa pontos={pontos} />
          {pontos.map(({ d, g, st }) => (
            <Marker key={d.id} position={[g.lat, g.lng]} icon={pino(COR[st], d.tipoEndereco === 'Trabalho' ? 'T' : 'R')}>
              <Popup>
                <b>{d.nome}</b> <span className={`badge b-${st}`}>{STATUS(st)}</span><br />
                {d.tipoEndereco || 'Residencial'} · {[d.endereco, d.numero, d.cidade].filter(Boolean).join(', ')}<br />
                Parcela {brl(d.valorParcela)} · vence dia {d.diaVencimento}<br />
                <div className="row" style={{ marginTop: 6 }}>
                  <button className="btn sm" onClick={() => onOpen?.(d)}>Abrir cliente</button>
                  {st !== 'pago' && <button className="btn sm green" onClick={() => markPaid(d.id)}>Marcar pago</button>}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
      <div className="row" style={{ marginTop: 10 }}>
        {Object.entries(COR).map(([k, c]) => <span key={k} className="row" style={{ gap: 5 }}><i className="dot" style={{ background: c }} />{STATUS(k)}</span>)}
        <span className="muted">R = residencial · T = trabalho</span>
      </div>
      {semLocal.length > 0 && (
        <div className="muted" style={{ marginTop: 8 }}>
          Endereço não localizado: {semLocal.map((p) => p.d.nome).join(', ')}. Confira CEP, rua e cidade no cadastro.
        </div>
      )}
    </div>
  )
}

const STATUS = (s) => ({ pago: 'PAGO', atrasado: 'ATRASADO', a_cobrar: 'A COBRAR' }[s])

export function PixTab({ debtors }) {
  const { pixKeys, addPix, deletePix } = useStore()
  const [p, setP] = useState({ titular: '', banco: '', chave: '' })
  const [cliente, setCliente] = useState('')
  const [chavePix, setChavePix] = useState('')
  const d = debtors.find((x) => x.id === cliente)
  const pix = pixKeys.find((k) => k.id === chavePix) || pixKeys[0]
  const nome = d?.nome.split(' ')[0] || ''
  const modelos = [
    ['Pedir Documento', msgDocumentos()],
    ['Comunicado Importante', `Olá ${nome}! Comunicado importante da AH Crédito: sua parcela vence dia ${d?.diaVencimento || '__'}. Evite atrasos e juros adicionais. Qualquer dúvida estamos à disposição.`],
    ['Enviar PIX pelo WhatsApp', `Olá ${nome}! Seguem os dados para pagamento por PIX:\nTitular: ${pix?.titular || '—'}\nBanco: ${pix?.banco || '—'}\nChave: ${pix?.chave || '—'}\nValor: ${brl(d?.valorParcela)}\nEnvie o comprovante após o pagamento. Obrigado! — AH Crédito`],
  ]
  return (
    <div className="grid g2">
      <div className="card">
        <h3>Chaves PIX da empresa</h3>
        <form className="form" onSubmit={(e) => { e.preventDefault(); addPix(p); setP({ titular: '', banco: '', chave: '' }) }}>
          <Field label="Titular"><input required value={p.titular} onChange={(e) => setP({ ...p, titular: e.target.value })} /></Field>
          <Field label="Banco"><BancoInput required value={p.banco} onChange={(v) => setP({ ...p, banco: v })} /></Field>
          <Field label="Chave PIX" full><input required value={p.chave} onChange={(e) => setP({ ...p, chave: e.target.value })} /></Field>
          <div className="full"><button className="btn primary">Adicionar chave</button></div>
        </form>
        {pixKeys.length === 0 && <div className="empty">Nenhuma chave cadastrada.</div>}
        {pixKeys.map((k) => (
          <div key={k.id} className="row between" style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
            <div><b>PIX {k.titular} — {k.banco}</b><div className="muted">{k.chave}</div></div>
            <div className="row">
              <button className="btn sm" onClick={() => navigator.clipboard?.writeText(k.chave)}>Copiar</button>
              <button className="btn sm red" onClick={() => deletePix(k.id)}>✕</button>
            </div>
          </div>
        ))}
      </div>
      <div className="card">
        <h3>Mensagens para clientes (WhatsApp)</h3>
        <div className="form">
          <Field label="Cliente">
            <select value={cliente} onChange={(e) => setCliente(e.target.value)}>
              <option value="">Selecione…</option>
              {debtors.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
            </select>
          </Field>
          <Field label="Chave PIX a enviar">
            <select value={chavePix} onChange={(e) => setChavePix(e.target.value)}>
              {pixKeys.map((k) => <option key={k.id} value={k.id}>PIX {k.titular} {k.banco}</option>)}
            </select>
          </Field>
        </div>
        <div style={{ marginTop: 12 }}>
          {modelos.map(([t, m]) => (
            <div key={t} className="row between" style={{ padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
              <b>{t}</b>
              {d?.telefone
                ? <ZapLinks tel={d.telefone} msg={m} label="Enviar no WhatsApp" />
                : <button className="btn sm" onClick={() => navigator.clipboard?.writeText(m)}>Copiar texto</button>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function LixeiraModal({ onClose }) {
  const { trashed, restoreDebtor, deleteDebtorForever } = useStore()
  return (
    <Modal title={`Lixeira (${trashed.length})`} onClose={onClose}>
      {trashed.length === 0 && <div className="empty">Lixeira vazia.</div>}
      {trashed.map((d) => (
        <div key={d.id} className="row between" style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
          <div><b>{d.nome}</b><div className="muted" style={{ fontSize: 12 }}>Removido em {fmtData(d.deletedAt)}</div></div>
          <div className="row">
            <button className="btn sm green" onClick={() => restoreDebtor(d.id)}>Restaurar</button>
            <button className="btn sm red" onClick={() => confirm('Excluir definitivamente?') && deleteDebtorForever(d.id)}>Excluir</button>
          </div>
        </div>
      ))}
    </Modal>
  )
}

export function RoboCobranca({ debtors, onClose }) {
  const { pixKeys, logs, addLog } = useStore()
  const [cfg, setCfg] = useLocalStorage('ahc:cobranca', CFG_PADRAO)
  const fila = useMemo(() => filaDeCobranca(debtors, logs, cfg, pixKeys), [debtors, logs, cfg, pixKeys])
  const pendentes = fila.filter((x) => !x.jaEnviado && !x.semTelefone)

  const registrar = (x) => addLog(x.d.id, `Cobrança enviada por WhatsApp (${rotuloEstagio(x.est)})`, 'cobranca')
  const set = (k) => (e) => setCfg({ ...cfg, [k]: k === 'pixId' ? e.target.value : +e.target.value })

  return (
    <Modal title="🤖 Robô de Cobrança" onClose={onClose} wide>
      <p className="muted" style={{ marginTop: -6 }}>
        O robô monta a fila de hoje sozinho (lembrete antes do vencimento, no dia e em atraso), com a mensagem pronta e a chave PIX.
        Cada envio fica registrado no histórico do cliente e ele sai da fila.
      </p>
      <div className="form" style={{ marginBottom: 12 }}>
        <Field label="Avisar quantos dias antes do vencimento"><input type="number" min="0" max="15" value={cfg.diasAntes} onChange={set('diasAntes')} /></Field>
        <Field label="Repetir cobrança de atrasados a cada (dias)"><input type="number" min="1" max="30" value={cfg.repetirAtraso} onChange={set('repetirAtraso')} /></Field>
        <Field label="Chave PIX nas mensagens">
          <select value={cfg.pixId} onChange={set('pixId')}>
            {pixKeys.length === 0 && <option value="">Nenhuma chave cadastrada</option>}
            {pixKeys.map((k) => <option key={k.id} value={k.id}>PIX {k.titular} — {k.banco}</option>)}
          </select>
        </Field>
      </div>
      <div className="row between" style={{ marginBottom: 8 }}>
        <b>Fila de hoje: {pendentes.length} para enviar · {fila.filter((x) => x.jaEnviado).length} já enviado(s)</b>
        {pendentes.length ? (
          <ZapLinks tel={pendentes[0].d.telefone} msg={pendentes[0].msg} primary small={false} onSend={() => registrar(pendentes[0])} label={`▶ Enviar próximo (${pendentes[0].d.nome.split(' ')[0]})`} />
        ) : <button className="btn primary" disabled>▶ Enviar próximo</button>}
      </div>
      {pixKeys.length === 0 && <div className="neg" style={{ marginBottom: 8 }}>Cadastre uma chave PIX em "Cadastro e Chaves PIX" para ela entrar nas mensagens.</div>}
      {fila.length === 0 && <div className="empty">Nada a cobrar hoje.</div>}
      {fila.map((x) => (
        <div key={x.d.id} className="row between" style={{ padding: '10px 0', borderBottom: '1px solid var(--line)', opacity: x.jaEnviado ? 0.55 : 1 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <b>{x.d.nome}</b> <StatusBadge status={statusDe(x.d)} />
            <div className="muted" style={{ fontSize: 12 }}>{rotuloEstagio(x.est)} · {brl(x.d.valorParcela)} · dia {x.d.diaVencimento}{x.ultimo ? ` · último envio ${fmtData(x.ultimo)}` : ''}</div>
            <details><summary className="muted" style={{ fontSize: 12, cursor: 'pointer' }}>Ver mensagem</summary><pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: '6px 0' }}>{x.msg}</pre></details>
          </div>
          {x.semTelefone ? <span className="neg">sem telefone</span>
            : x.jaEnviado ? <span className="pos">✔ enviado</span>
            : <ZapLinks tel={x.d.telefone} msg={x.msg} label="Enviar no WhatsApp" onSend={() => registrar(x)} />}
        </div>
      ))}
    </Modal>
  )
}

export function RoboCredito({ debtors, onClose }) {
  const { transactions, pixKeys, logs, trashed } = useStore()
  return (
    <Modal title="🤖 Robô de Crédito" onClose={onClose} wide>
      <Robo
        titulo="Consulta aos dados cadastrados (sem IA e sem custo)"
        sugestoes={['Resumo da carteira', 'Clientes atrasados', 'Clientes a cobrar', 'Vencimentos dos próximos 7 dias', 'Quanto foi recebido no mês', 'Lista de clientes', 'Chaves PIX']}
        responder={(q) => responder(q, { debtors, transactions, pixKeys, logs, trashed })}
      />
    </Modal>
  )
}
