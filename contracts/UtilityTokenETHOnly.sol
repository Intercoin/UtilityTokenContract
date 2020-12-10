pragma solidity >=0.6.0 <0.7.0;

import "./UtilityBase.sol";

contract UtilityTokenETHOnly is UtilityBase {
    
    /**
     * @param name Token name
     * @param symbol Token symbol
     * 
     */
    constructor (
        string memory name, 
        string memory symbol
    ) 
        UtilityBase(name, symbol) 
        public 
    {
        // override variables can be here
        claimLockupPercent = 50e4;
        _sellExchangeRate = 50e4;
        // ------------------------------
    }
    
    /**
     * Used for donate ETH without receiving token
     */
    function donateETH() public payable validGasPrice nonReentrant() {
    }


    /**
     * @dev overall balance (in this case - eth)
     */
    function _overallBalance2() internal view virtual override returns(uint256) {
        return address(this).balance;
    }
    
    /**
     * @dev internal overrided method. eth will be transfer to sender
     * @param amount2send amount of eth
     */
    function _receivedTokenAfter(uint256 amount2send) internal virtual override {
        address payable addr1 = payable(_msgSender()); // correct since Solidity >= 0.6.0
        bool success = addr1.send(amount2send);
        require(success == true, 'Transfer ether was failed'); 
    }
    
    /**
     * @dev getting ETH and send back tokens
     * @param ethAmount ether amount
     */
    function _receivedETH(uint256 ethAmount) internal virtual override {
        //uint256 amount2send = ethAmount.mul(buyExchangeRate()).div(1e6); // "buy exchange" interpretation with rate 100%
        //_mint(_msgSender(), amount2send);
        _mintedOwnTokens(ethAmount);
    }  
    
}


