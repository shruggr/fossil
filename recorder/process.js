const bsv = require('bsv');
const fetch = require('node-fetch');
const fs = require('fs-extra');
const path = require('path');

require('dotenv').config();

const NETWORK = 'testnet';
const APINET = 'test';

const BLOCKHEAD = '1AWEpKHWcdhXCfdPGH4zKEP1EMzSZAWsgB';
const BLOCKTXNS = '1NwmdmRduR59pYdGaafHVMvbjDvUAjsja5';

const hdPriv = bsv.HDPrivateKey.fromString(process.env.HDPRIV);
const fundingPriv = hdPriv.privateKey;
const fundingAddress = fundingPriv.toAddress(NETWORK).toString();
console.log(`Funding Address: ${fundingAddress}`);

const blocksdir = path.join(__dirname, '../data/blocks');
const pendingdir = path.join(__dirname, '../data/pending');
const processeddir = path.join(__dirname, '../data/processed');
fs.ensureDirSync(blocksdir);
fs.ensureDirSync(pendingdir);
fs.ensureDirSync(processeddir);

function getUtxos(address) {
    return fetch(`https://api.bitindex.network/api/v3/${APINET}/addr/${address}/utxo`)
        .then((res) => res.ok ? res.json() : Promise.reject(new Error(res.statusText)))
        .then((data) => {
            return data;
        });
}

function send(txn) {
    console.log(`Broadcasting: ${txn.hash}`);
    return fetch(`https://api.bitindex.network/api/v3/${APINET}/tx/send`, {
        method: 'post',
        body: JSON.stringify({rawtx: txn.toString()}),
        headers: {
            'Content-Type': 'application/json',
            'api_key': '5S6NL4ZeikgBqFCsJrv3bhexqDB1mNwz4GmnAK2hjzRviozF8Dx2sKjfT73vaFcuNn'
         }
    })
        .then(async (res) => {
            const data = await res.json();
            if(!res.ok) {
                throw new Error(data.message.message.substring(0, 100));
            }
            return data.txid
        })
}

async function processBlock({chainId, hash, header, txns}) {
    let derivationKeys = [];
    for(let i = 0; i < hash.length; i += 8) {
        derivationKeys.push(parseInt(hash.substring(i, i+8), 16));
    }
    const derivationPath = `m/${derivationKeys.join('/')}`;

    let blockHDPriv = hdPriv.deriveChild(derivationPath);
    let blockPrivateKey = blockHDPriv.privateKey;
    let blockAddress = blockPrivateKey.toAddress('testnet').toString();

    let chunk = [];
    const chunks = [chunk];
    let chunkLength = 0;
    for(let txn of txns) {
        let txnBuffer = Buffer.from(txn, 'hex');
        if(chunkLength + txnBuffer.byteLength + 5 > 96000) {
            chunkLength = 0;
            chunk = [];
            chunks.push(chunk);
        }
        chunkLength += txnBuffer.byteLength + 5;
        chunk.push(txnBuffer);
    }

    let chainUtxos = await getUtxos(fundingAddress);
    const utxos = [];
    let satoshis = 0;
    while(satoshis < 1050000 && chainUtxos.length) {
        let utxo = chainUtxos.pop();
        utxos.push(utxo);
        satoshis += utxo.satoshis;
    }

    const fundingTxn = new bsv.Transaction()
        .from(utxos);
    for(let chunk of chunks) {
        fundingTxn.to(blockAddress, 100000);
    }
    fundingTxn.addOutput(new bsv.Transaction.Output({
            script: bsv.Script.buildSafeDataOut([
                BLOCKHEAD,
                chainId,
                Buffer.from(header, 'hex')
            ]),
            satoshis: 0
          }))
        .change(fundingAddress)
        .sign(fundingPriv);


    const chunkTxns = {};
    chunks.forEach((chunk, i) => {
        let chunkTxn = new bsv.Transaction()
            .from({
                txid: fundingTxn.hash,
                vout: 0,
                script: fundingTxn.outputs[i].script,
                satoshis: fundingTxn.outputs[i].satoshis
            })
            .addOutput(new bsv.Transaction.Output({
                script: bsv.Script.buildSafeDataOut([
                    BLOCKTXNS,
                    ...chunk
                ]),
                satoshis: 0
            }))
            .change(fundingAddress)
            .sign(blockPrivateKey);
        chunkTxns[chunkTxn.hash] = chunkTxn.toString()
    })

    let fundingTxnId = await send(fundingTxn);
    return {
        fundingTxnId,
        chunkTxns
    };
}

async function processBlocks() {
    console.log('Processing Blocks');
    let filelist = await fs.readdir(blocksdir);
    for(let file of filelist) {
        console.log(`Processing File: ${file}`)
        let block = await fs.readJSON(path.join(blocksdir, file));
        let result = await processBlock(block);
        for(let [hash, hex] of Object.entries(result.chunkTxns)) {
            await fs.writeFile(
                path.join(pendingdir, hash),
                hex
            );
        }
        await fs.writeFile(path.join(processeddir, block.hash), block.header);
        await fs.remove(path.join(blocksdir, file));
    }
}

async function processPending() {
    console.log('Processing Pending');
    let filelist = await fs.readdir(pendingdir);
    for(let hash of filelist) {
        const hex = await fs.readFile(path.join(pendingdir, hash));
        try {
            await send(new bsv.Transaction(hex.toString()));
            await fs.remove(path.join(pendingdir, hash));
        }
        catch(err) {
            console.error(err);
        }

    }
}

async function run() {
    await processBlocks();
    await processPending();

    return new Promise((resolve, reject) => {
        setTimeout(run, 10000);
    })
}

run()
    .catch(console.error)
    .then(() => process.exit);
