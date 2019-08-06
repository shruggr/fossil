const bsv = require('bsv');
const fs = require('fs-extra');
const path = require('path');

const hdPriv = bsv.HDPrivateKey.fromRandom();
const fundingPriv = hdPriv.privateKey;
const fundingAddress = fundingPriv.toAddress(process.env.NETWORK).toString();
console.log(`Funding Address: ${fundingAddress}`);

const blocksDir = path.join(__dirname, '../data/blocks');
const pendingDir = path.join(__dirname, '../data/pending');
const processedDir = path.join(__dirname, '../data/processed');
fs.ensureDirSync(blocksDir);
fs.ensureDirSync(pendingDir);
fs.ensureDirSync(processedDir);

fs.writeFileSync(path.join(__dirname, '../.env'),
`HDPRIV=${hdPriv.toString()}
NETWORK=mainnet
APINET=main
BLOCKS=${blocksDir}
PENDING=${pendingDir}
PROCESSED=${processedDir}
`)


