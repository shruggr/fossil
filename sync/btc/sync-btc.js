const bitcore = require('bitcore-lib');
const fs = require('fs-extra');
const fetch = require('node-fetch');
const path = require('path');
require('dotenv').config();

function getLatestHeight() {
    return fetch('https://blockchain.info/latestblock')
        .then((res) => res.ok ? res.json() : Promise.reject(new Error(res.statusText)))
        .then(({height}) => height);
}

function getBlocksByHeight(height) {
    return fetch(`https://blockchain.info/block-height/${height}?format=json`)
        .then((res) => res.ok ? res.json() : Promise.reject(new Error(res.statusText)))
        .then((data) => data.blocks.map(({hash}) => hash));
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
    const filename = path.join(process.env.DATA, 'btc');
    let lastSync = 0;
    if(fs.existsSync(filename)) {
        lastSync = parseInt(fs.readFileSync(filename));
    }

    let latest = await getLatestHeight();
    while(lastSync++ <= latest) {
        let hashes = await getBlocksByHeight(lastSync);
        for(let hash of hashes) {
            await processBlock(hash);
        }
        fs.writeFileSync(filename, lastSync);
    }
    // Sleep 1 minute
    return new Promise((resolve) => {
        setTimeout(() => resolve(syncFull()), 60000)
    });
}

syncFull()
    .catch(console.error)
    .then(() => process.exit(0));