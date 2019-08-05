const bsv = require('bsv');
require('dotenv').config();

const {getUtxos, sendTxn} = require('./bsv-api');

const hdPriv = bsv.HDPrivateKey.fromString(process.env.HDPRIV);
const fundingPriv = hdPriv.privateKey;
const fundingAddress = fundingPriv.toAddress(process.env.NETWORK).toString();
console.log(`Funding Address: ${fundingAddress}`);

async function split() {
    const utxos = (await getUtxos(fundingAddress)) || [];
    if(utxos.length > 1000) return;
    let total = utxos.reduce((total, utxo) => total + utxo.satoshis, 0) - 100000;
    let count = Math.min(parseInt(total / 1200000), 1000);
    const txn = new bsv.Transaction()
        .from(utxos);
    for(let i = 0; i < count; i++) {
        txn.to(fundingAddress, 1200000);
    }
    txn.change(fundingAddress);
    txn.sign(fundingPriv);

    console.log(await sendTxn(txn));
}

split()
    .catch(console.error)
    .then(() => process.exit(0));