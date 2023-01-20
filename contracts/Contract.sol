// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@thirdweb-dev/contracts/extension/Permissions.sol";
import "@thirdweb-dev/contracts/base/ERC20SignatureMintVote.sol";

contract Contract is ERC20SignatureMintVote, Permissions {
    bytes32 public constant NUMBER_ROLE = keccak256("NUMBER_ROLE");

    uint256 public number;

    //We are creating a Boolean to control whether or not the ability to mint
    bool public allowSale;

    constructor(
        string memory _name,
        string memory _symbol,
        address _primarySaleRecipient
    ) ERC20SignatureMintVote(_name, _symbol, _primarySaleRecipient) {
        //We are setting up our Admin role
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    //Function to start the sell
    function startSale(bool _allowSale) public onlyRole(DEFAULT_ADMIN_ROLE) {
        allowSale = _allowSale;
    }

    function subtract(uint256 a) public onlyRole(NUMBER_ROLE) {
        number -= a;
    }

    //Add override that allows us to implement some logic before this function is called on the original contract
    function mintTo(address _to, uint256 _amount) public virtual override {
        require(allowSale == true, "Minting currently closed!");

        //Allows to call the function back on the original contract
        super.mintTo(_to, _amount);
    }
}
