import { useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Hero } from '../components/ui'
import { CAPITULOS, GRUPOS } from './manualDados'

const corDe = (grupoId) => GRUPOS.find((g) => g.id === grupoId)?.cor || '#d4a437'

/** Mapa mental: o centro é o sistema, os ramos são as áreas e as folhas levam ao capítulo. */
function MapaMental() {
  const LARGURA = 1100, LINHA = 34, ALTURA_FOLHA = 26, FOLHA_L = 205
  const lado = (l) => GRUPOS.filter((g) => g.lado === l).map((g) => ({ ...g, folhas: CAPITULOS.filter((c) => c.grupo === g.id) }))
  const esq = lado('esq')
  const dir = lado('dir')
  const GAP = 18
  const alturaLado = (gs) => gs.reduce((s, g) => s + g.folhas.length * LINHA, 0) + (gs.length - 1) * GAP
  const ALTURA = Math.max(alturaLado(esq), alturaLado(dir)) + 60
  const cy = ALTURA / 2

  const montar = (gs, xFolha, xRamo) => {
    let y = (ALTURA - alturaLado(gs)) / 2
    return gs.map((g) => {
      const folhas = g.folhas.map((c, i) => ({ c, y: y + i * LINHA + LINHA / 2 }))
      const topo = y
      y += g.folhas.length * LINHA + GAP
      const meio = topo + (g.folhas.length * LINHA) / 2
      return { g, folhas, ramo: { x: xRamo, y: meio }, xFolha }
    })
  }
  const blocos = [...montar(esq, 20, 385), ...montar(dir, LARGURA - 20 - FOLHA_L, LARGURA - 385)]
  const curva = (x1, y1, x2, y2) => {
    const m = (x1 + x2) / 2
    return `M${x1} ${y1} C${m} ${y1}, ${m} ${y2}, ${x2} ${y2}`
  }

  return (
    <div className="mapa-mental" role="img" aria-label="Mapa mental do manual, com as áreas do sistema e os capítulos">
      <svg viewBox={`0 0 ${LARGURA} ${ALTURA}`} width="100%" style={{ minWidth: 820, display: 'block' }}>
        {blocos.map(({ g, folhas, ramo, xFolha }) => {
          const esquerda = g.lado === 'esq'
          const xRoot = esquerda ? LARGURA / 2 - 80 : LARGURA / 2 + 80
          const xRamoBorda = esquerda ? ramo.x + 65 : ramo.x - 65
          const xFolhaBorda = esquerda ? xFolha + FOLHA_L : xFolha
          return (
            <g key={g.id}>
              <path d={curva(xRoot, cy, esquerda ? ramo.x + 65 : ramo.x - 65, ramo.y)} stroke={g.cor} strokeWidth="3" fill="none" opacity=".85" />
              {folhas.map(({ c, y }) => (
                <path key={c.id} d={curva(esquerda ? ramo.x - 65 : ramo.x + 65, ramo.y, xFolhaBorda, y)} stroke={g.cor} strokeWidth="1.6" fill="none" opacity=".7" />
              ))}
              <rect x={ramo.x - 65} y={ramo.y - 18} width="130" height="36" rx="18" fill={g.cor} />
              <text x={ramo.x} y={ramo.y + 5} textAnchor="middle" fontSize="14" fontWeight="700" fill="#111">{g.titulo}</text>
              {folhas.map(({ c, y }) => (
                <a key={c.id} href={`#/manual?secao=${c.id}`} className="no-print">
                  <rect x={xFolha} y={y - ALTURA_FOLHA / 2} width={FOLHA_L} height={ALTURA_FOLHA} rx="13" fill="var(--panel2)" stroke={g.cor} strokeWidth="1.5" />
                  <text x={xFolha + FOLHA_L / 2} y={y + 4.5} textAnchor="middle" fontSize="13" fill="var(--text)">{c.curto}</text>
                </a>
              ))}
            </g>
          )
        })}
        <ellipse cx={LARGURA / 2} cy={cy} rx="90" ry="40" fill="var(--panel)" stroke="var(--gold)" strokeWidth="3" />
        <text x={LARGURA / 2} y={cy - 2} textAnchor="middle" fontSize="19" fontWeight="800" fill="var(--gold2)">AH Crédito</text>
        <text x={LARGURA / 2} y={cy + 17} textAnchor="middle" fontSize="11" fill="var(--muted)">Manual de utilização</text>
      </svg>
    </div>
  )
}

export default function Manual() {
  const [sp] = useSearchParams()
  const refs = useRef({})

  useEffect(() => {
    const s = sp.get('secao')
    const alvo = s && refs.current[s]
    if (alvo) alvo.scrollIntoView({ behavior: 'smooth', block: 'start' })
    else window.scrollTo({ top: 0 })
  }, [sp])
  const reg = (id) => (el) => { refs.current[id] = el }

  return (
    <div className="manual">
      <Hero title="Manual de Utilização" subtitle="Passo a passo com telas do sistema AH Crédito" />

      <div className="card no-print">
        <div className="row between">
          <div>
            <h3 style={{ marginBottom: 4 }}>Como usar este manual</h3>
            <div className="muted">Comece pelo mapa mental: clique em qualquer tópico para ir direto ao passo a passo. Os prints usam dados fictícios.</div>
          </div>
          <button className="btn" onClick={() => window.print()}>🖨 Imprimir / salvar em PDF</button>
        </div>
      </div>

      <section ref={reg('mapa')} className="card">
        <h3>Mapa mental</h3>
        <div className="muted" style={{ marginBottom: 8 }}>Cada cor é uma área do sistema. Clique em um tópico para abrir o capítulo.</div>
        <div style={{ overflowX: 'auto' }}><MapaMental /></div>
      </section>

      <section className="card">
        <h3>Índice</h3>
        <ol className="indice">
          {CAPITULOS.map((c, i) => (
            <li key={c.id}>
              <a href={`#/manual?secao=${c.id}`} style={{ '--cor': corDe(c.grupo) }}><span className="num">{i + 1}</span>{c.titulo}</a>
            </li>
          ))}
        </ol>
      </section>

      {CAPITULOS.map((c, i) => (
        <section key={c.id} ref={reg(c.id)} className="card capitulo" style={{ '--cor': corDe(c.grupo) }}>
          <div className="cap-tag">{GRUPOS.find((g) => g.id === c.grupo)?.titulo}</div>
          <h2><span className="num">{i + 1}</span>{c.titulo}</h2>
          <p className="muted" style={{ margin: '4px 0 10px' }}>{c.resumo}</p>
          <ol className="passos">
            {c.passos.map((p, j) => <li key={j}>{p}</li>)}
          </ol>
          {c.dica && <div className="dica"><b>Dica:</b> {c.dica}</div>}
          {c.imagens.map(([arq, legenda]) => (
            <figure key={arq}>
              <a href={`/manual/${arq}`} target="_blank" rel="noreferrer"><img src={`/manual/${arq}`} alt={legenda} loading="lazy" /></a>
              <figcaption>{legenda}</figcaption>
            </figure>
          ))}
          <a className="voltar no-print" href="#/manual?secao=mapa">↑ Voltar ao mapa mental</a>
        </section>
      ))}
    </div>
  )
}
