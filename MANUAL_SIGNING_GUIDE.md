# Manual EIP-7702 Delegation Signing Guide

## Updated Implementation

The `OnChainTest.s.sol` has been updated to manually sign EIP-7702 delegations using `vm.sign()` instead of the helper `vm.signDelegation()`.

## Key Changes

### 1. SignedDelegation Struct (Manual Construction)

```solidity
struct SignedDelegation {
    uint8 v;          // Recovery ID from signature
    bytes32 r;        // First 32 bytes of signature
    bytes32 s;        // Second 32 bytes of signature
    uint64 nonce;     // Hardcoded to 0
    address implementation;  // TokenTransferer address
}
```

### 2. Manual Signing Process

Instead of:
```solidity
// Old way
VmSafe.SignedDelegation memory auth = vm.signDelegation(tokenTransferer, userPaymentPrivateKey);
```

Now we:

#### Step 1: Create the digest to sign
```solidity
bytes32 digest = keccak256(abi.encode(block.chainid, uint64(0), tokenTransferer));
```

#### Step 2: Sign using vm.sign()
```solidity
(uint8 v, bytes32 r, bytes32 s) = vm.sign(userPaymentPrivateKey, digest);
```

Reference: [Foundry Sign Cheatcode](https://getfoundry.sh/reference/cheatcodes/sign)

#### Step 3: Construct the struct manually
```solidity
SignedDelegation memory auth = SignedDelegation({
    v: v,
    r: r,
    s: s,
    nonce: 0,  // Hardcoded to 0
    implementation: tokenTransferer
});
```

### 3. Attach and Execute

```solidity
vm.startBroadcast(deployerPrivateKey);

// Attach the delegation
vm.attachDelegation(auth);

// Call transfer on delegated address
TokenTransferer(payable(userPaymentAddr)).transfer(testToken, hotWallet);

vm.stopBroadcast();
```

## Full Implementation

See `script/OnChainTest.s.sol` for the complete implementation:

```solidity
// Compute the digest for delegation signing
bytes32 digest = keccak256(abi.encode(block.chainid, uint64(0), tokenTransferer));

// Sign the digest manually using vm.sign()
(uint8 v, bytes32 r, bytes32 s) = vm.sign(userPaymentPrivateKey, digest);

// Manually construct SignedDelegation struct with nonce = 0
SignedDelegation memory auth = SignedDelegation({
    v: v,
    r: r,
    s: s,
    nonce: 0,  // Hardcoded to 0 as requested
    implementation: tokenTransferer
});

console.log("  [✓] Delegation signed");
console.log("    Implementation :", auth.implementation);
console.log("    Nonce          :", auth.nonce);

// Attach the delegation
vm.attachDelegation(auth);
console.log("  [✓] Delegation attached");

// Call transfer on delegated address
TokenTransferer(payable(userPaymentAddr)).transfer(testToken, hotWallet);
console.log("  [✓] Tokens transferred");
```

## Why Manual Construction?

1. **Nonce Control**: Set nonce to exactly 0 for predictable behavior
2. **Transparent Signing**: See exactly what digest is being signed
3. **Custom Logic**: Can compute digest with custom parameters
4. **Educational**: Demonstrates the underlying EIP-7702 mechanism

## Digest Computation

The digest includes three components:
- `block.chainid` - Current chain ID (Arbitrum Sepolia, Ethereum, etc.)
- `nonce` - Set to 0 (prevents replay attacks)
- `implementation` - TokenTransferer address

```solidity
bytes32 digest = keccak256(abi.encode(block.chainid, uint64(0), tokenTransferer));
```

## Testing

Run the on-chain test:

```bash
forge script script/OnChainTest.s.sol \
  --rpc-url https://sepolia-rollup.arbitrum.io/rpc \
  --broadcast
```

## References

- [Foundry vm.sign() Documentation](https://getfoundry.sh/reference/cheatcodes/sign)
- [EIP-7702 Specification](https://eips.ethereum.org/EIPS/eip-7702)
- [Forge Standard Library](https://github.com/foundry-rs/forge-std)

