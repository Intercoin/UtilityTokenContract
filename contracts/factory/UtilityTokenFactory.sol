pragma solidity >=0.6.0 <0.7.0;

import "../UtilityToken.sol";

contract UtilityTokenFactory{
    
    //UtilityToken[] public utilityTokenAddresses;
    
    event UtilityTokenCreated(UtilityToken utilityToken);

    function createUtilityToken
    (
        string memory name, 
        string memory symbol,
        address secondary_token
    ) 
        public 
    {
        UtilityToken utilityToken = new UtilityToken(name, symbol, secondary_token);
        // utilityTokenAddresses.push(address(utilityToken));
        emit UtilityTokenCreated(utilityToken);
        // //utilityToken.transferOwnership(_msgSender());
        utilityToken.transferOwnership(msg.sender);
    }
    
}
