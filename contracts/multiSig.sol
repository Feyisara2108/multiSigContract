// Layout of Contract:
// version
// imports
// errors
// interfaces, libraries, contracts
// Type declarations
// State variables
// Events
// Modifiers
// Functions

// Layout of Functions:
// constructor
// receive function (if exists)
// fallback function (if exists)
// external
// public
// internal
// private
// view & pure functions

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract MultiSig {
    //errors
    error NotOwner();
    error InvalidOwner();
    error TransactionExist();
    error TransactionDoesNotExist();
    error TransactionAlreadyApproved();
    error TransactionNotApproved();
    error TransactionAlreadyExecuted();
    error TransactionNotExecuted();
    error TransactionCancelled();

    //type declaration
    struct Transaction {
        uint256 id; //txId
        address to; //recipient
        bool executed; //check for execution
        uint256 approvalCount;
        uint256 value;
        data : data;
    }

    Transaction[] public transactions;
    mapping(uint256 => mapping(address => bool)) public approved;
    mapping(address => bool) public isOwner;

    //state variable
    address[] public owners;
    uint256 public __required;
    // address public deployer;

    //events
    event Deposit(address indexed sender, uint8 amount);
    event Submit(uint256 indexed txId);
    event Approve(address indexed owner, uint8 indexed txId);
    event Revert(address indexed owner, uint8 indexed txId);
    event Execute(uint8 indexed txId);

    //constructor
    constructor(address[] memory _owners, uint8 _requiredNumberOfSigners) {
        require(_owners.length > 0, "Number of signers checked");
        require(_requiredNumberOfSigners > 0, "Number of signers not required");
        require(_requiredNumberOfSigners <= _owners.length, "invalid number of signers");

        for (uint8 i = 0; i < _owners.length; i++) {
            address owner = _owners[i];
            require(owner != address(0), "Invalid owner");
            require(!isOwner[owner], "Owner not unique");
            isOwner[owner] = true;
            owners.push(owner);
        }

        required = _requiredNumberOfSigners; // used to know how many approvals are required.
    }
    //modifier
    modifier OnlyOwner() {
        if (!isOwner[msg.sender]) revert NotOwner();
        _;
    }

    modifier txExists(uint8 txId) {
        if (txId >= transactions.length) revert TransactionDoesNotExist();
        _;
    }

    modifier notExecuted(uint8 txId) {
        if (transactions[txId].executed) {
            revert TransactionAlreadyExecuted();
        }
        _;
    }

    function submitTransaction(address to, uint256 value, bytes calldata data) external OnlyOwner {
        uint256 txId = transactions.length;
        transactions.push(Transaction({to: to, value: value, bytes: data, executed: false, approvalCount: 0}));

        // emit Submit(transactions.length - 1);
        emit Submit(txId);
    }

        function approveTransaction(uint256 txId) external OnlyOwner txExists(txId) notExecuted(txId)  {
        if (approved[txId][msg.sender]) {
            revert TransactionAlreadyApproved();
        }
         approved[txId][msg.sender] = true; transactions[txId].approvalCount++;   emit Approve(msg.sender, txId);
    }
    }
 
// /// @notice Approve a pending transaction (owner‑only)
// function approveTransaction(uint256 txId)
//     external
//     onlyOwner
//     txExists(txId)
//     notExecuted(txId)
//     notApproved(txId)
// {
//     approved[txId][msg.sender] = true;
//     emit Approve(msg.sender, txId);
// }

// /// @notice Revoke a previously‑given approval (owner‑only)
// function revokeApproval(uint256 txId)
//     external
//     onlyOwner
//     txExists(txId)
//     notExecuted(txId)
// {
//     if (!approved[txId][msg.sender]) revert TransactionNotApproved();
//     approved[txId][msg.sender] = false;
//     emit Revoke(msg.sender, txId);
// }

