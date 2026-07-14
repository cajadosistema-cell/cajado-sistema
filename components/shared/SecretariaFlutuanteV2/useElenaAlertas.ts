import { useState, useRef, useCallback, useEffect } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Msg } from './elena-types'

export function useElenaAlertas(supabase: any, userId: string, setMensagens: React.Dispatch<React.SetStateAction<Msg[]>>) {
  const [resumoFinanceiro, setResumoFinanceiro] = useState('')
  const alertasDisparadosRef = useRef<Set<string>>(new Set())
  const audioCtxRef = useRef<AudioContext | null>(null)

  const unlockAudioAndNotifications = useCallback(() => {
    if (!audioCtxRef.current) {
      try {
        const AudioCtor = window.AudioContext || (window as any).webkitAudioContext
        audioCtxRef.current = new AudioCtor()
      } catch (e) {}
    }
    if (audioCtxRef.current?.state === 'suspended') {
      audioCtxRef.current.resume()
    }
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  const tocarAlertaSonoro = useCallback((urgencia: 'alta' | 'media' | 'baixa') => {
    try {
      let ctx = audioCtxRef.current
      if (!ctx) {
        const AudioCtor = window.AudioContext || (window as any).webkitAudioContext
        ctx = new AudioCtor()
        audioCtxRef.current = ctx
      }
      if (ctx.state === 'suspended') ctx.resume()
      
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      
      if (urgencia === 'alta') {
        osc.frequency.setValueAtTime(1050, ctx.currentTime)
        osc.frequency.setValueAtTime(800, ctx.currentTime + 0.2)
        osc.frequency.setValueAtTime(1050, ctx.currentTime + 0.4)
      } else {
        osc.frequency.setValueAtTime(880, ctx.currentTime)
        osc.frequency.setValueAtTime(660, ctx.currentTime + 0.2)
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.4)
      }
      
      gain.gain.setValueAtTime(0.3, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.6)
    } catch {}
  }, [])

  const verificarAlertas = useCallback(async (uid: string) => {
    try {
      const agora = new Date()
      const em15 = new Date(agora.getTime() + 15 * 60 * 1000)
      const { data: eventos } = await supabase.from('agenda_eventos')
        .select('id, titulo, data_inicio, tipo')
        .eq('user_id', uid)
        .gte('data_inicio', agora.toISOString())
        .lte('data_inicio', em15.toISOString())
        .eq('status', 'pendente')

      if (!eventos || eventos.length === 0) return

      for (const ev of eventos) {
        // Chave com data ISO truncada (YYYY-MM-DDTHH:MM) — evita conflito entre
        // eventos em horas diferentes com mesmo minuto
        const chave = `${ev.id}-${new Date(ev.data_inicio).toISOString().substring(0, 16)}`
        if (alertasDisparadosRef.current.has(chave)) continue
        alertasDisparadosRef.current.add(chave)

        const diffMin = Math.round((new Date(ev.data_inicio).getTime() - agora.getTime()) / 60000)
        const corpo = diffMin <= 1 ? 'Agora!' : `Em ${diffMin} minuto(s)`

        tocarAlertaSonoro('alta')

        if (typeof Notification !== 'undefined') {
          if (Notification.permission === 'granted') {
            new Notification(`⏰ ${ev.titulo}`, { body: corpo, icon: '/favicon.ico', tag: ev.id })
          } else if (Notification.permission !== 'denied') {
            Notification.requestPermission().then(p => {
              if (p === 'granted') new Notification(`⏰ ${ev.titulo}`, { body: corpo, tag: ev.id })
            })
          }
        }

        setMensagens(prev => [...prev, {
          id: `alerta-${ev.id}-${Date.now()}`,
          role: 'ai',
          texto: `⏰ Lembrete: **${ev.titulo}** — ${corpo}`,
        }])
      }
    } catch {}
  }, [supabase, tocarAlertaSonoro, setMensagens])

  const verificarVencimentos = useCallback(async (uid: string) => {
    const hoje = new Date().toISOString().split('T')[0]
    try {
      const { data: perfil } = await supabase.from('elena_perfil')
        .select('ultima_vez_vencimentos').eq('user_id', uid).maybeSingle()
      if (perfil?.ultima_vez_vencimentos === hoje) return
    } catch {
      if (localStorage.getItem(`elena_venc_${hoje}`)) return
    }
    try {
      const agora = new Date()
      const em3dias = new Date(agora.getTime() + 3 * 24 * 60 * 60 * 1000)
      const { data: vencimentos } = await supabase.from('agenda_eventos')
        .select('id, titulo, data_inicio')
        .eq('user_id', uid).eq('tipo', 'vencimento')
        .gte('data_inicio', `${hoje}T00:00:00`)
        .lte('data_inicio', em3dias.toISOString())
        .neq('status', 'cancelado')
        .order('data_inicio', { ascending: true })
      
      if (!vencimentos?.length) return

      for (const v of vencimentos) {
        const dataVenc = new Date(v.data_inicio)
        const diffDias = Math.floor((dataVenc.getTime() - agora.getTime()) / (1000 * 60 * 60 * 24))
        const chaveV = `venc_${v.id}_${hoje}`
        if (localStorage.getItem(chaveV)) continue
        localStorage.setItem(chaveV, '1')
        const emoji = diffDias === 0 ? '🔴' : diffDias === 1 ? '🟠' : '🟡'
        const urgencia = diffDias === 0 ? '**HOJE!**' : diffDias === 1 ? '**amanhã**' : `em **${diffDias} dias**`
        
        tocarAlertaSonoro(diffDias === 0 ? 'alta' : diffDias === 1 ? 'media' : 'baixa')
        setMensagens(prev => [...prev, {
          id: `venc-${v.id}-${Date.now()}`,
          role: 'ai',
          texto: `${emoji} **Atenção:** ${v.titulo} — vence ${urgencia}!\nSr. Max, gostaria de anotar se esse pagamento já foi feito?`,
        }])
      }
      const { error: perfErr } = await supabase.from('elena_perfil').upsert(
        { user_id: uid, ultima_vez_vencimentos: hoje, ultima_atualizacao: new Date().toISOString() },
        { onConflict: 'user_id' }
      )
      if (perfErr) console.warn('[Elena] elena_perfil não salvou:', perfErr.message)
      try { localStorage.setItem(`elena_venc_${hoje}`, '1') } catch {}
    } catch {}
  }, [supabase, tocarAlertaSonoro, setMensagens])

  const gerarBriefingMatinal = useCallback(async (uid: string) => {
    const hoje = new Date().toISOString().split('T')[0]
    try {
      const { data: perfil } = await supabase.from('elena_perfil')
        .select('ultima_vez_briefing').eq('user_id', uid).maybeSingle()
      if (perfil?.ultima_vez_briefing === hoje) return
    } catch {
      if (localStorage.getItem(`elena_briefing_${hoje}`)) return
    }

    try {
      const agora = new Date()
      const em7dias = new Date(agora.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
      const diaSemana = agora.toLocaleDateString('pt-BR', { weekday: 'long' })
      const dataFormatada = agora.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })
      const hora = agora.getHours()
      const saudacao = hora < 12 ? '☀️ Bom dia' : hora < 18 ? '🌤️ Boa tarde' : '🌙 Boa noite'

      const [{ data: eventosHoje }, { data: vencimentos }, { data: gastos }, { data: receitas }] = await Promise.all([
        supabase.from('agenda_eventos').select('titulo, data_inicio, tipo').eq('user_id', uid).gte('data_inicio', `${hoje}T00:00:00`).lte('data_inicio', `${hoje}T23:59:59`).neq('status', 'cancelado').order('data_inicio', { ascending: true }),
        supabase.from('agenda_eventos').select('titulo, data_inicio').eq('user_id', uid).eq('tipo', 'vencimento').gte('data_inicio', agora.toISOString()).lte('data_inicio', em7dias).neq('status', 'cancelado').order('data_inicio', { ascending: true }),
        supabase.from('gastos_pessoais').select('valor').eq('user_id', uid).gte('data', hoje.substring(0, 7) + '-01'),
        supabase.from('receitas_pessoais').select('valor').eq('user_id', uid).gte('data', hoje.substring(0, 7) + '-01'),
      ])

      const linhas: string[] = [`${saudacao}, **Sr. Max!**`, `Hoje é ${diaSemana}, ${dataFormatada}.`, '']

      if (eventosHoje && eventosHoje.length > 0) {
        linhas.push('📅 **Agenda de hoje:**')
        eventosHoje.forEach((ev: any) => {
          const horario = new Date(ev.data_inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
          linhas.push(`• ${horario} — ${ev.titulo}`)
        })
      } else {
        linhas.push('📅 **Agenda:** Nenhum compromisso hoje. Dia livre! ✨')
      }

      if (vencimentos && vencimentos.length > 0) {
        linhas.push('', '💳 **Vencimentos esta semana:**')
        vencimentos.slice(0, 4).forEach((v: any) => {
          const dataVenc = new Date(v.data_inicio)
          const eHoje = dataVenc.toISOString().split('T')[0] === hoje
          const label = eHoje ? '⚠️ Hoje' : dataVenc.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })
          linhas.push(`• ${label} — ${v.titulo}`)
        })
      }

      const totalG = (gastos || []).reduce((s: number, g: any) => s + Number(g.valor), 0)
      const totalR = (receitas || []).reduce((s: number, r: any) => s + Number(r.valor), 0)
      if (totalG > 0 || totalR > 0) {
        linhas.push('', '💰 **Financeiro do mês:**', `• Gastos: R$ ${totalG.toFixed(2)}`, `• Receitas: R$ ${totalR.toFixed(2)}`)
        const saldo = totalR - totalG
        linhas.push(`• Saldo estimado: **R$ ${saldo.toFixed(2)}** ${saldo >= 0 ? '✅' : '⚠️'}`)
      }

      linhas.push('', 'Pronto para começar, Sr. Max! Como posso ajudar? 🚀')

      setMensagens(prev => [...prev, { id: `briefing-${Date.now()}`, role: 'ai', texto: linhas.join('\n') }])

      const { error: perfErr } = await supabase.from('elena_perfil').upsert(
        { user_id: uid, ultima_vez_briefing: hoje, ultima_atualizacao: new Date().toISOString() },
        { onConflict: 'user_id' }
      )
      if (perfErr) console.warn('[Elena] elena_perfil não salvou:', perfErr.message)
      try { localStorage.setItem(`elena_briefing_${hoje}`, '1') } catch {}
    } catch {}
  }, [supabase, setMensagens])

  useEffect(() => {
    if (!userId) return
    // Briefing matinal é gerado pelo useElenaSession — aqui só verifica vencimentos e alertas
    const tVenc = setTimeout(() => verificarVencimentos(userId), 3000)
    const tAlert = setInterval(() => verificarAlertas(userId), 60_000)

    return () => {
      clearTimeout(tVenc)
      clearInterval(tAlert)
    }
  }, [userId, verificarVencimentos, verificarAlertas])

  return {
    resumoFinanceiro, setResumoFinanceiro,
    unlockAudioAndNotifications,
    tocarAlertaSonoro
  }
}
