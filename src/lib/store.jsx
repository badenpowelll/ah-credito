import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { api } from './api'
import { movimentosDeEmprestimos } from './movimentos'
import { hojeISO, mesAtual, uid, useLocalStorage } from './utils'

const Ctx = createContext(null)

const dorme = (ms) => new Promise((r) => setTimeout(r, ms))
/** Tenta de novo (1s, 2s, 3s) quando a falha é de rede ou do servidor; erros de validação e sessão não repetem. */
async function comRetentativa(tarefa, tentativas = 4) {
  for (let i = 1; ; i++) {
    try {
      return await tarefa()
    } catch (e) {
      const definitivo = e.status === 401 || (e.status >= 400 && e.status < 500 && e.status !== 429)
      if (definitivo || i >= tentativas) throw e
      await dorme(1000 * i)
    }
  }
}
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

export function StoreProvider({ dados, usuario, onSessaoExpirada, children }) {
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
        .then(() => comRetentativa(t))
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

  // Fluxo de caixa = lançamentos manuais + (opcional) movimentos gerados pelos empréstimos.
  const [incluirEmprestimos, setIncluirEmprestimos] = useLocalStorage('ahc:fluxo-emprestimos', true)
  const movimentos = useMemo(
    () => (incluirEmprestimos ? [...transactions, ...movimentosDeEmprestimos(todosDebtors.filter((d) => !d.deletedAt), logs)] : transactions),
    [incluirEmprestimos, transactions, todosDebtors, logs],
  )

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

  const markPaid = (id, mes = mesAtual()) => {
    const d = todosDebtors.find((x) => x.id === id)
    if (!d) return
    patch(id, { pagos: [...new Set([...(d.pagos || []), mes])], statusOverride: null })
    addLog(id, `Pagamento de ${mes} registrado`, 'pagamento')
  }
  const unmarkPaid = (id, mes = mesAtual()) => {
    const d = todosDebtors.find((x) => x.id === id)
    if (!d) return
    patch(id, { pagos: (d.pagos || []).filter((m) => m !== mes) })
    addLog(id, `Pagamento de ${mes} desfeito`, 'nota')
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
    usuario, movimentos, incluirEmprestimos, setIncluirEmprestimos,
    erroSync, recarregar,
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
