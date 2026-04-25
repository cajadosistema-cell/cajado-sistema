'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('E-mail ou senha inválidos.')
      setLoading(false)
      return
    }

    router.push('/inicio')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-sidebar flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="Cajado Soluções" className="h-16 w-auto mx-auto mb-4 object-contain drop-shadow-sm" />
          <h1 className="text-xl font-semibold text-fg">Sistema Cajado</h1>
          <p className="text-sm text-fg-tertiary mt-1">Acesse sua conta</p>
        </div>

        <form onSubmit={handleLogin} className="card space-y-4">
          <div>
            <label className="label block mb-1.5">E-mail</label>
            <input
              type="email"
              className="input"
              placeholder="seu@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="label block mb-1.5">Senha</label>
            <input
              type="password"
              className="input"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <p className="text-sm text-red-400 bg-red-500/10 px-3 py-2 rounded-lg">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full justify-center"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
          
          <div className="pt-4 mt-2 border-t border-border-subtle text-center">
            <a href="/cadastro" className="text-xs text-fg-tertiary hover:text-amber-400 transition-colors">
              + Cadastrar novo colaborador
            </a>
          </div>
        </form>
      </div>
    </div>
  )
}
