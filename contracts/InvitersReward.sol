// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.7.0;

import "./interfaces/ICommunity.sol";
import "./openzeppelin-contracts/contracts/math/SafeMath.sol";

contract InvitersReward {
    
    using SafeMath for uint256;
    
    
    ICommunity community;
    uint256 inviterCommission;
    
    uint256 multiplier;
    
    event RewardAdded(address to, uint256 amount);
    event RewardExceed(address to);
    
    /**
     * @param _community address community
     * @param _inviterCommission commission mul by 1e6
     * 
     */
    constructor (
        ICommunity _community, 
        uint256 _inviterCommission
    ) 
        
        public 
    {
        require(_inviterCommission < 100e6, "can not be more or equeal 100%");
        community = _community;
        inviterCommission = _inviterCommission;
        
        multiplier = 1e6;
    }

    function invitersRewardProceed(
        address recipient,
        uint256 reserveTokenAmount
    )
        internal
        returns(uint256 left)
    {
        left = reserveTokenAmount;
        if (address(community) == address(0) || inviterCommission == uint256(0) ) {
        } else {
            
            address invitedAddress = ICommunity(community).whoInvited(recipient);
            if (invitedAddress != address(0)) {
                
                uint256 surplus = reserveTokenAmount.mul(inviterCommission).div(multiplier);    
                
                if (surplus == 0) {
                    emit RewardExceed(invitedAddress);
                } else {
                    invitersRewardTransfer(invitedAddress, surplus);
                    emit RewardAdded(invitedAddress, surplus);
                }
                
                left = reserveTokenAmount.sub(surplus);
                
            }
        }
        
    }
    
    function invitersRewardTransfer(
        address recipient,
        uint256 amount2send
    ) 
        internal 
        virtual 
    {
        // implemented in child
    }
    
}
    