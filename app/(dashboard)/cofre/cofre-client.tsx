'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/shared/ui'
import { useEmpresaId } from '@/lib/hooks/useEmpresaId'
import { cn } from '@/lib/utils'

// ── AES-256-GCM via WebCrypto ────────────────────────────────────
async function deriveKey(senha: string, salt: Uint8Array) {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(senha), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
  )
}

function b64(buf: ArrayBuffer) { return btoa(String.fromCharCode(...new Uint8Array(buf))) }
function unb64(s: string) { return Uint8Array.from(atob(s), c => c.charCodeAt(0)) }

async function cifrar(dados: object, senha: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv   = crypto.getRandomValues(new Uint8Array(12))
  const key  = await deriveKey(senha, salt)
  const enc  = new TextEncoder()
  const ct   = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(dados)))
  return JSON.stringify({ salt: b64(salt), iv: b64(iv), ct: b64(ct) })
}

async function decifrar(payload: string, senha: string): Promise<any> {
  const { salt, iv, ct } = JSON.parse(payload)
  const key = await deriveKey(senha, unb64(salt))
  const dec = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv) }, key, unb64(ct))
  return JSON.parse(new TextDecoder().decode(dec))
}

// ── Categorias ───────────────────────────────────────────────────
const CATS = [
  { id: 'banco',        label: 'Banco',        icon: '🏦' },
  { id: 'email',        label: 'E-mail',       icon: '📧' },
  { id: 'redes',        label: 'Redes Sociais', icon: '📱' },
  { id: 'sistema',      label: 'Sistema',      icon: '💻' },
  { id: 'cartao',       label: 'Cartão',       icon: '💳' },
  { id: 'governo',      label: 'Gov / Docs',   icon: '🏛️' },
  { id: 'outro',        label: 'Outro',        icon: '🔐' },
]

type Entrada = {
  id: string; titulo: string; categoria: string
  dados_cifrados: string; icone: string; favorito: boolean; created_at: string
}
type DadosDecifrados = { usuario?: string; senha?: string; url?: string; notas?: string }

// ── Modal Senha Mestra ───────────────────────────────────────────
function ModalSenhaMestra({ titulo, onConfirm, onClose }: {
  titulo: string; onConfirm: (s: string) => void; onClose: () => void
}) {
  const [s, setS] = useState('')
  const [erro, setErro] = useState('')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-page border border-border-subtle rounded-2xl w-full max-w-sm p-6 shadow-2xl">
        <div className="text-center mb-5">
          <span className="text-4xl">🔑</span>
          <h2 className="text-base font-semibold text-fg mt-2">{titulo}</h2>
          <p className="text-xs text-fg-tertiary mt-1">Senha mestra — nunca enviada ao servidor</p>
        </div>
        {erro && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mb-3">{erro}</p>}
        <input
          type="password" autoFocus className="input w-full mb-4" placeholder="Sua senha mestra..."
          value={s} onChange={e => setS(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && s.length >= 4) { setErro(''); onConfirm(s) } }}
        />
        <div className="flex gap-2">
          <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button
            onClick={() => { if (s.length < 4) { setErro('Mínimo 4 caracteres'); return } onConfirm(s) }}
            className="btn-primary flex-1"
          >Confirmar</button>
        </div>
      </div>
    </div>
  )
}

// ── Modal Nova / Editar Entrada ───────────────────────────────────
function ModalEntrada({ senhaMestra, onSave, onClose, editItem }: {
  senhaMestra: string; onSave: () => void; onClose: () => void; editItem?: Entrada | null
}) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [form, setForm] = useState({
    titulo: editItem?.titulo ?? '',
    categoria: editItem?.categoria ?? 'outro',
    icone: editItem?.icone ?? '🔐',
    usuario: '', senha: '', url: '', notas: '',
  })

  useEffect(() => {
    if (editItem) {
      decifrar(editItem.dados_cifrados, senhaMestra)
        .then(d => setForm(f => ({ ...f, usuario: d.usuario??'', senha: d.senha??'', url: d.url??'', notas: d.notas??'' })))
        .catch(() => setErro('Senha mestra incorreta para este item.'))
    }
  }, [])

  const cat = CATS.find(c => c.id === form.categoria)
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.titulo.trim()) { setErro('Título obrigatório'); return }
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: perfil } = await (supabase.from('perfis') as any).select('empresa_id').eq('id', user?.id).single()
      const dados_cifrados = await cifrar({ usuario: form.usuario, senha: form.senha, url: form.url, notas: form.notas }, senhaMestra)
      const payload = { titulo: form.titulo, categoria: form.categoria, icone: cat?.icon ?? '🔐', dados_cifrados, favorito: false, user_id: user?.id, empresa_id: perfil?.empresa_id }
      if (editItem) {
        await (supabase.from('cofre_senhas') as any).update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editItem.id)
      } else {
        await (supabase.from('cofre_senhas') as any).insert(payload)
      }
      onSave()
    } catch (e: any) { setErro(e.message) }
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-page border border-border-subtle rounded-2xl w-full max-w-md p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-fg">{editItem ? '✏️ Editar' : '🔐 Nova Senha'}</h2>
          <button onClick={onClose} className="text-fg-tertiary hover:text-fg text-xl">×</button>
        </div>
        {erro && <p className="text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2 mb-3">{erro}</p>}
        <div className="space-y-3">
          <div>
            <label className="label">Título *</label>
            <input className="input mt-1" value={form.titulo} onChange={e => set('titulo', e.target.value)} placeholder="Ex: Nubank, Gmail, Receita Federal..." />
          </div>
          <div>
            <label className="label">Categoria</label>
            <div className="grid grid-cols-4 gap-1.5 mt-1">
              {CATS.map(c => (
                <button key={c.id} type="button" onClick={() => set('categoria', c.id)}
                  className={cn('py-2 rounded-xl text-xs border transition-all text-center',
                    form.categoria === c.id ? 'bg-amber-500/15 border-amber-500/40 text-amber-300' : 'border-border-subtle text-fg-tertiary hover:border-border'
                  )}>
                  {c.icon}<br/><span className="text-[9px]">{c.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl space-y-3">
            <p className="text-[10px] text-emerald-400 font-semibold uppercase">🔒 Dados criptografados (AES-256)</p>
            <div>
              <label className="label">Usuário / E-mail</label>
              <input className="input mt-1" value={form.usuario} onChange={e => set('usuario', e.target.value)} placeholder="usuario@email.com" />
            </div>
            <div>
              <label className="label">Senha</label>
              <input className="input mt-1" type="password" value={form.senha} onChange={e => set('senha', e.target.value)} placeholder="••••••••" />
            </div>
            <div>
              <label className="label">URL / Site</label>
              <input className="input mt-1" value={form.url} onChange={e => set('url', e.target.value)} placeholder="https://..." />
            </div>
            <div>
              <label className="label">Notas</label>
              <textarea className="input mt-1 resize-none h-16 text-xs" value={form.notas} onChange={e => set('notas', e.target.value)} placeholder="Informações adicionais..." />
            </div>
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button onClick={handleSave} disabled={loading} className="btn-primary flex-1">
            {loading ? 'Cifrando...' : 'Salvar com Segurança 🔐'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Card de Entrada ───────────────────────────────────────────────
function CardEntrada({ item, senhaMestra, onEdit, onDelete }: {
  item: Entrada; senhaMestra: string; onEdit: () => void; onDelete: () => void
}) {
  const [revelado, setRevelado] = useState<DadosDecifrados | null>(null)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [senhaVis, setSenhaVis] = useState(false)

  const revelar = async () => {
    if (revelado) { setRevelado(null); return }
    setLoading(true)
    try { setRevelado(await decifrar(item.dados_cifrados, senhaMestra)) }
    catch { setErro('Senha mestra incorreta') }
    setLoading(false)
  }

  const copiar = (txt?: string) => { if (txt) { navigator.clipboard.writeText(txt) } }
  const cat = CATS.find(c => c.id === item.categoria)

  return (
    <div className="bg-page border border-border-subtle rounded-2xl p-4 hover:border-amber-500/30 transition-all group">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-xl">
            {item.icone}
          </div>
          <div>
            <p className="text-sm font-semibold text-fg">{item.titulo}</p>
            <p className="text-[10px] text-fg-tertiary">{cat?.icon} {cat?.label}</p>
          </div>
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={onEdit} className="text-blue-400 hover:text-blue-300 text-xs p-1.5 rounded-lg hover:bg-blue-500/10">✏️</button>
          <button onClick={onDelete} className="text-red-400 hover:text-red-300 text-xs p-1.5 rounded-lg hover:bg-red-500/10">🗑️</button>
        </div>
      </div>

      {erro && <p className="text-xs text-red-400 mb-2">{erro}</p>}

      {revelado ? (
        <div className="space-y-2 mb-3 p-3 bg-surface rounded-xl border border-border-subtle">
          {revelado.usuario && (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[9px] text-fg-disabled uppercase">Usuário</p>
                <p className="text-xs text-fg font-mono">{revelado.usuario}</p>
              </div>
              <button onClick={() => copiar(revelado.usuario)} className="text-[10px] text-fg-tertiary hover:text-fg px-2 py-1 rounded-lg hover:bg-muted">📋</button>
            </div>
          )}
          {revelado.senha && (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[9px] text-fg-disabled uppercase">Senha</p>
                <p className="text-xs text-fg font-mono">{senhaVis ? revelado.senha : '••••••••••'}</p>
              </div>
              <div className="flex gap-1">
                <button onClick={() => setSenhaVis(v => !v)} className="text-[10px] text-fg-tertiary hover:text-fg px-2 py-1 rounded-lg hover:bg-muted">{senhaVis ? '🙈' : '👁️'}</button>
                <button onClick={() => copiar(revelado.senha)} className="text-[10px] text-fg-tertiary hover:text-fg px-2 py-1 rounded-lg hover:bg-muted">📋</button>
              </div>
            </div>
          )}
          {revelado.url && (
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-[9px] text-fg-disabled uppercase">URL</p>
                <a href={revelado.url} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-blue-400 hover:underline truncate block max-w-[180px]">{revelado.url}</a>
              </div>
              <button onClick={() => copiar(revelado.url)} className="text-[10px] text-fg-tertiary hover:text-fg px-2 py-1 rounded-lg hover:bg-muted">📋</button>
            </div>
          )}
          {revelado.notas && (
            <div>
              <p className="text-[9px] text-fg-disabled uppercase">Notas</p>
              <p className="text-xs text-fg-secondary whitespace-pre-wrap">{revelado.notas}</p>
            </div>
          )}
        </div>
      ) : null}

      <button onClick={revelar} disabled={loading}
        className={cn('w-full py-1.5 rounded-xl text-[11px] font-semibold border transition-all',
          revelado
            ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20'
            : 'bg-muted border-border-subtle text-fg-tertiary hover:text-fg hover:border-border'
        )}>
        {loading ? '⏳ Decifrando...' : revelado ? '🔒 Ocultar dados' : '🔓 Revelar dados'}
      </button>
    </div>
  )
}

// ── Page principal ────────────────────────────────────────────────
export default function CofreClient() {
  const supabase = createClient()
  const { empresaId } = useEmpresaId()
  const [entradas, setEntradas] = useState<Entrada[]>([])
  const [loading, setLoading] = useState(true)
  const [senhaMestra, setSenhaMestra] = useState<string | null>(null)
  const [modalSenha, setModalSenha] = useState(false)
  const [pendingAction, setPendingAction] = useState<'abrir' | 'nova' | null>(null)
  const [modalEntrada, setModalEntrada] = useState(false)
  const [editItem, setEditItem] = useState<Entrada | null>(null)
  const [busca, setBusca] = useState('')
  const [catFiltro, setCatFiltro] = useState('')

  const load = async () => {
    if (!empresaId) return
    setLoading(true)
    const { data } = await (supabase.from('cofre_senhas') as any)
      .select('*').eq('empresa_id', empresaId).order('favorito', { ascending: false }).order('created_at', { ascending: false })
    setEntradas(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [empresaId])

  const pedirSenha = (acao: 'abrir' | 'nova') => {
    if (senhaMestra) { executarAcao(acao, senhaMestra); return }
    setPendingAction(acao)
    setModalSenha(true)
  }

  const executarAcao = (acao: string, s: string) => {
    setSenhaMestra(s)
    setModalSenha(false)
    if (acao === 'nova') { setEditItem(null); setModalEntrada(true) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir esta entrada permanentemente?')) return
    await (supabase.from('cofre_senhas') as any).delete().eq('id', id)
    load()
  }

  const filtradas = entradas.filter(e => {
    const okBusca = busca ? e.titulo.toLowerCase().includes(busca.toLowerCase()) : true
    const okCat = catFiltro ? e.categoria === catFiltro : true
    return okBusca && okCat
  })

  return (
    <div>
      <PageHeader title="🔐 Cofre de Senhas" subtitle="Criptografia AES-256 · Dados cifrados no seu dispositivo · Nunca expostos ao servidor">
        <button onClick={() => pedirSenha('nova')} className="btn-primary">+ Nova Senha</button>
      </PageHeader>

      {/* Banner de segurança */}
      <div className="mb-6 p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl flex items-start gap-3">
        <span className="text-2xl shrink-0">🛡️</span>
        <div>
          <p className="text-sm font-semibold text-emerald-400">Criptografia de ponta a ponta no seu dispositivo</p>
          <p className="text-xs text-fg-tertiary mt-0.5">
            Sua <strong className="text-fg-secondary">senha mestra</strong> nunca sai do seu dispositivo. 
            Os dados são cifrados com <strong className="text-fg-secondary">AES-256-GCM</strong> antes de serem enviados. 
            Nem o banco de dados nem a equipe técnica conseguem ler seus dados.
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {CATS.slice(0, 4).map(c => {
          const count = entradas.filter(e => e.categoria === c.id).length
          return (
            <button key={c.id} onClick={() => setCatFiltro(catFiltro === c.id ? '' : c.id)}
              className={cn('p-3 rounded-xl border text-left transition-all',
                catFiltro === c.id ? 'bg-amber-500/10 border-amber-500/30' : 'bg-page border-border-subtle hover:border-border'
              )}>
              <p className="text-xl mb-1">{c.icon}</p>
              <p className="text-xs text-fg-secondary font-medium">{c.label}</p>
              <p className="text-lg font-bold text-fg">{count}</p>
            </button>
          )
        })}
      </div>

      {/* Filtros */}
      {senhaMestra && (
        <div className="flex gap-2 mb-4">
          <input className="input text-xs flex-1" placeholder="🔍 Buscar por título..."
            value={busca} onChange={e => setBusca(e.target.value)} />
          <select className="input text-xs w-36" value={catFiltro} onChange={e => setCatFiltro(e.target.value)}>
            <option value="">Todas</option>
            {CATS.map(c => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
          </select>
        </div>
      )}

      {/* Estado: sem senha mestra */}
      {!senhaMestra && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <span className="text-6xl mb-4">🔑</span>
          <h3 className="text-lg font-semibold text-fg mb-2">Cofre Bloqueado</h3>
          <p className="text-sm text-fg-tertiary mb-6 max-w-sm">
            Digite sua senha mestra para acessar o cofre. 
            Esta senha só existe no seu dispositivo.
          </p>
          <button onClick={() => pedirSenha('abrir')} className="btn-primary px-8">🔓 Desbloquear Cofre</button>
        </div>
      )}

      {/* Grid de entradas */}
      {senhaMestra && (
        loading ? (
          <div className="text-center py-16 text-fg-tertiary text-sm">⏳ Carregando...</div>
        ) : filtradas.length === 0 ? (
          <div className="text-center py-16">
            <span className="text-5xl">🔐</span>
            <p className="text-sm text-fg-tertiary mt-3">{busca || catFiltro ? 'Nenhuma entrada encontrada.' : 'Nenhuma senha salva ainda.'}</p>
            {!busca && !catFiltro && (
              <button onClick={() => pedirSenha('nova')} className="btn-primary mt-4">+ Adicionar primeira senha</button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtradas.map(e => (
              <CardEntrada key={e.id} item={e} senhaMestra={senhaMestra}
                onEdit={() => { setEditItem(e); setModalEntrada(true) }}
                onDelete={() => handleDelete(e.id)}
              />
            ))}
          </div>
        )
      )}

      {/* Modais */}
      {modalSenha && (
        <ModalSenhaMestra
          titulo={pendingAction === 'nova' ? 'Senha Mestra para Cifrar' : 'Desbloquear Cofre'}
          onConfirm={s => executarAcao(pendingAction ?? 'abrir', s)}
          onClose={() => setModalSenha(false)}
        />
      )}
      {modalEntrada && senhaMestra && (
        <ModalEntrada
          senhaMestra={senhaMestra}
          editItem={editItem}
          onSave={() => { setModalEntrada(false); load() }}
          onClose={() => setModalEntrada(false)}
        />
      )}
    </div>
  )
}
