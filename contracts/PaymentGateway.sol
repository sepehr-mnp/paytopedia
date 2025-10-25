// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title PaymentGateway
 * @dev Service contract that manages user payment addresses and facilitates
 * token collection via EIP-7702 delegated code execution.
 */
contract PaymentGateway {
    address public owner;
    address public hotWallet;
    address public tokenTransfererImpl;

    // Mapping to track which addresses are payment addresses for which users
    mapping(address => string) public addressToUserId;
    mapping(string => address[]) public userIdToAddresses;

    event PaymentAddressCreated(string indexed userId, address indexed paymentAddress);
    event TokensCollected(address indexed from, address indexed to, address indexed token, uint256 amount);
    event HotWalletUpdated(address indexed newHotWallet);
    event TokenTransfererUpdated(address indexed newImplementation);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this");
        _;
    }

    constructor(address _hotWallet, address _tokenTransfererImpl) {
        require(_hotWallet != address(0), "Invalid hot wallet");
        require(_tokenTransfererImpl != address(0), "Invalid token transferer");

        owner = msg.sender;
        hotWallet = _hotWallet;
        tokenTransfererImpl = _tokenTransfererImpl;
    }

    /**
     * @dev Register a payment address for a user (service creates address off-chain)
     * @param userId The user identifier
     * @param paymentAddress The payment address for this user
     */
    function registerPaymentAddress(string calldata userId, address paymentAddress) external onlyOwner {
        require(paymentAddress != address(0), "Invalid payment address");
        require(bytes(userId).length > 0, "Invalid user ID");

        addressToUserId[paymentAddress] = userId;
        userIdToAddresses[userId].push(paymentAddress);

        emit PaymentAddressCreated(userId, paymentAddress);
    }

    /**
     * @dev Get all payment addresses for a user
     * @param userId The user identifier
     */
    function getUserAddresses(string calldata userId) external view returns (address[] memory) {
        return userIdToAddresses[userId];
    }

    /**
     * @dev Update the hot wallet address
     * @param _newHotWallet The new hot wallet address
     */
    function setHotWallet(address _newHotWallet) external onlyOwner {
        require(_newHotWallet != address(0), "Invalid hot wallet");
        hotWallet = _newHotWallet;
        emit HotWalletUpdated(_newHotWallet);
    }

    /**
     * @dev Update the token transferer implementation
     * @param _newImplementation The new token transferer implementation
     */
    function setTokenTransfererImpl(address _newImplementation) external onlyOwner {
        require(_newImplementation != address(0), "Invalid implementation");
        tokenTransfererImpl = _newImplementation;
        emit TokenTransfererUpdated(_newImplementation);
    }

    /**
     * @dev Transfer ownership
     * @param _newOwner The new owner address
     */
    function transferOwnership(address _newOwner) external onlyOwner {
        require(_newOwner != address(0), "Invalid new owner");
        owner = _newOwner;
    }
}
