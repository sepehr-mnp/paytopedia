# Fix: Invalid Parity Error in EIP-7702 Delegation

## Problem

Error: `vm.attachDelegation: invalid parity: 27`

This occurs because `vm.sign()` returns `v` values in standard ECDSA format (27 or 28), but EIP-7702 delegations require the recovery parity format (0 or 1).

## Root Cause

### Standard ECDSA Signature (vm.sign)
```solidity
(uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, digest);
// v is 27 or 28 (traditional Ethereum format)
```

### EIP-7702 Delegation Signature
```solidity
struct SignedDelegation {
    uint8 v;  // MUST be 0 or 1 (recovery parity)
    bytes32 r;
    bytes32 s;
    uint64 nonce;
    address implementation;
}
```

## Solution

Convert `v` from ECDSA format to recovery parity:

```solidity
// Get standard ECDSA signature
(uint8 v, bytes32 r, bytes32 s) = vm.sign(userPaymentPrivateKey, digest);

// Convert: subtract 27 to get parity (0 or 1)
uint8 v_parity = v - 27;

// Use in SignedDelegation
VmSafe.SignedDelegation memory auth = VmSafe.SignedDelegation({
    v: v_parity,  // Now 0 or 1
    r: r,
    s: s,
    nonce: 0,
    implementation: tokenTransferer
});

// Now it works!
vm.attachDelegation(auth);
```

## Conversion Formula

| ECDSA v | EIP-7702 v | Formula |
|---------|------------|---------|
| 27      | 0          | 27 - 27 = 0 |
| 28      | 1          | 28 - 27 = 1 |

Or simply: `v_parity = v - 27`

## Implementation in OnChainTest.s.sol

```solidity
// Sign with vm.sign() - returns standard ECDSA format
(uint8 v, bytes32 r, bytes32 s) = vm.sign(userPaymentPrivateKey, digest);

// Convert v from standard ECDSA (27/28) to EIP-7702 parity format (0/1)
// vm.sign() returns v as 27 or 28, but EIP-7702 requires 0 or 1
uint8 v_parity = v - 27;

// Construct with converted parity
VmSafe.SignedDelegation memory auth = VmSafe.SignedDelegation({
    v: v_parity,  // Use converted parity (0 or 1)
    r: r,
    s: s,
    nonce: 0,
    implementation: tokenTransferer
});

// Attach and execute
vm.attachDelegation(auth);
```

## Why This Works

1. **ECDSA signatures** use `v` = 27 + recovery_id (where recovery_id is 0 or 1)
2. **EIP-7702 delegations** only need the recovery_id (0 or 1)
3. Subtracting 27 converts ECDSA format to EIP-7702 format
4. Valid recovery IDs are always 0 or 1

## Testing

After applying this fix, run:

```bash
forge script script/OnChainTest.s.sol \
  --rpc-url https://sepolia-rollup.arbitrum.io/rpc \
  --broadcast
```

Expected output:
```
  [✓] Delegation signed
    V (parity)     : 0  or  1
  [✓] Delegation attached
  [✓] Tokens transferred
  [✓] Test passed - tokens collected successfully
```

## References

- [EIP-7702 Specification](https://eips.ethereum.org/EIPS/eip-7702)
- [ECDSA Recovery IDs](https://bitcoin.stackexchange.com/questions/103664/what-is-the-purpose-of-the-recovery-id-in-an-ecdsa-signature)
- [Foundry vm.sign Documentation](https://getfoundry.sh/reference/cheatcodes/sign)

