pragma solidity >=0.6.0 <0.7.0;

import "./openzeppelin-contracts/contracts/math/SafeMath.sol";
import "./openzeppelin-contracts/contracts/access/Ownable.sol";

/**
 * Realization a addresses whitelist
 * 
 */
contract Whitelist is Ownable {
    using SafeMath for uint256;

    mapping(address => bool) list;

    modifier onlyWhitelist() {
        require(list[msg.sender] == true, "Sender is not in whitelist");
        _;
    }
   
    constructor () public {
        list[owner()] = true;
    }
    
    /**
     * Adding addresses list to whitelist 
     * 
     * @dev available to Owner only
     * Requirements:
     *
     * - `_addresses` cannot contains the zero address.
     * 
     * @param _addresses list of addresses which will be added to whitelist
     * @return success return true in any cases
     */
    function whitelistAdd(address[] memory _addresses) public onlyOwner returns (bool success) {
        for (uint i = 0; i < _addresses.length; i++) {
            require(_addresses[i] != address(0), "Whitelist: Contains the zero address");
            list[_addresses[i]] = true;
        }
        success = true;
    }
    
    /**
     * Removing addresses list from whitelist
     * 
     * @dev Available to Owner only
     * Requirements:
     *
     * - `_addresses` cannot contains the zero address.
     * 
     * @param _addresses list of addresses which will be removed from whitelist
     * @return success return true in any cases 
     */
    function whitelistRemove(address[] memory _addresses) public onlyOwner returns (bool success) {
        for (uint i = 0; i < _addresses.length; i++) {
            list[_addresses[i]] = false;
        }
        success = true;
    }

    /**
    * Checks if a address already exists in a whitelist
    * 
    * @param addr address
    * @return result return true if exist 
    */
    function isWhitelisted(address addr) public view returns (bool result) {
        result = list[addr];
    }
  
}