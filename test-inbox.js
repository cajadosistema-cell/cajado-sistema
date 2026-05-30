async function test() {
  try {
    const res = await fetch('https://scintillating-freedom-production.up.railway.app/canais/config');
    console.log('Status:', res.status);
    console.log('Data:', await res.text());
  } catch(e) {
    console.log('Erro:', e.message);
  }
}
test();
