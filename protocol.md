# Fossil Blockchain Protocol

## "Block Funding" Transaction
### Outputs
#### vout 0-n
- Payments to be used to fund Transaction List transactions

#### OP_RETURN
- BLOCK HEAD Protocol ID - 1AWEpKHWcdhXCfdPGH4zKEP1EMzSZAWsgB
- ChainID - BTC, BCH
- Block Header hex


## "Transaction List" Transaction
### Inputs
- One of outputs 0-n from Block Funding Transaction
- Any addition inputs needed to fund transaction fees

### Output
#### OP_RETURN Output
- BLOCK TXNS Protocol ID - 1NwmdmRduR59pYdGaafHVMvbjDvUAjsja5
- 1st transaction hex
- 2nd transaction hex
- ...
- nth transaction hex

