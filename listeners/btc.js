const bitcore = require('bitcore-lib');
const fs = require('fs-extra');
const fetch = require('node-fetch');
const path = require('path');
// const Socket = require('blockchain.info/Socket');

require('dotenv').config();
const { BigQuery } = require('@google-cloud/bigquery');
const bigquery = new BigQuery();

const basedir = path.join(__dirname, '../data/blocks');
fs.ensureDirSync(basedir);

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

async function sync() {
    let { prevHash } = require(path.join(basedir, 'tape.json'));
    let currentBlock = await getCurrentBlock();

    // for(; syncHeight <= currentBlock.height; ++syncHeight) {
        let block = await getBlock(currentBlock.hash);

        await fs.writeJSON(
            path.join(basedir, `${block.hash}.json`),
            {
                chainId: 'BTC',
                hash: block.hash,
                header: block.header.toString(),
                txns: block.transactions.map((txn) => txn.toString()),
            }
        );

    // }

    // for (let txid of block.txids) {
    //     await fs.writeFile(
    //         path.join(basedir, `/txns/${txid}`),
    //         await getTxn(txid)
    //     );
    // }



        // await fs.writeJSON(path.join(basedir, 'tape.json'), { syncHeight });
    // }
}

async function listen() {
    const socket = new Socket()
        .onOpen(() => console.log('Listening'))
        .onTransaction((txn) => {
            fs.writeJSON(
                path.join(basedir, `/txns/${txn.hash}`),
                txn
            );
        })
        .onBlock((block) => {
            fs.writeJSON(
                path.join(basedir, `/blocks/${block.hash}`),
                block
            );
        })
        .onClose(() => console.log('Closing'))

}

async function query() {


}

sync()
    .catch(console.error)
    .then(() => process.exit(0));