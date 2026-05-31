// Usa Railway GraphQL API para forçar redeploy do scintillating-freedom
const ACCESS_TOKEN = 'VWZhkNgHLO68gK3bchoeuNDK_6esQFUCMnhWgp7k46i';
const PROJECT_ID   = '70bc1eeb-4f4f-4c60-88c8-d9b4bdfee0f9';
const ENV_ID       = '649894fd-f5b3-440d-8945-eb9423a343e4';
const RAILWAY_API  = 'https://backboard.railway.app/graphql/v2';

async function gql(query, variables = {}) {
  const res = await fetch(RAILWAY_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ACCESS_TOKEN}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  return res.json();
}

async function run() {
  // 1. Lista serviços do projeto
  console.log('Buscando serviços do projeto...');
  const { data: projData, errors: projErrors } = await gql(`
    query {
      project(id: "${PROJECT_ID}") {
        name
        services {
          edges {
            node {
              id
              name
            }
          }
        }
      }
    }
  `);

  if (projErrors) {
    console.error('Erro GraphQL:', JSON.stringify(projErrors));
    return;
  }

  const servicos = projData?.project?.services?.edges?.map(e => e.node) || [];
  console.log('Serviços encontrados:');
  servicos.forEach(s => console.log(`  - ${s.name} | ID: ${s.id}`));

  // 2. Encontra o scintillating-freedom
  const inbox = servicos.find(s => s.name?.toLowerCase().includes('scintillating') || s.name?.toLowerCase().includes('inbox'));
  
  if (!inbox) {
    console.log('\nServiço scintillating-freedom não encontrado. Listando todos:');
    servicos.forEach(s => console.log(`  - "${s.name}" (${s.id})`));
    return;
  }

  console.log(`\nServiço encontrado: ${inbox.name} (${inbox.id})`);

  // 3. Busca o último deployment desse serviço
  console.log('\nBuscando último deployment...');
  const { data: deplData } = await gql(`
    query {
      deployments(
        first: 1
        input: { projectId: "${PROJECT_ID}", serviceId: "${inbox.id}", environmentId: "${ENV_ID}" }
      ) {
        edges {
          node {
            id
            status
            createdAt
          }
        }
      }
    }
  `);

  const deploys = deplData?.deployments?.edges?.map(e => e.node) || [];
  if (deploys.length === 0) {
    console.log('Nenhum deployment encontrado.');
    return;
  }

  const ultimoDeploy = deploys[0];
  console.log(`Último deploy: ${ultimoDeploy.id} | Status: ${ultimoDeploy.status} | ${ultimoDeploy.createdAt}`);

  // 4. Força redeploy
  console.log('\nForçando redeploy...');
  const { data: redeployData, errors: redeployErrors } = await gql(`
    mutation {
      deploymentRedeploy(id: "${ultimoDeploy.id}") {
        id
        status
      }
    }
  `);

  if (redeployErrors) {
    console.error('Erro ao fazer redeploy:', JSON.stringify(redeployErrors));
    return;
  }

  const newDeploy = redeployData?.deploymentRedeploy;
  console.log(`\n✅ REDEPLOY INICIADO!`);
  console.log(`   Novo deployment ID: ${newDeploy?.id}`);
  console.log(`   Status: ${newDeploy?.status}`);
  console.log('\nO servidor vai reiniciar em ~1 minuto.');
  console.log('Depois disso, as mensagens da instância "maiara" vão aparecer no Inbox!');
}

run();
