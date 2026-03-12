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
    error InvalidAddr();
    error InvalidAmount();

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
        uint256 value; //value of ether to send
        bool executed; //check for execution
        uint256 approvalCount;
    }

    Transaction[] public allTransactions;
    mapping(uint256 => mapping(address => bool)) public approvalStatus;
    mapping(address => bool) public isOwner;

    //state variable
    address[] public owners;
    uint256 public requiredNumberOfSigners;
    // address public deployer;

    //events
    event Deposit(address indexed sender, uint256 amount);
    event SubmitTxn(uint256 indexed txId);
    event ApproveTxn(address indexed owner, uint256 indexed txId);
    event Revert(address indexed owner, uint256 indexed txId);
    event Execute(uint256 indexed txId);

    //constructor
    constructor(address[] memory _owners, uint256 _requiredNumberOfSigners) {
        // if (_owners.length < 0) {
        //     revert CustomError()
        // }
        require(_owners.length > 0, "Number of signers checked");
        require(_requiredNumberOfSigners > 0, "Number of signers not required");
        require(_requiredNumberOfSigners <= _owners.length, "invalid number of signers");

        for (uint256 i = 0; i < _owners.length; i++) {
            address owner = _owners[i];
            require(owner != address(0), "Invalid owner");
            require(!isOwner[owner], "Owner not unique");
            isOwner[owner] = true;
            owners.push(owner);
        }

        requiredNumberOfSigners = _requiredNumberOfSigners; // used to know how many approvals are required.
    }
    //modifier
    modifier OnlyOwner() {
        if (!isOwner[msg.sender]) revert NotOwner();
        _;
    }

    modifier txExists(uint256 txId) {
        if (txId >= allTransactions.length) revert TransactionDoesNotExist();
        _;
    }

    modifier notExecuted(uint256 txId) {
        if (allTransactions[txId].executed) {
            revert TransactionAlreadyExecuted();
        }
        _;
    }

    function submitTransaction(address _to, uint256 _value) external OnlyOwner {
        uint256 txId = allTransactions.length;
        if (_to == address(0)) revert InvalidAddr();
        if (_value < 0) revert InvalidAmount();

        // Transaction memory newTxn = Transaction({id:txId,to: _to, value: _value, executed: false, approvalCount: 0});
        Transaction memory newTxn = Transaction(txId, _to, _value, false, 0);
        allTransactions.push(newTxn);
        approvalStatus[txId][msg.sender] = false;
        //Approved:
        // {1: {0x0: false}}
        // {2: {0x0: false}}

        // emit Submit(allTransactions.length - 1);
        emit SubmitTxn(txId);
    }

    function approveTransaction(uint256 txId) external OnlyOwner txExists(txId) notExecuted(txId) {
        if (approvalStatus[txId][msg.sender] = true) {
            revert TransactionAlreadyApproved();
        }

        allTransactions[txId].approvalCount++;
        emit ApproveTxn(msg.sender, txId);
    }

    function notApproval(uint256 txId) external OnlyOwner txExists(txId) notExecuted(txId) {
        if (!approvalStatus[txId][msg.sender]) {
            revert TransactionNotApproved();
        }
        approvalStatus[txId][msg.sender] = false;
        allTransactions[txId].approvalCount--;

        emit Revert(msg.sender, txId);
    }
}

