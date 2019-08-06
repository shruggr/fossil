const bitcore = require('bitcore-lib');
const fs = require('fs-extra');
const fetch = require('node-fetch');
const path = require('path');
require('dotenv').config();

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
    return await fs.exists(path.join(process.env.BLOCKS, `${hash}.json`))
}

async function isProcessed(hash) {
    return await fs.exists(path.join(process.env.PROCESSED, hash))
}

async function processBlock(hash) {
    console.log(`Processing: ${hash}`);
    if(await isProcessed(hash)) {
        let data = await fs.readFile(path.join(process.env.PROCESSED, hash))
        return new bitcore.BlockHeader(Buffer.from(data.toString(), 'hex'));
    }
    if(await isPending(hash)) {
        let data = await fs.readJSON(path.join(process.env.BLOCKS, `${hash}.json`));
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
        path.join(process.env.BLOCKS, `${block.hash}.json`),
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