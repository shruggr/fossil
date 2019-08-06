const bitcore = require('bitcore-lib-cash');
const fs = require('fs-extra');
const fetch = require('node-fetch');
const path = require('path');
require('dotenv').config();

const BITBOX = require('bitbox-sdk').BITBOX;
let bitbox = new BITBOX();


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
    let headerData = await bitbox.Block.detailsByHash(hash);
    let blockObj = {
        header: {
            hash: headerData.hash,
            version: headerData.version,
            prevHash: headerData.previousblockhash,
            merkleRoot: headerData.merkleroot,
            time: headerData.time,
            bits: parseInt(headerData.bits, 16),
            nonce: headerData.nonce,
        },
        transactions: []
    }

    for(let i = 0; i < headerData.tx.length; i += 20) {
        let batch = headerData.tx.slice(i, i + 20);
        let txns = await bitbox.RawTransactions.getRawTransaction(batch);
        blockObj.transactions.push(...txns.map((txn) => new bitcore.Transaction(txn)));
    }

    let block = bitcore.Block.fromObject(blockObj);
    let blockData = {
        chainId: 'BCH',
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
    const filename = path.join(process.env.DATA, 'bch');
    let lastSync = 478557;
    if(fs.existsSync(filename)) {
        lastSync = parseInt(fs.readFileSync(filename));
    }
    let { blocks } = await bitbox.Blockchain.getBlockchainInfo();

    while(lastSync++ <= blocks) {
        let blocks = await bitbox.Block.detailsByHeight(lastSync);
        let hashes = Array.isArray(blocks) ?
            blocks.map((block) => block.hash) :
            [blocks.hash];
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