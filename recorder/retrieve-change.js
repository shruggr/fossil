const bsv = require('bsv')
const fetch = require('node-fetch');
require('dotenv').config();

const NETWORK = 'testnet';
const APINET = 'test';

const hdPriv = bsv.HDPrivateKey.fromString(process.env.HDPRIV);
const fundingPriv = hdPriv.privateKey;
const fundingAddress = fundingPriv.toAddress(NETWORK).toString();
console.log(`Funding Address: ${fundingAddress}`);

const hash = '0000000000000000001bbd854842ad2562993e71ae06ed7ecaf8f04f07688692';

let derivationKeys = [];
for(let i = 0; i < hash.length; i += 8) {
    derivationKeys.push(parseInt(hash.substring(i, i+8), 16));
}

const derivationPath = `m/${derivationKeys.join('/')}`;
let blockHDPriv = hdPriv.deriveChild(derivationPath);
let blockPrivateKey = blockHDPriv.privateKey;
let blockAddress = blockPrivateKey.toAddress('testnet').toString();

function getUtxos(address) {
    return fetch(`https://api.bitindex.network/api/v3/${APINET}/addr/${address}/utxo`)
        .then((res) => res.ok ? res.json() : Promise.reject(new Error(res.statusText)))
        .then((data) => {
            return data;
        });
}

async function run() {
    const txn = new bsv.Transaction()
        .from(await getUtxos(blockAddress))
        .change(fundingAddress)
        .sign(blockPrivateKey);

    console.log(txn.toString());
}

run()
    .catch(console.error)
    .then(() => process.exit(0));