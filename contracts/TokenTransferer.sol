// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title TokenTransferer
 * @dev This contract is designed to be delegated to via EIP-7702.
 * When delegated, the wallet's code is replaced with this contract's code,
 * allowing the service to call transfer() to send all token balances to a recipient.
 */
contract TokenTransferer {
    /**
     * @dev Transfers all tokens from the delegated address to the recipient
     * @param token The ERC20 token address
     * @param recipient The address to receive the tokens
     */
    function transfer(address token, address recipient) public {
        require(token != address(0), "Invalid token address");
        require(recipient != address(0), "Invalid recipient address");

        // Get the balance of this address (the delegated wallet)
        uint256 balance = IERC20(token).balanceOf(address(this));
        require(balance > 0, "No tokens to transfer");

        // Transfer all tokens to the recipient
        bool success = IERC20(token).transfer(recipient, balance);
        require(success, "Token transfer failed");
    }

    /**
     * @dev Transfers multiple tokens to a recipient in a single transaction
     * @param tokens Array of ERC20 token addresses
     * @param recipient The address to receive all tokens
     */
    function transferMultiple(address[] calldata tokens, address recipient) public {
        require(recipient != address(0), "Invalid recipient address");
        require(tokens.length > 0, "No tokens specified");

        for (uint256 i = 0; i < tokens.length; i++) {
            address token = tokens[i];
            require(token != address(0), "Invalid token address");

            uint256 balance = IERC20(token).balanceOf(address(this));
            if (balance > 0) {
                bool success = IERC20(token).transfer(recipient, balance);
                require(success, "Token transfer failed");
            }
        }
    }

    /**
     * @dev Fallback function to accept ETH
     */
    receive() external payable {}
}
