pragma solidity >=0.6.0 <0.7.0;

//import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/token/ERC20/ERC20.sol";
//import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/access/Ownable.sol";
import "./github/OpenZeppelin/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import "./github/OpenZeppelin/openzeppelin-contracts/contracts/access/Ownable.sol";

import "./Whitelist.sol";
import "./CommonConstants.sol";

contract UtilityBase is ERC20, Ownable, CommonConstants, Whitelist {
    using SafeMath for uint256;
    using Address for address;
    
    uint256 public maxGasPrice = 1 * DECIMALS;
    
    uint256 latestBlockNumber;
    
    uint256 constant grantMorePerBlock = 10 * DECIMALS;
    
    // initial amount that can be granted by contract without transactions failing
    uint256 constant grantInitialMax = 1000000 * DECIMALS;
    
    // amount that can be granted one-time by contract without transactions failing
    uint256 tokensGrantOneTimeLimit = 1000000 * DECIMALS;
    
    // consider total token2 balance held at start of block when sending, grant fails if we would have new token1outstanding * exchangeRate > token2balance * (100 - this number) / 100
    // In other words this is minimum reserve requirements
    uint256 grantReserveMinPercent = 20; 
    
    uint256 grantReserveExchangeRate = 99e4; // grant discount
    
    uint256 tokensAmountToGrant;

    // user allowance
    mapping (address => uint256) private _uaTokensPerBlock;
    mapping (address => uint256) private _uaBlockNumber;
    mapping (address => uint256) private _uaTokensToTransfer;
    
    /**
     * @param name Token name
     * @param symbol Token symbol
     * 
     */
    constructor (
        string memory name, 
        string memory symbol
    ) 
        ERC20(name, symbol) 
        Whitelist() 
        public 
    {
        tokensAmountToGrant = grantInitialMax;
        latestBlockNumber = block.number;
    }
    
    modifier validGasPrice() {
        require(tx.gasprice <= maxGasPrice, "Transaction gas price cannot exceed maximum gas price.");
        _;
    } 
    
    // 
    /**
     * Recieved ether and transfer token to sender
     */
    receive() external payable virtual validGasPrice {
        _receivedETH(msg.value);
    }
    
    /**
     * Setting maximum Gas Price
     * @param gasPrice maximum Gas Price(in wei) used for transaction
     */
    function setMaxGasPrice(uint256 gasPrice) public onlyOwner {
        maxGasPrice = gasPrice;
    }
    
   
    /**
     * grant tokens to recipient with restriction limit to transfer
     * Note that owner have restriction limit to mint too.
     * 
     * @dev if tokensRatio == 0 then tokensRatio = amount; 
     * it means that all tokens will be available in next block
     * 
     * @param account recipient address
     * @param amount token amount
     * @param tokensRatio tokens count available to recipient with each mined block
     */
    function grant(address account, uint256 amount, uint256 tokensRatio) public onlyOwner {
        uint256 availableTokens = availableTokensToGrant();

        require(availableTokens >= amount, 'There are no available tokens to grant');
        require(tokensGrantOneTimeLimit >= amount, 'Too many tokens to grant in one transaction');
        
        
        if (totalSupply() > grantInitialMax) {
            require(
                totalSupply().mul(grantReserveExchangeRate).div(1e6) <= _overallBalance2().mul(100-grantReserveMinPercent).div(100), 
                'Amount exceeds available reserve limit' 
            );
        }
        
        _mint(account, amount);
        
        if (account != address(this)) {
            if (tokensRatio == 0) {
                tokensRatio = amount;
            }

            if (_uaBlockNumber[account] != 0) {
                _uaTokensToTransfer[account] = getUserAllowance(account);
            }
            _uaBlockNumber[account] = block.number;
            _uaTokensPerBlock[account] = tokensRatio;
        }
        
        latestBlockNumber = block.number;
        tokensAmountToGrant = availableTokens.sub(amount);
    }
    
    /**
     * count of tokens which available to mint by owner 
     * @return amount count of tokens which available to mint by owner 
     */
    function availableTokensToGrant() public view returns(uint256 amount) {
        amount = tokensAmountToGrant.add(((block.number).sub(latestBlockNumber)).mul(grantMorePerBlock));
    }
    
    /**
     * count of tokens which available to transfer by account
     * @param account recipient
     * @return destinationCount available tokens 
     */
    function getUserAllowance(address account) public view returns (uint256 destinationCount) {
    
        destinationCount = (_uaTokensToTransfer[account]).add(((block.number).sub(_uaBlockNumber[account])).mul(_uaTokensPerBlock[account]));
        
        if (balanceOf(account) <= destinationCount) {
            destinationCount = balanceOf(account);
        }
    }
    
    /**
     * Overrided {ERC20-transfer} method.
     * There are added some features:
     * 1. added validation of restriction limit to transfer
     * 2. if recipient is self contract than we will 
     *      get tokens, burn it and transfer eth to sender (if whitelisted)
     *      In all over cases its simple ERC20 Transfer
     * 
     * @param recipient recipient
     * @param amount amount
     * @return success
     */
    function transfer(address recipient, uint256 amount) public virtual override returns (bool) {
        if (recipient != address(this)) {
            uint256 allowanceTokens = getUserAllowance(_msgSender());
            require(allowanceTokens>=amount, 'There are no allowance tokens to transfer');
            
            _uaBlockNumber[_msgSender()] = block.number;
            _uaTokensToTransfer[_msgSender()] = allowanceTokens.sub(amount);
            
        }
        _transfer(_msgSender(), recipient, amount);
        
        if (recipient == address(this)) {
            _receivedToken(amount);
            _burn(address(this), amount);
        }
        
        return true;
    }
    
    function _overallBalance2() internal virtual returns(uint256) {
        // need to be implement in child
        return 0;
    }
    
    /**
     * @dev private method. getting Tokens and send back eth(token2)
     * Available only to recipient in whitelist
     * @param tokensAmount tokens amount
     */
    function _receivedToken(uint256 tokensAmount) internal onlyWhitelist {
        
        uint256 balanceToken2 = _overallBalance2();
        uint256 amount2send = tokensAmount.mul(sellExchangeRate()).div(1e6); // "sell exchange" interpretation with rate discount
        require ((amount2send <= balanceToken2 && balanceToken2>0), 'Amount exceeds available balance.');
        
        _receivedTokenAfter(amount2send);
        
    }
    
    function _receivedTokenAfter(uint256 amount2send) internal virtual {
        // need to be implement in child
    }  
    
    
    /**
     * @dev private method. getting ETH and send back minted tokens
     * @param ethAmount ether amount
     */
    function _receivedETH(uint256 ethAmount) internal virtual {
        // need to be implement in child
    }  
    
    function sellExchangeRate() internal virtual returns(uint256) {
        // need to be implement in child
        return uint256(1e6);
    }
    function buyExchangeRate() internal virtual returns(uint256) {
        // need to be implement in child
        return uint256(1e6);
    }  
    function _mintedOwnTokens(uint256 amount) internal {
        uint256 amount2mint = amount.mul(buyExchangeRate()).div(1e6); // "buy exchange" interpretation with rate 100%
        _mint(_msgSender(), amount2mint);
    } 
}



