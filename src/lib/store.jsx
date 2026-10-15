import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { api } from './api'
import { hojeISO, mesAtual, uid } from './utils'

const Ctx = createContext(null)
export const useStore = () => useContext(Ctx)

/**
 * Lista sincronizada com o servidor (Postgres). A tela atualiza na hora; cada mudança
 * (item novo, alterado ou removido) é enviada ao servidor em seguida, na ordem.
 */
function useColecao(nome, inicial, enviar) {
  const [lista, setLista] = useState(inicial)
  const ref = useRef(inicial)
  const set = useCallback((fn) => {
    const antes = ref.current
    const depois = typeof fn === 'function' ? fn(antes) : fn
    ref.current = depois
    setLista(depois)
    enviar(nome, antes, depois)
  }, [nome, enviar])
  const substituir = useCallback((nova) => { ref.current = nova; setLista(nova) }, [])
  return [lista, set, substituir]
}

export function StoreProvider({ dados, onSessaoExpirada, children }) {
  const [erroSync, setErroSync] = useState('')
  const fila = useRef(Promise.resolve())
  const emVoo = useRef(0)

  const enviar = useCallback((colecao, antes, depois) => {
    const a = new Map(antes.map((x) => [x.id, x]))
    const d = new Map(depois.map((x) => [x.id, x]))
    const tarefas = []
    for (const [id, item] of d) {
      if (a.get(id) !== item && JSON.stringify(a.get(id)) !== JSON.stringify(item)) tarefas.push(() => api.put(`/c/${colecao}/${id}`, item))
    }
    for (const id of a.keys()) if (!d.has(id)) tarefas.push(() => api.del(`/c/${colecao}/${id}`))
    tarefas.forEach((t) => {
      emVoo.current++
      fila.current = fila.current
        .then(t)
        .then(() => setErroSync(''), (e) => {
          if (e.status === 401) onSessaoExpirada?.()
          else setErroSync('Não foi possível salvar no servidor. Verifique a conexão e tente de novo.')
        })
        .finally(() => { emVoo.current-- })
    })
  }, [onSessaoExpirada])

  const [transactions, setTransactions, substTransactions] = useColecao('transactions', dados.transactions, enviar)
  const [todosDebtors, setDebtors, substDebtors] = useColecao('debtors', dados.debtors, enviar)
  const [logs, setLogs, substLogs] = useColecao('logs', dados.logs, enviar)
  const [pixKeys, setPixKeys, substPix] = useColecao('pix', dados.pix, enviar)

  // Traz do servidor o que mudou fora desta tela (ex.: cliente que se cadastrou pelo link).
  const recarregar = useCallback(async () => {
    if (emVoo.current > 0) return
    try {
      const novo = await api.get('/data')
      if (emVoo.current > 0) return
      substTransactions(novo.transactions)
      substDebtors(novo.debtors)
      substLogs(novo.logs)
      substPix(novo.pix)
    } catch (e) {
      if (e.status === 401) onSessaoExpirada?.()
    }
  }, [substTransactions, substDebtors, substLogs, substPix, onSessaoExpirada])

  useEffect(() => {
    const id = setInterval(recarregar, 45000)
    const aoVoltar = () => document.visibilityState === 'visible' && recarregar()
    document.addEventListener('visibilitychange', aoVoltar)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', aoVoltar) }
  }, [recarregar])

  const addTransaction = (t) => setTransactions((l) => [{ ...t, id: uid() }, ...l])
  const updateTransaction = (id, t) => setTransactions((l) => l.map((x) => (x.id === id ? { ...x, ...t } : x)))
  const deleteTransaction = (id) => setTransactions((l) => l.filter((x) => x.id !== id))

  const patch = (id, p) => setDebtors((l) => l.map((x) => (x.id === id ? { ...x, ...p } : x)))
  const addDebtor = (d) => setDebtors((l) => [{ pagos: [], criadoEm: hojeISO(), ...d, id: d.id || uid() }, ...l])
  const updateDebtor = (id, d) => patch(id, d)
  const trashDebtor = (id) => patch(id, { deletedAt: hojeISO() })
  const restoreDebtor = (id) => patch(id, { deletedAt: null })
  const deleteDebtorForever = (id) => setDebtors((l) => l.filter((x) => x.id !== id))
  const setStatusOverride = (id, s) => patch(id, { statusOverride: s || null })

  const markPaid = (id) => {
    const d = todosDebtors.find((x) => x.id === id)
    if (!d) return
    const mes = mesAtual()
    patch(id, { pagos: [...new Set([...(d.pagos || []), mes])], statusOverride: null })
    addLog(id, `Pagamento de ${mes} registrado`, 'pagamento')
  }
  const unmarkPaid = (id) => {
    const d = todosDebtors.find((x) => x.id === id)
    if (!d) return
    patch(id, { pagos: (d.pagos || []).filter((m) => m !== mesAtual()) })
  }

  const addLog = (debtorId, texto, tipo = 'nota') =>
    setLogs((l) => [{ id: uid(), debtorId, texto, tipo, data: new Date().toISOString() }, ...l])
  const deleteLog = (id) => setLogs((l) => l.filter((x) => x.id !== id))

  const addPix = (p) => setPixKeys((l) => [...l, { ...p, id: uid() }])
  const deletePix = (id) => setPixKeys((l) => l.filter((x) => x.id !== id))

  const value = {
    transactions, addTransaction, updateTransaction, deleteTransaction,
    debtors: todosDebtors.filter((d) => !d.deletedAt),
    trashed: todosDebtors.filter((d) => d.deletedAt),
    addDebtor, updateDebtor, trashDebtor, restoreDebtor, deleteDebtorForever,
    setStatusOverride, markPaid, unmarkPaid,
    logs, addLog, deleteLog,
    pixKeys, addPix, deletePix,
    erroSync, recarregar,
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
