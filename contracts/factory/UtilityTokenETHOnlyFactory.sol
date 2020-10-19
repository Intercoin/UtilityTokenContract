pragma solidity >=0.6.0 <0.7.0;

import "../openzeppelin-contracts/contracts/access/Ownable.sol";
import "../UtilityTokenETHOnly.sol";

contract UtilityTokenETHOnlyFactory is Ownable{
    
    UtilityTokenETHOnly[] public utilityTokenETHOnlyAddresses;
    
    event UtilityTokenETHOnlyCreated(UtilityTokenETHOnly utilityTokenETHOnly);

    function createUtilityTokenETHOnly
    (
        string memory name, 
        string memory symbol
    ) 
        public 
    {
        UtilityTokenETHOnly utilityTokenETHOnly = new UtilityTokenETHOnly(name, symbol);
        utilityTokenETHOnlyAddresses.push(utilityTokenETHOnly);
        emit UtilityTokenETHOnlyCreated(utilityTokenETHOnly);
        utilityTokenETHOnly.transferOwnership(_msgSender());
    }
    
}
