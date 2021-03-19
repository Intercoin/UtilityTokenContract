// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.7.0;

interface ICommunity {
                        
    function isInvited(address sender, address recipient) external view returns(bool) ;
    function whoInvited(address recipient) external view returns(address);

}