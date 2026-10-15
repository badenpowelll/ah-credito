import { createContext, useContext } from 'react'
import { hojeISO, mesAtual, uid, useLocalStorage } from './utils'

const Ctx = createContext(null)
export const useStore = () => useContext(Ctx)

/** Estado 100% local (localStorage). Sem banco de dados. */
export function StoreProvider({ children }) {
  const [transactions, setTransactions] = useLocalStorage('ahc:transactions', [])
  const [debtors, setDebtors] = useLocalStorage('ahc:debtors', [])
  const [logs, setLogs] = useLocalStorage('ahc:logs', [])
  const [pixKeys, setPixKeys] = useLocalStorage('ahc:pix', [])

  const addTransaction = (t) => setTransactions((l) => [{ ...t, id: uid() }, ...l])
  const updateTransaction = (id, t) => setTransactions((l) => l.map((x) => (x.id === id ? { ...x, ...t } : x)))
  const deleteTransaction = (id) => setTransactions((l) => l.filter((x) => x.id !== id))

  const patch = (id, p) => setDebtors((l) => l.map((x) => (x.id === id ? { ...x, ...p } : x)))
  const addDebtor = (d) => setDebtors((l) => [{ pagos: [], criadoEm: hojeISO(), ...d, id: uid() }, ...l])
  const updateDebtor = (id, d) => patch(id, d)
  const trashDebtor = (id) => patch(id, { deletedAt: hojeISO() })
  const restoreDebtor = (id) => patch(id, { deletedAt: null })
  const deleteDebtorForever = (id) => setDebtors((l) => l.filter((x) => x.id !== id))
  const setStatusOverride = (id, s) => patch(id, { statusOverride: s || null })

  const markPaid = (id) => {
    const d = debtors.find((x) => x.id === id)
    if (!d) return
    const mes = mesAtual()
    patch(id, { pagos: [...new Set([...(d.pagos || []), mes])], statusOverride: null })
    addLog(id, `Pagamento de ${mes} registrado`, 'pagamento')
  }
  const unmarkPaid = (id) => {
    const d = debtors.find((x) => x.id === id)
    if (!d) return
    patch(id, { pagos: (d.pagos || []).filter((m) => m !== mesAtual()) })
  }

  const addLog = (debtorId, texto, tipo = 'nota') =>
    setLogs((l) => [{ id: uid(), debtorId, texto, tipo, data: new Date().toISOString() }, ...l])
  const deleteLog = (id) => setLogs((l) => l.filter((x) => x.id !== id))

  const addPix = (p) => setPixKeys((l) => [...l, { ...p, id: uid() }])
  const deletePix = (id) => setPixKeys((l) => l.filter((x) => x.id !== id))

  const resetAll = () => {
    setTransactions([])
    setDebtors([])
    setLogs([])
    setPixKeys([])
  }

  const value = {
    transactions, addTransaction, updateTransaction, deleteTransaction,
    debtors: debtors.filter((d) => !d.deletedAt),
    trashed: debtors.filter((d) => d.deletedAt),
    addDebtor, updateDebtor, trashDebtor, restoreDebtor, deleteDebtorForever,
    setStatusOverride, markPaid, unmarkPaid,
    logs, addLog, deleteLog,
    pixKeys, addPix, deletePix, resetAll,
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
