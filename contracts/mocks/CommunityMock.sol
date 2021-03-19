pragma solidity >=0.6.0 <0.7.0;
//pragma experimental ABIEncoderV2;


import "../interfaces/ICommunity.sol";

contract CommunityMock {
    
    address senderMock;
    
    function setSender(address sender) public  {
        senderMock = sender;
    }
    
    function isInvited(address sender, address recipient) external view returns(bool) {
        return (sender == senderMock ? true : false);
    }
    
    function whoInvited(address recipient) external view returns(address) {
        return senderMock;
    }
    
    
}
