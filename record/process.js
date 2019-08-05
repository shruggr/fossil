const bsv = require('bsv');;
const fs = require('fs-extra');
const path = require('path');
require('dotenv').config();

const {getUtxos, sendTxn} = require('./bsv-api');


const BLOCKHEAD = '1AWEpKHWcdhXCfdPGH4zKEP1EMzSZAWsgB';
const BLOCKTXNS = '1NwmdmRduR59pYdGaafHVMvbjDvUAjsja5';

const hdPriv = bsv.HDPrivateKey.fromString(process.env.HDPRIV);
const fundingPriv = hdPriv.privateKey;
const fundingAddress = fundingPriv.toAddress(process.env.NETWORK).toString();
console.log(`Funding Address: ${fundingAddress}`);

const blocksdir = path.join(__dirname, '../data/blocks');
const pendingdir = path.join(__dirname, '../data/pending');
const processeddir = path.join(__dirname, '../data/processed');
fs.ensureDirSync(blocksdir);
fs.ensureDirSync(pendingdir);
fs.ensureDirSync(processeddir);

async function processBlock({chainId, hash, header, txns}) {
    let derivationKeys = [];
    for(let i = 0; i < hash.length; i += 8) {
        derivationKeys.push(parseInt(hash.substring(i, i+8), 16));
    }
    const derivationPath = `m/${derivationKeys.join('/')}`;

    let blockHDPriv = hdPriv.deriveChild(derivationPath);
    let blockPrivateKey = blockHDPriv.privateKey;
    let blockAddress = blockPrivateKey.toAddress('testnet').toString();
    console.log(`Block Address: ${blockAddress}`);

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

    let satsRequired = (100000 * chunks.length) + 50000;
    const utxos = [];
    let satoshis = 0;
    while(satoshis < satsRequired && fundingUtxos.length) {
        let utxo = fundingUtxos.pop();
        utxos.push(utxo);
        satoshis += utxo.satoshis;
    }
    if(satoshis < satsRequired) {
        fundingUtxos.push(...utxos);
        throw new Error('Insufficient Funding');
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
                vout: i,
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

    let fundingTxnId = await sendTxn(fundingTxn);

    let changeOutput = fundingTxn.getChangeOutput().toObject();
    changeOutput.vout = fundingTxn._changeIndex;
    changeOutput.txid = fundingTxn.hash;
    fundingUtxos.unshift(changeOutput);
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
            await sendTxn(new bsv.Transaction(hex.toString()));
            await fs.remove(path.join(pendingdir, hash));
        }
        catch(err) {
            console.error(err);
        }

    }
}

let fundingUtxos;
async function run() {
    fundingUtxos = await getUtxos(fundingAddress);
    await processBlocks();
    // await processPending();

    // Sleep 10 minutes
    return new Promise((resolve, reject) => {
        setTimeout(() => resolve(run()), 600000)
    });
}

run()
    .catch(console.error)
    .then(() => process.exit(0));