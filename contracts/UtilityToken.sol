pragma solidity >=0.6.0 <0.7.0;
import "./CommonConstants.sol";
import "./UtilityBase.sol";

contract UtilityToken is UtilityBase {
    using Address for address;
    
    address private token2;
    
    /**
     * @param name Token name
     * @param symbol Token symbol
     * @param reserveToken ReserveToken address instead ETH
     * 
     */
    constructor (
        string memory name, 
        string memory symbol,
        address reserveToken
    ) 
        UtilityBase(name, symbol) 
        public 
    {
        require(reserveToken.isContract(), 'secondary_token must be a contract address');
        token2 = reserveToken;
        
        // override variables can be here
        // ------------------------------
    }
    
    // 
    /**
     * Recieved ether 
     */
    receive() external payable override validGasPrice {
        require (true == true, "This method is not supported"); 
    }

    /**
     * @dev getting token2 and mint instead own tokens
     * proceeded if user set allowance in reserveToken contract
     * @param isDonate if set true, contract will not send tokens
     */
    function receiveERC20Token2(bool isDonate) validGasPrice public nonReentrant() {
        uint256 _allowedAmount = IERC20(token2).allowance(_msgSender(), address(this));
        
        require(_allowedAmount > 0, 'Amount exceeds allowed balance');
        
        // try to get
        bool success = IERC20(token2).transferFrom(_msgSender(), address(this), _allowedAmount);
        require(success == true, 'Transfer tokens were failed'); 
        if (!isDonate) {
            _receivedToken2(_allowedAmount);
        }
    }
    /**
     * @dev internal overrided method. token2 will be transfer to sender
     * @param amount2send amount of tokens
     */
    function _receivedTokenAfter(uint256 amount2send) internal virtual override {
        bool success = IERC20(token2).transfer(_msgSender(),amount2send);
        require(success == true, 'Transfer tokens were failed');    
    }
    
    /**
     * @dev overall tokens(token2) balance of this contract
     */
    function _overallBalance2() internal view virtual override returns(uint256) {
        return IERC20(token2).balanceOf(address(this));
    }
    
    /**
     * @dev overall tokens(token2) balance of this contract
     */
    function _receivedToken2(uint256 token2Amount) private {
        _mintedOwnTokens(token2Amount);
    }  
    
   
}

