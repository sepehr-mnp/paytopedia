# EIP-7702 Set Code Transaction - Send Implementation

Reference: [https://eip7702.io/](https://eip7702.io/)

## Overview

EIP-7702 gives superpowers to EOAs by allowing any EOA to set its code based on any existing smart contract. This script demonstrates how to create and send an EIP-7702 "set code transaction" (transaction type `0x04`).

Per [https://eip7702.io/](https://eip7702.io/):

> EIP-7702 allows any EOA to set its code based on any existing smart contract. To do so, an EOA owner would sign an authorization that could then be submitted by anyone as part of the new transaction type. The code will be valid until replaced by another authorization.

## Script: `scripts/sendEIP7702Transaction.ts`

This TypeScript script demonstrates:
- Creating EIP-7702 authorization digest
- Signing the authorization with the EOA's private key
- Constructing the transaction with authorization list
- Building the proper delegation designation

## EIP-7702 Transaction Structure

According to the [EIP-7702 Specification](https://eip7702.io/):

### Transaction Format

```
TransactionType: 0x04

TransactionPayload: rlp([
  chain_id,
  nonce,
  max_priority_fee_per_gas,
  max_fee_per_gas,
  gas_limit,
  destination,
  value,
  data,
  access_list,
  authorization_list,
  signature_y_parity,
  signature_r,
  signature_s
])
```

### Authorization List Format

```
authorization_list = [[
  chain_id,
  address,
  nonce,
  y_parity,
  r,
  s
], ...]
```

## How It Works

### Step 1: Create Authorization Digest

Per [https://eip7702.io/](https://eip7702.io/):

> `authority = ecrecover(keccak(0x05 || rlp([chain_id, address, nonce])), y_parity, r, s)`

```typescript
const digest = ethers.keccak256(
  ethers.concat(['0x05', authTupleData])
);
```

Where:
- `0x05` is the EIP-7702 domain separator
- `chain_id` is the current chain ID
- `address` is the implementation (TokenTransferer)
- `nonce` is the EOA's current nonce

### Step 2: Sign the Digest

```typescript
const signature = userPaymentWallet.signingKey.sign(digest);
const yParity = signature.v - 27; // Convert to parity (0 or 1)
```

The signature creates:
- `v` (y-parity): 0 or 1
- `r`: first 32 bytes of signature
- `s`: second 32 bytes of signature

### Step 3: Build Authorization Tuple

Per [EIP-7702 Specification](https://eip7702.io/):

```typescript
const authorization = {
  chainId: network.chainId,
  address: TOKEN_TRANSFERER,
  nonce: accountNonce,
  yParity: yParity,
  r: signature.r,
  s: signature.s
};
```

### Step 4: Construct Set Code Transaction

The transaction includes:
- `to`: User's payment address (the EOA being delegated)
- `data`: Encoded call to TokenTransferer.transfer()
- `authorizationList`: Array of authorization tuples

## EIP-7702 Execution Behavior

According to [https://eip7702.io/](https://eip7702.io/), at transaction execution start, for each authorization tuple:

1. **Verify chain_id**: Must be 0 or current chain ID
2. **Verify nonce**: Must be < 2^64 - 1
3. **Recover authority**: Via ecrecover from signature
4. **Add to accessed_addresses**: For access list tracking
5. **Verify code**: Must be empty or already delegated
6. **Verify nonce**: Authority nonce must equal authorization nonce
7. **Add gas refund**: If authority exists in trie
8. **Set code**: Code becomes `0xef0100 || implementation_address`
9. **Increment nonce**: Authority nonce increases by 1

### Delegation Designation

The code that gets set is:
```
0xef0100 || implementation_address
```

This is a special designation that tells the EVM the code is delegated to another contract.

### Temporary Delegation

**Important**: The code delegation is **temporary** and only valid during transaction execution. After the transaction completes, the code is removed and the address returns to normal EOA state.

## Running the Script

```bash
# Install dependencies (if not already installed)
npm install ethers dotenv
npm install --save-dev typescript ts-node @types/node

# Run the script
npx ts-node scripts/sendEIP7702Transaction.ts
```

## Environment Variables

The script uses the same `.env` configuration:

```env
PRIVATE_KEY               # Service operator key
HOT_WALLET               # Token destination
TOKEN_TRANSFERER         # Implementation contract
USER_PAYMENT_ADDR        # EOA being delegated
USER_PAYMENT_PRIVATE_KEY # EOA private key
TEST_TOKEN              # Token to transfer
RPC_URL                 # Blockchain RPC endpoint
```

## Example Output

```
╔════════════════════════════════════════════════════════════════════╗
║            EIP-7702 Set Code Transaction - Send Example            ║
║                    Reference: https://eip7702.io/                  ║
╚════════════════════════════════════════════════════════════════════╝

Configuration:
  RPC URL              : https://sepolia-rollup.arbitrum.io/rpc
  Chain ID             : 421614
  Service Operator     : 0x...
  User Payment Address : 0x...
  Token Transferer     : 0x...

EIP-7702 Authorization Creation
────────────────────────────────────────────────────────────────
  User Payment Address Nonce: 0

Authorization Digest:
  Format: keccak256(0x05 || rlp([chainId, implementation, nonce]))
  ChainId          : 421614
  Implementation   : 0x...
  Nonce            : 0
  Digest           : 0x...

Signing Authorization
────────────────────────────────────────────────────────────────
  Signer           : 0x...
  Signature (v, r, s):
    v              : 27 (parity: 0)
    r              : 0x...
    s              : 0x...

  Recovered Signer : 0x...
  Signature Valid  : true

EIP-7702 Transaction Structure
────────────────────────────────────────────────────────────────
  Authorization List:
    [0] = {
      chainId       : 421614,
      address       : 0x...,
      nonce         : 0,
      yParity       : 0,
      r             : 0x...,
      s             : 0x...
    }

Transaction Payload:
  To              : 0x...
  Data            : 0x...
  Value           : 0

EIP-7702 Transaction Details
────────────────────────────────────────────────────────────────
  Transaction Type     : 0x04 (Set Code Transaction)
  Destination          : 0x...
  Value                : 0
  Data                 : 0x...
  Authorization Count  : 1

EIP-7702 Behavior (Per Specification)
────────────────────────────────────────────────────────────────
  At transaction execution:
  1. Verify chain_id is 0 or current chain
  2. Verify nonce < 2^64 - 1
  3. Recover authority from signature
  4. Add authority to accessed_addresses
  5. Verify authority code is empty or already delegated
  6. Verify authority nonce equals authorization nonce
  7. Add gas refund if authority exists
  8. Set code to 0xef0100 || implementation address
  9. Increment authority nonce

Delegation Designation
────────────────────────────────────────────────────────────────
  Format: 0xef0100 || implementation_address
  Code to be set: 0xef0100...
```

## Key Concepts from EIP-7702

### Flexible
Per [https://eip7702.io/](https://eip7702.io/):
> EIP-7702 offers some guardrails yet it is very flexible. Users can provide both single-chain and cross-chain authorizations, as well as choose what proxy to use.

### Compatible with EIP-4337
> It is easy to use EIP-7702 with EIP-4337, so most of the infrastructure (e.g. paymasters, bundlers, RPC endpoints) would just work.

### Compatible with Existing Smart Accounts
> As EIP-7702 allows an EOA to set its code directly and supports writing to storage, it should be possible with little to no effort to use existing smart account implementations.

## Use Cases

1. **Token Collection**: Collect multiple tokens from users in a single transaction
2. **Batch Operations**: Execute multiple operations in one transaction
3. **Gas Sponsorship**: Sponsor gas for user transactions
4. **Custom Permissioning**: Implement custom authorization schemes
5. **Payment Gateways**: Simplified token deposit/withdrawal flows

## Important Notes

- **Type 0x04 Support**: Requires RPC provider to support EIP-7702 transactions
- **Chain Support**: Not all chains support EIP-7702 yet (e.g., Arbitrum Sepolia does)
- **Temporary Duration**: Code delegation is only valid during transaction execution
- **Nonce Management**: Each authorization increments the EOA's nonce
- **Replay Protection**: Nonce is included in signed data to prevent replays

## References

- **EIP-7702 Specification**: [https://eip7702.io/](https://eip7702.io/)
- **Transaction Format**: Type 0x04 set code transaction
- **Digest Format**: `keccak256(0x05 || rlp([chainId, address, nonce]))`
- **Delegation Code**: `0xef0100 || implementation_address`

## Related Files

- `scripts/testWithdrawal.ts` - Off-chain signature testing
- `script/OnChainTest.s.sol` - Foundry on-chain execution
- `contracts/TokenTransferer.sol` - Implementation contract
- `.env.example` - Configuration template

