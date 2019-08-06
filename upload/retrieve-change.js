const bsv = require('bsv');
const fs = require('fs-extra');
const path = require('path');
require('dotenv').config();

const { getUtxos, sendTxn } = require('./bsv-api');

const hdPriv = bsv.HDPrivateKey.fromString(process.env.HDPRIV);
const fundingPriv = hdPriv.privateKey;
const fundingAddress = fundingPriv.toAddress(process.env.NETWORK).toString();
console.log(`Funding Address: ${fundingAddress}`);

const process.env.PROCESSED = path.join(__dirname, '../data/processed');

async function run() {
    let filelist = await fs.readdir(process.env.PROCESSED);
    for (let hash of filelist) {
        let derivationKeys = [];
        for (let i = 0; i < hash.length; i += 8) {
            derivationKeys.push(parseInt(hash.substring(i, i + 8), 16));
        }
        let derivationPath = `m/${derivationKeys.join('/')}`;
        let blockHDPriv = hdPriv.deriveChild(derivationPath);
        let blockPrivateKey = blockHDPriv.privateKey;
        let blockAddress = blockPrivateKey.toAddress('testnet').toString();
        console.log(`Block Address: ${blockAddress}`);

        let utxos = await getUtxos(blockAddress);
        if (!utxos.length) {
            console.log('No UTXOS');
            continue;
        }
        const txn = new bsv.Transaction()
            .from(utxos)
            .change(fundingAddress)
            .sign(blockPrivateKey);

        let txid = await sendTxn(txn);
        console.log(txid);
    }

}

run()
    .catch(console.error)
    .then(() => process.exit(0));