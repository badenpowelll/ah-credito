import { useEffect, useState } from 'react'

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
export const brl = (v) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
export const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const p2 = (n) => String(n).padStart(2, '0')
export const hojeISO = (d = new Date()) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`
export const mesAtual = (d = new Date()) => hojeISO(d).slice(0, 7)
export const fmtData = (iso) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '')
export const soDigitos = (s) => String(s || '').replace(/\D/g, '')

export function useLocalStorage(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw ? JSON.parse(raw) : initial
    } catch {
      return initial
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      /* armazenamento indisponível */
    }
  }, [key, value])
  return [value, setValue]
}

/** Status do cliente no mês corrente: pago | atrasado | a_cobrar */
export function statusDe(d, ref = new Date()) {
  if (d.statusOverride) return d.statusOverride
  const mes = mesAtual(ref)
  if ((d.pagos || []).includes(mes)) return 'pago'
  return ref.getDate() > Number(d.diaVencimento || 1) ? 'atrasado' : 'a_cobrar'
}

export const STATUS_LABEL = { pago: 'PAGO', atrasado: 'ATRASADO', a_cobrar: 'A COBRAR' }

export function whatsLink(tel, msg) {
  const n = soDigitos(tel)
  const full = n.length <= 11 ? '55' + n : n
  return `https://wa.me/${full}?text=${encodeURIComponent(msg)}`
}

export const formataCep = (v) => {
  const d = soDigitos(v).slice(0, 8)
  return d.length > 5 ? d.slice(0, 5) + '-' + d.slice(5) : d
}

const comTimeout = (url, ms = 6000, opts) => {
  const c = new AbortController()
  const t = setTimeout(() => c.abort(), ms)
  return fetch(url, { ...opts, signal: c.signal }).finally(() => clearTimeout(t))
}

/** Busca o endereço pelo CEP na BrasilAPI (v2, traz coordenadas), com ViaCEP como reserva. Retorna null se não achar. */
export async function buscaCep(cep) {
  const c = soDigitos(cep)
  if (c.length !== 8) return null
  try {
    const r = await (await comTimeout(`https://brasilapi.com.br/api/cep/v2/${c}`)).json()
    if (r.city) {
      const co = r.location?.coordinates
      return {
        endereco: [r.street, r.neighborhood].filter(Boolean).join(', '),
        cidade: `${r.city}/${r.state}`,
        cidadeNome: r.city, uf: r.state, bairro: r.neighborhood, logradouro: r.street,
        lat: co?.latitude ? +co.latitude : undefined, lng: co?.longitude ? +co.longitude : undefined,
      }
    }
  } catch { /* tenta a reserva */ }
  try {
    const r = await (await comTimeout(`https://viacep.com.br/ws/${c}/json/`)).json()
    if (!r.erro) {
      return {
        endereco: [r.logradouro, r.bairro].filter(Boolean).join(', '),
        cidade: `${r.localidade}/${r.uf}`,
        cidadeNome: r.localidade, uf: r.uf, bairro: r.bairro, logradouro: r.logradouro,
      }
    }
  } catch { /* sem resultado */ }
  return null
}

export async function geocode(q) {
  try {
    const r = await (await comTimeout(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=br`, 8000, { headers: { 'Accept-Language': 'pt-BR' } })).json()
    return r.length ? { lat: parseFloat(r[0].lat), lng: parseFloat(r[0].lon) } : null
  } catch {
    return null
  }
}

/** Localiza o endereço do cliente: rua+número, depois coordenadas do CEP, depois a cidade. */
export async function localizarCliente(d) {
  const cidade = d.cidade || ''
  const rua = [d.endereco, d.numero].filter(Boolean).join(' ')
  let g = rua ? await geocode(`${rua}, ${cidade}, Brasil`) : null
  if (g) return g
  const cep = await buscaCep(d.cep)
  if (cep?.lat) return { lat: cep.lat, lng: cep.lng }
  g = await geocode(`${soDigitos(d.cep)}, Brasil`)
  if (g) return g
  return cidade ? await geocode(`${cidade}, Brasil`) : null
}

export function baixarArquivo(nome, conteudo, tipo = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob(['﻿' + conteudo], { type: tipo }))
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  a.click()
  URL.revokeObjectURL(url)
}
