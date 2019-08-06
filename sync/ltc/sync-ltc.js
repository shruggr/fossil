const bitcore = require('litecore-lib');
const fs = require('fs-extra');
const fetch = require('node-fetch');
const path = require('path');
require('dotenv').config();

function getCurrentBlock() {
    return fetch('https://api.blockcypher.com/v1/ltc/main')
        .then((res) => res.ok ? res.json() : Promise.reject(new Error(res.statusText)))
        .then((data) => new Promise((resolve) => setTimeout(() => resolve(data), 1100)));
}

async function getBlock(id) {
    console.log(`Getting Block: ${id}`);

    return fetch(`https://api.blockcypher.com/v1/ltc/main/blocks/${id}`)
        .then((res) => res.ok ? res.json() : Promise.reject(new Error(res.statusText)))
        .then((data) => new Promise((resolve) => setTimeout(() => resolve(data), 1100)));
}

async function getTransactions(txids) {
    return fetch(`https://api.blockcypher.com/v1/ltc/main/txs/${txids.join(';')}?includeHex=true`)
        .then((res) => res.ok ? res.json() : Promise.reject(new Error(res.statusText)))
        .then((data) => new Promise((resolve) => setTimeout(() => resolve(data), 1100)));
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
    let headerData = await getBlock(hash);
    let blockObj = {
        header: {
            hash: headerData.hash,
            version: headerData.ver,
            prevHash: headerData.prev_block,
            merkleRoot: headerData.mrkl_root,
            time: parseInt(new Date(headerData.time).getTime() / 1000),
            bits: headerData.bits,
            nonce: headerData.nonce,
        },
        transactions: []
    }

    for(let i = 0; i < headerData.txids.length; i += 3) {
        let batch = headerData.txids.slice(i, i + 3);
        let txns = await getTransactions(batch);
        let txnsById = txns.reduce((txnsById, txn) => {
            txnsById[txn.hash] = new bitcore.Transaction(txn.hex);
            return txnsById;
        }, {});
        blockObj.transactions.push(...batch.map((txid) => txnsById[txid]));
    }

    let block = bitcore.Block.fromObject(blockObj);
    let blockData = {
        chainId: 'LTC',
        hash: block.hash,
        header: block.header.toString(),
        height: headerData.height,
        txns: block.transactions.map((txn) => txn.toString()),
        prevHash: block.prevHash
    };
    await fs.writeJSON(
        path.join(process.env.BLOCKS, `${block.hash}.json`),
        blockData
    );
    return headerData;
}

async function syncFull() {
    let { hash } = await getCurrentBlock();
    while(hash) {
        let headerData = await processBlock(hash);
        hash = headerData.previousblockhash;
    }
    // Sleep 10 minutes
    return new Promise((resolve, reject) => {
        setTimeout(() => resolve(syncFull()), 600000)
    });
}

syncFull()
    .catch(console.error)
    .then(() => process.exit(0));