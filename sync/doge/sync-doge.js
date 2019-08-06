const bitcore = require('bitcore-lib');
const fs = require('fs-extra');
const fetch = require('node-fetch');
const path = require('path');
require('dotenv').config();

function getCurrentBlock() {
    return fetch('https://dogeblocks.com/api/status?q=getBestBlockHash')
        .then((res) => res.ok ? res.json() : Promise.reject(new Error(res.statusText)))
        .then(({bestblockhash}) => bestblockhash);
}

async function getBlock(id) {
    console.log(`Getting Block: ${id}`);

    return fetch(`https://dogeblocks.com/api/block/${id}`)
        .then((res) => res.ok ? res.json() : Promise.reject(new Error(res.statusText)));
}

async function getTransactions(hash) {
    return fetch(`https://dogeblocks.com/api/txs/?block=${hash}`)
        .then((res) => res.ok ? res.json() : Promise.reject(new Error(res.statusText)))
        .then(async (data) => {
            let txns = data.txs;
            if(data.pagesTotal == 1) return txns;
            for(let i = 1; i < data.pagesTotal; i++) {
                let res = await fetch(`https://dogeblocks.com/api/txs/?block=${hash}&pageNum=${i}`);
                let data = await res.json();
                txns.push(...data.txs);
            }
            return txns;
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
    let headerData = await getBlock(hash);
    let blockObj = {
        header: {
            hash: headerData.hash,
            version: headerData.ver,
            prevHash: headerData.previousblockhash,
            merkleRoot: headerData.merkleroot,
            time: headerData.time,
            bits: parseInt(headerData.bits, 16),
            nonce: headerData.nonce,
        },
        transactions: await getTransactions(hash)
    }

    let block = bitcore.Block.fromObject(blockObj);
    let blockData = {
        chainId: 'DOGE',
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
    let hash = await getCurrentBlock();
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