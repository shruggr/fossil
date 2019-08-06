# Fossil Blockchain
Preserve legacy blockchain data to BSV.

## Installation
### Upload
```
cd upload
npm install
cd ..
```

#### Initialize
`node upload/initialize.js`
This will initialize the app and display the funding address. Transfer BSV to this address. A safe estimation is about 1200000 satoshis per BTC block.
Smaller blocks will require less BSV, but change will be managed by the system.

#### Split UTXOs
`node upload/split-utxos.js`
This process splits exiting funds into upto 1000 utxos of 1200000 satoshis each. Wait for next BSV block before continuing with upload process.

### Sync
Each blockchain requires its own npm install
```
cd sync/btc
npm install
cd ../bch
npm install
cd ..
```

## Run
### Sync
```
node sync/btc/sync-btc.js
node sync/bch/sync-bch.js
```
Sync process will start from the current block and walk it's way back the chain, saving block data to `./data/blocks/<blockHash>.json`. This process will take a long time to download the entire chain and will require significan storage.

This could be modified to download by block height which would capture orphans and offer more options for which blocks to sync.

### Upload
```
node upload/process.js
```
Upload process analzes downloaded block data and creates BSV transactions. There are two types of BSV transactions, Funding/Block Head transactions, and Transaction List transactions. Funding transactions contain the block header and are broadcast immediately. Funding transaction also includes UTXOs to be used for uploading Transaction List transactions. A child key is derived based on the block hash to ensure that these UTXOs are not spent inadvertantly. When the Funding transaction has been successfully broadcast, the block file is removed from `./data/blocks` and the block header is saved to `./data/processed/<blockHash>`

Transaction List transactions contain an ordered list of block transactions, and are saved to `./data/pending/<transactionHash>`. These transactions are broadcast one at a time. When successfully broadcast, the files are removed from `./data/pending`. There may be some situations where the mempool descendant chain is too long and the transaction will not be accepted. In this case the transaction will remain in the directory, and will be rebroadcast on the next pass.


