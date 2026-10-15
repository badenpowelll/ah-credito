import { useCallback, useEffect, useRef, useState } from 'react'
import { api, enviarArquivo, urlDocumento } from '../lib/api'
import { prepararArquivos } from '../lib/arquivos'
import { fmtBytes, fmtData } from '../lib/utils'

/** Documentos de um cliente guardados no banco. */
export function useDocumentos(clienteId) {
  const [docs, setDocs] = useState([])
  const [carregando, setCarregando] = useState(Boolean(clienteId))
  const [erro, setErro] = useState('')

  const recarregar = useCallback(async () => {
    if (!clienteId) { setDocs([]); setCarregando(false); return }
    try {
      setDocs(await api.get(`/clientes/${encodeURIComponent(clienteId)}/documentos`))
      setErro('')
    } catch (e) {
      setErro(e.message)
    }
    setCarregando(false)
  }, [clienteId])

  useEffect(() => { recarregar() }, [recarregar])

  const remover = async (id) => {
    try {
      await api.del(`/documentos/${encodeURIComponent(id)}`)
      setDocs((l) => l.filter((d) => d.id !== id))
    } catch (e) {
      setErro(e.message)
    }
  }
  return { docs, carregando, erro, recarregar, remover }
}

/** Envia vários arquivos, um por vez. Devolve os que falharam: [{ arquivo, motivo }]. */
export async function enviarVarios(clienteId, arquivos, aoProgredir) {
  const falhas = []
  for (let i = 0; i < arquivos.length; i++) {
    aoProgredir?.(i + 1, arquivos.length, arquivos[i].name)
    try { await enviarArquivo(clienteId, arquivos[i]) } catch (e) { falhas.push({ arquivo: arquivos[i], motivo: e.message }) }
  }
  return falhas
}

const icone = (tipo, nome) => {
  const n = nome.toLowerCase()
  if (tipo.startsWith('image/')) return '🖼️'
  if (tipo === 'application/pdf' || n.endsWith('.pdf')) return '📕'
  if (/\.(docx?|odt|rtf)$/.test(n)) return '📘'
  if (/\.(xlsx?|csv|ods)$/.test(n)) return '📗'
  return '📎'
}

export function ListaDocs({ docs, onRemover, vazio = 'Nenhum documento anexado.' }) {
  const [confirmando, setConfirmando] = useState(null)
  if (!docs.length) return <div className="muted" style={{ padding: '6px 0' }}>{vazio}</div>
  return (
    <div className="docs">
      {docs.map((d) => {
        const visualizavel = /^(image\/(jpeg|png|gif|webp)|application\/pdf)$/.test(d.tipo)
        return (
          <div key={d.id} className="doc">
            {d.tipo.startsWith('image/') && visualizavel
              ? <a href={urlDocumento(d.id, true)} target="_blank" rel="noreferrer"><img className="doc-mini" src={urlDocumento(d.id, true)} alt={d.nome} loading="lazy" /></a>
              : <span className="doc-ico">{icone(d.tipo, d.nome)}</span>}
            <div className="doc-info">
              <b title={d.nome}>{d.nome}</b>
              <small className="muted">{fmtBytes(d.tamanho)} · {fmtData(d.criadoEm)}</small>
            </div>
            <div className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
              {visualizavel && <a className="btn sm" href={urlDocumento(d.id, true)} target="_blank" rel="noreferrer">Ver</a>}
              <a className="btn sm" href={urlDocumento(d.id)} download={d.nome}>Baixar</a>
              {onRemover && (confirmando === d.id
                ? <>
                    <button type="button" className="btn sm red" onClick={() => { onRemover(d.id); setConfirmando(null) }}>Confirmar</button>
                    <button type="button" className="btn sm" onClick={() => setConfirmando(null)}>Não</button>
                  </>
                : <button type="button" className="btn sm" onClick={() => setConfirmando(d.id)} aria-label={`Excluir ${d.nome}`}>Excluir</button>)}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** Escolha de arquivos para anexar (ficam na lista até quem chamou enviar). */
export function SeletorArquivos({ arquivos, setArquivos, rotulo = '📎 Anexar documentos' }) {
  const [avisos, setAvisos] = useState([])
  const [lendo, setLendo] = useState(false)
  const input = useRef(null)

  const escolher = async (e) => {
    const lista = e.target.files
    if (!lista?.length) return
    setLendo(true)
    const { aceitos, recusados } = await prepararArquivos(lista)
    setArquivos((a) => [...a, ...aceitos])
    setAvisos(recusados)
    setLendo(false)
    if (input.current) input.current.value = ''
  }

  return (
    <div>
      <div className="row">
        <label className="btn" style={{ cursor: 'pointer' }}>
          {lendo ? 'Preparando…' : rotulo}
          <input ref={input} type="file" multiple onChange={escolher} style={{ display: 'none' }} aria-label="Escolher documentos" />
        </label>
        <span className="muted" style={{ fontSize: 12 }}>PDF, Word, fotos e outros · até 10 MB cada</span>
      </div>
      {avisos.length > 0 && <div className="neg" style={{ fontSize: 12, marginTop: 4 }}>Não anexado: {avisos.join(' · ')}</div>}
      {arquivos.length > 0 && (
        <div className="docs" style={{ marginTop: 8 }}>
          {arquivos.map((f, i) => (
            <div key={f.name + i} className="doc">
              <span className="doc-ico">{icone(f.type || '', f.name)}</span>
              <div className="doc-info"><b title={f.name}>{f.name}</b><small className="muted">{fmtBytes(f.size)} · será enviado ao salvar</small></div>
              <button type="button" className="btn sm" onClick={() => setArquivos((a) => a.filter((_, j) => j !== i))}>Remover</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/** Painel completo (ficha do cliente): lista + anexar na hora. */
export function Documentos({ clienteId }) {
  const { docs, carregando, erro, recarregar, remover } = useDocumentos(clienteId)
  const [novos, setNovos] = useState([])
  const [enviando, setEnviando] = useState('')
  const [falhas, setFalhas] = useState([])

  const enviar = async () => {
    setFalhas([])
    const lista = novos
    const f = await enviarVarios(clienteId, lista, (i, n, nome) => setEnviando(`Enviando ${i} de ${n}: ${nome}`))
    setEnviando('')
    setNovos(f.map((x) => x.arquivo))
    setFalhas(f)
    recarregar()
  }

  return (
    <div>
      {carregando ? <div className="muted">Carregando documentos…</div> : <ListaDocs docs={docs} onRemover={remover} />}
      {erro && <div className="neg" style={{ fontSize: 12 }}>{erro}</div>}
      <div style={{ marginTop: 10 }}>
        <SeletorArquivos arquivos={novos} setArquivos={setNovos} />
        {novos.length > 0 && (
          <div className="row" style={{ marginTop: 8 }}>
            <button type="button" className="btn primary sm" disabled={Boolean(enviando)} onClick={enviar}>Enviar {novos.length} arquivo(s)</button>
            {enviando && <span className="muted">{enviando}</span>}
          </div>
        )}
        {falhas.map((f) => <div key={f.arquivo.name} className="neg" style={{ fontSize: 12 }}>{f.arquivo.name}: {f.motivo}</div>)}
      </div>
    </div>
  )
}
