import * as compactRuntime from '@midnight-ntwrk/compact-runtime';

const address = 'f735bb890f2f309372b2dfa37a22515003bf521a243648c3eff2b36721de8959';
const query = `query GetContractState($address: HexEncoded!) {
  contractAction(address: $address) {
    address
    state
  }
}`;

function fromHex(hex) {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    out[i / 2] = parseInt(clean.substring(i, i + 2), 16);
  }
  return out;
}

async function main() {
  const res = await fetch('https://indexer.preprod.midnight.network/api/v4/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables: { address } }),
  });
  const json = await res.json();
  const stateHex = json.data?.contractAction?.state;
  const bytes = fromHex(stateHex);
  const contractState = compactRuntime.ContractState.deserialize(bytes);
  const s = contractState.data.state;
  console.log('s.toString():', s.toString());
  try {
    const arr = s.asArray();
    console.log('asArray length:', arr.length);
    for (let i = 0; i < arr.length; i++) {
      console.log(`item ${i}:`, arr[i].toString());
    }
  } catch (e) {
    console.log('asArray error:', e.message);
  }
}

main().catch(console.error);
