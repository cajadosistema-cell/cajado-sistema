// src/routes/waba.routes.js
//
// Endpoint que processa o retorno do Embedded Signup (botão "Continuar
// com o Facebook" na tela de Configurações do Inbox) para conectar a
// API Oficial do WhatsApp (Cloud API) via Meta, de forma automática.
//
// Antes desse arquivo, só existia a conexão MANUAL (/canais/configurar-oficial,
// onde o admin cola phoneNumberId/accessToken já prontos). Esta rota faz o
// equivalente só que automaticamente, a partir do "code" (ou access_token)
// devolvido pelo popup de login do Facebook (fluxo FB.login com config_id —
// Embedded Signup de verdade, não OAuth por redirect).
//
// IMPORTANTE — coisas que quem for revisar/mergear precisa checar:
// 1) O corpo enviado pelo frontend (função conectarEmbedded em
//    app/dashboard/configuracoes/_components/bot-client.tsx) é:
//      { code } OU { access_token }, e opcionalmente { waba_id, phone_number_id }
//    Não exige autenticação obrigatória — o token do usuário (JWT do
//    localStorage "cajado_inbox_token") é opcional aqui: se vier, usamos pra
//    saber a empresa_id; se não vier, salvamos sem empresa_id (mesmo padrão
//    já usado no waba.routes.js do Inbox VisioPro, que já está em produção).
// 2) Variáveis de ambiente necessárias no Railway do serviço cajado-sistema:
//      WABA_APP_ID     -> ID do app "Botvisio" na Meta (887363490968366)
//      WABA_APP_SECRET -> App Secret do mesmo app
//    (pode reaproveitar as mesmas usadas no Inbox VisioPro, já que é o
//    mesmo app Meta "Botvisio" sendo usado nos dois produtos)
// 3) Este arquivo grava a conexão na tabela `canais` do PRÓPRIO banco do
//    Sistema Cajado (mesmo padrão do /configurar-oficial já existente) —
//    não faz proxy para o banco separado do Inbox VisioPro.
// 4) Este router é montado em index.js como:
//      app.use("/api/inbox-proxy/api/waba", require("./src/routes/waba.routes"));
//    com o caminho COMPLETO (sem tirar o prefixo "inbox-proxy") — porque o
//    domínio sistema.cajadosolucoes.com.br é servido diretamente por este
//    mesmo Express (confirmado nas configs de rede do Railway), então a
//    chamada relativa do frontend chega aqui sem nenhum proxy no meio.

const express = require("express");
const router = express.Router();
const axios = require("axios");
const jwt = require("jsonwebtoken");

const { supabase } = require("../config/database");
const { canaisMemoria } = require("../config/memory");
const { JWT_SECRET } = require("../config/env");

const APP_ID = process.env.WABA_APP_ID || process.env.META_APP_ID || "887363490968366";
const APP_SECRET = process.env.WABA_APP_SECRET || process.env.META_APP_SECRET;
const GRAPH_VERSION = process.env.WABA_GRAPH_VERSION || "v22.0";

// Candidatos de redirect_uri a tentar na troca do code por token. O fluxo de
// Embedded Signup via config_id (FB.login) normalmente NÃO precisa de
// redirect_uri — por isso `null` (sem parâmetro) vem primeiro na lista,
// como recomenda a documentação oficial da Meta.
const REDIRECT_URI_CANDIDATES = [
  null,
  process.env.WABA_REDIRECT_URI,
  "https://sistema.cajadosolucoes.com.br/inbox",
  "https://sistema.cajadosolucoes.com.br/configuracoes",
].filter((v, i) => i === 0 || Boolean(v));

// Helper: extrai empresa_id do JWT (se presente no header Authorization).
// Não é obrigatório — se não vier ou for inválido, seguimos sem travar o fluxo.
function getEmpresaFromAuth(req) {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token || token === "null" || token === "undefined") return null;
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded?.empresa_id || null;
  } catch {
    return null;
  }
}

// ─── GET /api/inbox-proxy/api/waba/config — dados públicos para o frontend ──
router.get("/config", (req, res) => {
  res.json({
    app_id: APP_ID,
    configured: !!APP_SECRET,
  });
});

// ─── POST /api/inbox-proxy/api/waba/connect ─────────────────────────────────
router.post("/connect", async (req, res) => {
  if (!APP_SECRET) {
    return res.status(500).json({
      erro: "WABA_APP_SECRET não configurado no servidor. Configure essa variável no Railway (cajado-sistema)."
    });
  }

  const { code, access_token, waba_id, phone_number_id, redirect_uri } = req.body || {};
  if (!code && !access_token) {
    return res.status(400).json({ erro: "'code' ou 'access_token' obrigatório (retornado pelo login do Facebook)." });
  }

  const empresaId = getEmpresaFromAuth(req) || req.body?.empresa_id || null;

  try {
    // ── 1. Obtém um token de usuário ──────────────────────────────────────
    let userToken = null;

    if (code) {
      const redirectCandidates = redirect_uri
        ? [redirect_uri, ...REDIRECT_URI_CANDIDATES]
        : REDIRECT_URI_CANDIDATES;
      let ultimoErro = null;

      for (const uri of redirectCandidates) {
        try {
          const params = { client_id: APP_ID, client_secret: APP_SECRET, code };
          if (uri) params.redirect_uri = uri;
          const tokenRes = await axios.get(`https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`, {
            params,
            timeout: 15000,
          });
          if (tokenRes.data?.access_token) {
            userToken = tokenRes.data.access_token;
            break;
          }
        } catch (e) {
          ultimoErro = e?.response?.data?.error || e.message;
        }
      }

      if (!userToken) {
        console.error("[WABA-CONNECT] Falha ao trocar code por token:", ultimoErro);
        return res.status(400).json({
          erro: "Não foi possível validar o login com o Facebook.",
          detalhe: ultimoErro,
        });
      }
    } else {
      // access_token já veio pronto do frontend
      userToken = access_token;
    }

    // ── 2. Descobre o WABA (WhatsApp Business Account) vinculado ─────────
    let wabaIdFinal = waba_id || null;

    if (!wabaIdFinal) {
      try {
        const appToken = `${APP_ID}|${APP_SECRET}`;
        const debugRes = await axios.get(`https://graph.facebook.com/${GRAPH_VERSION}/debug_token`, {
          params: { input_token: userToken, access_token: appToken },
          timeout: 10000,
        });
        const scopes = debugRes.data?.data?.granular_scopes || [];
        for (const s of scopes) {
          if (s.target_ids && s.target_ids.length > 0) {
            wabaIdFinal = s.target_ids[0];
            console.log(`[WABA-CONNECT] WABA ID encontrado via granular_scope '${s.scope}':`, wabaIdFinal);
            break;
          }
        }
        if (!wabaIdFinal && debugRes.data?.data?.target_ids?.length) {
          wabaIdFinal = debugRes.data.data.target_ids[0];
        }
      } catch (e) {
        console.warn("[WABA-CONNECT] debug_token falhou:", e?.response?.data || e.message);
      }
    }

    if (!wabaIdFinal) {
      try {
        const meRes = await axios.get(`https://graph.facebook.com/${GRAPH_VERSION}/me`, {
          params: { fields: "whatsapp_business_accounts", access_token: userToken },
          timeout: 10000,
        });
        wabaIdFinal = meRes.data?.whatsapp_business_accounts?.data?.[0]?.id || null;
      } catch (e) {
        console.warn("[WABA-CONNECT] /me?fields=whatsapp_business_accounts falhou:", e?.response?.data || e.message);
      }
    }

    if (!wabaIdFinal) {
      try {
        const bizRes = await axios.get(`https://graph.facebook.com/${GRAPH_VERSION}/me/businesses`, {
          params: { access_token: userToken },
          timeout: 10000,
        });
        const businesses = bizRes.data?.data || [];
        for (const biz of businesses) {
          if (!biz.id) continue;
          try {
            const wabasRes = await axios.get(
              `https://graph.facebook.com/${GRAPH_VERSION}/${biz.id}/owned_whatsapp_business_accounts`,
              { params: { access_token: userToken }, timeout: 10000 }
            );
            if (wabasRes.data?.data?.length) {
              wabaIdFinal = wabasRes.data.data[0].id;
              break;
            }
          } catch {}
          try {
            const clientWabasRes = await axios.get(
              `https://graph.facebook.com/${GRAPH_VERSION}/${biz.id}/client_whatsapp_business_accounts`,
              { params: { access_token: userToken }, timeout: 10000 }
            );
            if (clientWabasRes.data?.data?.length) {
              wabaIdFinal = clientWabasRes.data.data[0].id;
              break;
            }
          } catch {}
        }
      } catch (e) {
        console.warn("[WABA-CONNECT] /me/businesses falhou:", e?.response?.data || e.message);
      }
    }

    if (!wabaIdFinal) {
      try {
        const appToken = `${APP_ID}|${APP_SECRET}`;
        const appWabas = await axios.get(
          `https://graph.facebook.com/${GRAPH_VERSION}/${APP_ID}/whatsapp_business_accounts`,
          { params: { access_token: appToken }, timeout: 10000 }
        );
        if (appWabas.data?.data?.length) {
          wabaIdFinal = appWabas.data.data[0].id;
        }
      } catch {}
    }

    if (!wabaIdFinal) {
      return res.status(400).json({
        erro: "Login no Facebook funcionou, mas não foi possível encontrar nenhuma conta do WhatsApp Business vinculada. Verifique se concluiu todas as etapas na janela da Meta (seleção de empresa e número)."
      });
    }

    // ── 3. Busca o número de telefone vinculado a esse WABA ──────────────
    let phone = null;

    if (phone_number_id) {
      try {
        const pRes = await axios.get(`https://graph.facebook.com/${GRAPH_VERSION}/${phone_number_id}`, {
          params: { fields: "display_phone_number,verified_name,id,status", access_token: userToken },
          timeout: 10000,
        });
        if (pRes.data?.id) phone = pRes.data;
      } catch (e) {
        console.warn("[WABA-CONNECT] Erro ao buscar número direto:", e?.response?.data || e.message);
      }
    }

    if (!phone) {
      try {
        const phonesRes = await axios.get(`https://graph.facebook.com/${GRAPH_VERSION}/${wabaIdFinal}/phone_numbers`, {
          params: { fields: "display_phone_number,verified_name,id,status", access_token: userToken },
          timeout: 10000,
        });
        const phones = phonesRes.data?.data || [];
        phone = phone_number_id ? (phones.find(p => p.id === phone_number_id) || phones[0]) : phones[0];
      } catch (e) {
        console.warn("[WABA-CONNECT] Erro ao buscar lista do WABA:", e?.response?.data || e.message);
      }
    }

    if (!phone?.id) {
      return res.status(400).json({ erro: "Nenhum número de telefone encontrado nesse WhatsApp Business Account." });
    }

    // ── 4. Inscreve o app no webhook do WABA (pra começar a receber msgs) ─
    try {
      const appAccessToken = `${APP_ID}|${APP_SECRET}`;
      await axios.post(
        `https://graph.facebook.com/${GRAPH_VERSION}/${wabaIdFinal}/subscribed_apps`,
        {},
        { params: { access_token: appAccessToken }, timeout: 10000 }
      );
    } catch (e) {
      console.warn("[WABA-CONNECT] Falha ao inscrever webhook (não bloqueia):", e?.response?.data || e.message);
    }

    // ── 5. Salva no banco (mesmo padrão do /canais/configurar-oficial) ───
    const novoCanal = {
      empresa_id: empresaId,
      nome: phone.verified_name || phone.display_phone_number || `WhatsApp Oficial (${phone.id})`,
      tipo: "cloud_api",
      status: "conectado",
      dados_conexao: {
        phone_number_id: phone.id,
        access_token: userToken,
        business_account_id: wabaIdFinal,
        display_phone_number: phone.display_phone_number || null,
        verified_name: phone.verified_name || null,
        ativo: true,
      }
    };

    if (supabase) {
      await supabase.from("canais").delete().eq("empresa_id", empresaId).eq("tipo", "cloud_api");
      const { error } = await supabase.from("canais").insert([novoCanal]);
      if (error) console.warn("[WABA-CONNECT] Erro ao salvar canal:", error.message);
    }

    canaisMemoria.set(phone.id, empresaId);

    return res.json({
      ok: true,
      phone_number: phone.display_phone_number || phone.id,
      numero: phone.display_phone_number || phone.id,
      verified_name: phone.verified_name || null,
      nome_verificado: phone.verified_name || null,
      waba_id: wabaIdFinal,
      mensagem: "WhatsApp conectado com sucesso via Embedded Signup!",
    });

  } catch (err) {
    console.error("[WABA-CONNECT] Erro geral:", err?.response?.data || err.message);
    return res.status(500).json({ erro: "Erro ao processar conexão com a Meta.", detalhe: err.message });
  }
});

module.exports = router;
