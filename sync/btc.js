const bitcore = require('bitcore-lib');
const fs = require('fs-extra');
const fetch = require('node-fetch');
const path = require('path');
// const Socket = require('blockchain.info/Socket');

require('dotenv').config();

const blocksdir = path.join(__dirname, '../data/blocks');
const proceddeddir = path.join(__dirname, '../data/processed');
fs.ensureDirSync(blocksdir);
fs.ensureDirSync(proceddeddir);

async function getTxn(txid) {
    return fetch(`https://api.blockcypher.com/v1/btc/main/txs/${txid}?includeHex=true`)
        .then((res) => res.ok ? res.json() : Promise.reject(new Error(res.statusText)))
        .then(({ hex }) => hex);
}

function getCurrentBlock() {
    return fetch('https://blockchain.info/latestblock')
        .then((res) => res.ok ? res.json() : Promise.reject(new Error(res.statusText)));
}

async function getBlock(id) {
    console.log(`Getting Block: ${id}`);

    return fetch(`https://blockchain.info/rawblock/${id}?format=hex`)
        .then((res) => res.ok ? res.text() : Promise.reject(new Error(res.statusText)))
        .then((data) => {
            return new bitcore.Block(Buffer.from(data, 'hex'));
        });

}

async function isPending(hash) {
    return await fs.exists(path.join(blocksdir, `${hash}.json`))
}

async function isProcessed(hash) {
    return await fs.exists(path.join(proceddeddir, hash))
}

async function processBlock(hash) {
    console.log(`Processing: ${hash}`);
    if(await isProcessed(hash)) {
        let data = await fs.readFile(path.join(proceddeddir, hash))
        return new bitcore.BlockHeader(Buffer.from(data.toString(), 'hex'));
    }
    if(await isPending(hash)) {
        let data = await fs.readJSON(path.join(blocksdir, `${hash}.json`));
        return new bitcore.BlockHeader(Buffer.from(data.header, 'hex'));
    }
    let block = await getBlock(hash);
    let blockData = {
        chainId: 'BTC',
        hash: block.hash,
        header: block.header.toString(),
        txns: block.transactions.map((txn) => txn.toString()),
        prevHash: block.prevHash
    };
    await fs.writeJSON(
        path.join(blocksdir, `${block.hash}.json`),
        blockData
    );
    return block.header;
}

async function syncFull() {
    let currentBlock = await getCurrentBlock();
    let hash = currentBlock.hash;
    while(hash) {
        let header = await processBlock(hash);
        hash = header.toObject().prevHash;
    }
    // Sleep 10 minutes
    return new Promise((resolve, reject) => {
        setTimeout(() => resolve(syncFull()), 600000)
    });
}

async function syncLatest() {
    let currentBlock = await getCurrentBlock();
    let hash = currentBlock.hash;
    while(!await isPending(hash) && !await isProcessed(hash)) {
        let header = await processBlock(hash);
        hash = header.toObject().prevHash;
    }
}

syncFull()
    .catch(console.error)
    .then(() => process.exit(0));