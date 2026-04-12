const axios = require("axios");
const { CHATWOOT_URL, CHATWOOT_TOKEN, CHATWOOT_ACCOUNT, TEAM_MAP } = require("../config/env");

async function atribuirChatwoot(number, setor) {
  try {
    if (!CHATWOOT_TOKEN || !CHATWOOT_ACCOUNT) return;
    const teamId = TEAM_MAP[setor?.toLowerCase().trim()];
    if (!teamId) return;
    const search = await axios.get(
      `${CHATWOOT_URL}/api/v1/accounts/${CHATWOOT_ACCOUNT}/conversations?page=1`,
      { headers: { api_access_token: CHATWOOT_TOKEN } }
    );
    const phone = number.replace(/\D/g, "");
    const conv = (search.data?.data?.payload || []).find(c =>
      c.meta?.sender?.phone_number?.replace(/\D/g, "")?.includes(phone)
    );
    if (!conv) return;
    await axios.patch(
      `${CHATWOOT_URL}/api/v1/accounts/${CHATWOOT_ACCOUNT}/conversations/${conv.id}/assignments`,
      { team_id: parseInt(teamId) },
      { headers: { api_access_token: CHATWOOT_TOKEN } }
    );
  } catch (e) {
    console.error(`[Chatwoot] ${e.message}`);
  }
}

module.exports = { atribuirChatwoot };
