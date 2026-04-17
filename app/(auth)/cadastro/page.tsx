'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function CadastroPage() {
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          nome_completo: nome
        }
      }
    })

    if (signUpError) {
      setError(signUpError.message || 'Erro ao tentar registrar colaborador.')
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)
    
    // Pequeno delay para o chefão ver que deu certo antes de empurrar pro início
    setTimeout(() => {
      router.push('/inicio')
      router.refresh()
    }, 2500)
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center mx-auto mb-4 scale-95 hover:scale-100 transition-transform">
            <span className="text-zinc-950 font-bold text-xl">+</span>
          </div>
          <h1 className="text-xl font-semibold text-zinc-100">Criar Acesso (Equipe)</h1>
          <p className="text-sm text-zinc-500 mt-1">Crie senhas para a sua Equipe</p>
        </div>

        {success ? (
          <div className="card space-y-4 text-center py-8">
            <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-2">
              ✓
            </div>
            <h3 className="text-emerald-400 font-bold">Colaborador Criado!</h3>
            <p className="text-sm text-zinc-400">Autenticação gerada com sucesso. Redirecionando para o sistema...</p>
          </div>
        ) : (
          <form onSubmit={handleRegister} className="card space-y-4">
            <div>
              <label className="label block mb-1.5">Nome do Colaborador</label>
              <input
                type="text"
                className="input"
                placeholder="Ex: Ana Atendimento"
                value={nome}
                onChange={e => setNome(e.target.value)}
                required
              />
            </div>
            
            <div>
              <label className="label block mb-1.5">E-mail corporativo</label>
              <input
                type="email"
                className="input"
                placeholder="ana@cajado.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="label block mb-1.5">Senha Provisória</label>
              <input
                type="password"
                className="input"
                placeholder="mínimo 6 caracteres"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>

            {error && (
              <p className="text-sm text-red-400 bg-red-500/10 px-3 py-2 rounded-lg border border-red-500/20">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center mt-2 bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              {loading ? 'Gerando Acesso...' : 'Registrar Funcionário'}
            </button>
            
            <div className="pt-3 border-t border-zinc-800 text-center">
              <Link href="/login" className="text-xs text-zinc-500 hover:text-zinc-300">
                Voltar para o Login
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
