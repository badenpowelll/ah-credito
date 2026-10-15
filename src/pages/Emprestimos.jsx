import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Hero } from '../components/ui'
import GerarLink, { ImportarCadastro } from '../components/GerarLink'
import { CalendarioTab, LixeiraModal, MapaTab, PixTab, RoboCobranca, RoboCredito } from '../components/Abas'
import { ClientesTab, DebtorDetail, DebtorForm, ResumoCarteira } from '../components/Clientes'
import { useStore } from '../lib/store'
import { filaDeCobranca, CFG_PADRAO } from '../lib/cobranca'
import { baixarArquivo, statusDe, useLocalStorage } from '../lib/utils'

const ABAS = [
  ['devedores', '👥 Clientes'],
  ['calendario', '📅 Calendário'],
  ['mapa', '📍 Mapa'],
  ['informacoes', '🔑 Cadastro e Chaves PIX'],
]

export default function Emprestimos() {
  const { debtors, trashed, logs, pixKeys } = useStore()
  const [cfgCob] = useLocalStorage('ahc:cobranca', CFG_PADRAO)
  const aCobrarHoje = filaDeCobranca(debtors, logs, cfgCob, pixKeys).filter((x) => !x.jaEnviado && !x.semTelefone).length
  const [sp, setSp] = useSearchParams()
  const [aba, setAba] = useState('devedores')
  const [form, setForm] = useState(null) // null | {} | cliente
  const [detalhe, setDetalhe] = useState(null)
  const [modal, setModal] = useState(null) // 'lixeira' | 'cobranca' | 'credito'
  const [destaque, setDestaque] = useState(null)

  // Submenus da barra lateral: ?aba=...
  useEffect(() => {
    const a = sp.get('aba')
    if (!a) return
    if (ABAS.some(([id]) => id === a)) setAba(a)
    else if (a === 'novo') setForm({})
    else if (a === 'lixeira') setModal('lixeira')
    else if (a === 'link') setModal('link')
    else if (a === 'importar') setModal('importar')
    else if (a === 'cobranca') setModal('cobranca')
    else if (a === 'credito') setModal('credito')
    else if (a === 'pdf') baixarRelatorio()
  }, [sp]) // eslint-disable-line

  const limparParam = () => sp.has('aba') && setSp({}, { replace: true })

  function baixarRelatorio() {
    if (!debtors.length) return alert('Sem clientes para exportar')
    const linhas = [['Nome', 'Telefone', 'CPF', 'Endereço', 'Emprestado', 'Parcela', 'Juros %', 'Vencimento', 'Status']]
    debtors.forEach((d) => linhas.push([d.nome, d.telefone, d.cpf, `${d.endereco || ''} ${d.cidade || ''}`, d.valorEmprestado, d.valorParcela, d.jurosPct, d.diaVencimento, statusDe(d)]))
    baixarArquivo('ah-credito-clientes.csv', linhas.map((l) => l.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';')).join('\n'))
  }
  const imprimir = () => window.print()

  const fechar = (setter) => () => { setter(null); limparParam() }

  return (
    <>
      <Hero title="Empréstimos" subtitle="Gestão inteligente de crédito — AH Crédito" />
      {aCobrarHoje > 0 && (
        <div className="banner">
          <span>🤖 <b>{aCobrarHoje} cobrança(s)</b> pronta(s) para enviar hoje.</span>
          <button className="btn primary sm" onClick={() => setModal('cobranca')}>Abrir Robô de Cobrança</button>
        </div>
      )}
      <ResumoCarteira debtors={debtors} />

      <div className="row between">
        <h2 style={{ fontSize: 18 }}>Controle de Empréstimos</h2>
        <div className="row">
          <button className="btn primary" onClick={() => setForm({})}>＋ Novo Cliente</button>
          <button className="btn green" onClick={() => setModal('cobranca')}>🤖 Robô de Cobrança</button>
          <button className="btn" style={{ background: '#a87d12', color: '#fff' }} onClick={() => setModal('credito')}>🤖 Robô de Crédito</button>
          <button className="btn" onClick={() => setModal('link')}>🔗 Gerar Link de Cadastro</button>
          <button className="btn" onClick={() => setModal('importar')}>📥 Importar Cadastro</button>
          <button className="btn" onClick={() => setModal('lixeira')}>🗑 Lixeira{trashed.length ? ` (${trashed.length})` : ''}</button>
        </div>
      </div>

      <div className="row between">
        <div className="tabs">
          {ABAS.map(([id, label]) => (
            <button key={id} className={'tab' + (aba === id ? ' active' : '')} onClick={() => { setAba(id); limparParam() }}>{label}</button>
          ))}
        </div>
        <div className="row">
          <button className="btn sm" onClick={baixarRelatorio}>⬇ Baixar planilha</button>
          <button className="btn sm" onClick={imprimir}>🖨 PDF / Imprimir</button>
        </div>
      </div>

      {aba === 'devedores' && <ClientesTab debtors={debtors} onEdit={setForm} onOpen={setDetalhe} highlight={destaque} />}
      {aba === 'calendario' && <CalendarioTab debtors={debtors} onOpen={(d) => { setDetalhe(d) }} />}
      {aba === 'mapa' && <MapaTab debtors={debtors} onOpen={setDetalhe} />}
      {aba === 'informacoes' && <PixTab debtors={debtors} />}

      {form && <DebtorForm inicial={Object.keys(form).length ? form : null} onClose={fechar(setForm)} />}
      {detalhe && (
        <DebtorDetail
          debtor={debtors.find((d) => d.id === detalhe.id) || detalhe}
          onClose={() => setDetalhe(null)}
          onEdit={() => { setForm(detalhe); setDetalhe(null) }}
        />
      )}
      {modal === 'link' && <GerarLink onClose={fechar(setModal)} />}
      {modal === 'importar' && <ImportarCadastro onClose={fechar(setModal)} />}
      {modal === 'lixeira' && <LixeiraModal onClose={fechar(setModal)} />}
      {modal === 'cobranca' && <RoboCobranca debtors={debtors} onClose={fechar(setModal)} />}
      {modal === 'credito' && <RoboCredito debtors={debtors} onClose={fechar(setModal)} />}
    </>
  )
}
