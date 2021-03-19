const BN = require('bn.js'); // https://github.com/indutny/bn.js
const BigNumber = require('bignumber.js');
const util = require('util');
const UtilityToken = artifacts.require("UtilityToken");
const UtilityTokenMock = artifacts.require("UtilityTokenMock");
const ERC20MintableToken = artifacts.require("ERC20Mintable");
const ERC20MintableToken2 = artifacts.require("ERC20Mintable");
const CommunityMock = artifacts.require("CommunityMock");
const truffleAssert = require('truffle-assertions');
const helper = require("../helpers/truffleTestHelper");
//0x0000000000000000000000000000000000000000
contract('UtilityToken', (accounts) => {
    
    // Setup accounts.
    const accountOne = accounts[0];
    const accountTwo = accounts[1];  
    const accountThree = accounts[2];  
    const maxClaimingSpeed = 500000; //50e4
    const maxClaimingFrequency = 86400; //1day;
    const ownerCanWithdraw = true;
    const ownerThrottleWithdraw = 15768000; // 60*60*24*365/2,  6 motnhs;
    const exchangeRate = 1000000; //100e4
    const inviterCommission = 30000; // 3% mul 1e6

    var utilityTokenETHOnlyInstance;
    var ERC20MintableTokenInstance;
	var ERC20MintableToken2Instance;
	var CommunityMockInstance;
	
    beforeEach(async() =>{
        this.CommunityMockInstance = await CommunityMock.new();
        this.ERC20MintableTokenInstance = await ERC20MintableToken.new('t2','t2');
        this.ERC20MintableToken2Instance = await ERC20MintableToken.new('t2','t2');
        this.utilityTokenInstance = await UtilityTokenMock.new('t1','t1', this.ERC20MintableToken2Instance.address, this.CommunityMockInstance.address, inviterCommission);
    });
   
    it('should deployed correctly with correctly owner', async () => {
        
        const owner = (await this.utilityTokenInstance.owner.call());
        assert.equal(owner, accountOne, 'owner is not accountOne');
        
    });

    it('should used transferOwnership by owner only', async () => {
        
        await truffleAssert.reverts(
            this.utilityTokenInstance.transferOwnership(accountTwo, { from: accountTwo }), 
            "Ownable: caller is not the owner."
        );
        
        await this.utilityTokenInstance.transferOwnership(accountTwo, { from: accountOne });
    });

    it('should add address TokenForClaiming to list', async () => {
        
        await truffleAssert.reverts(
            this.utilityTokenInstance.claimingTokenAdd(this.ERC20MintableTokenInstance.address, maxClaimingSpeed, maxClaimingFrequency, ownerCanWithdraw, ownerThrottleWithdraw, exchangeRate, { from: accountTwo }), 
            "Ownable: caller is not the owner."
        );
        
        await truffleAssert.reverts(
            this.utilityTokenInstance.claimingTokenAdd(accountThree, maxClaimingSpeed, maxClaimingFrequency, ownerCanWithdraw, ownerThrottleWithdraw, exchangeRate, { from: accountOne }), 
            "tokenForClaiming must be a contract address"
        );
        // add to claim list
        await this.utilityTokenInstance.claimingTokenAdd(this.ERC20MintableTokenInstance.address, maxClaimingSpeed, maxClaimingFrequency, ownerCanWithdraw, ownerThrottleWithdraw, exchangeRate, { from: accountOne });
        
        let list = (await this.utilityTokenInstance.claimingTokensView({ from: accountOne }));
        
        assert.notEqual(
            list.indexOf(this.ERC20MintableTokenInstance.address),
            -1,
            "TokenForClaiming does not added in list as expected");
    });

    it('should revert claim if it wasn\'t approve tokens before', async () => {
        
        const grantAmount = (10*10**18).toString(16);
        
        // add to claim list
        await this.utilityTokenInstance.claimingTokenAdd(this.ERC20MintableTokenInstance.address, maxClaimingSpeed, maxClaimingFrequency, ownerCanWithdraw, ownerThrottleWithdraw, exchangeRate, { from: accountOne });
        
        // mint to ERC20MintableToken
        await this.ERC20MintableTokenInstance.mint(accountTwo, '0x'+grantAmount, { from: accountOne });
        
        //
        await truffleAssert.reverts(
            this.utilityTokenInstance.claim({ from: accountTwo }), 
            "Amount exceeds allowed balance"
        );
    });

    it('should revert claim if it wasn\'t added TokenForClaiming before', async () => {
        
        const grantAmount = (10*10**18).toString(16);
        
        // mint to ERC20MintableToken
        await this.ERC20MintableTokenInstance.mint(accountTwo, '0x'+grantAmount, { from: accountOne });
        
        //make approve
        await this.ERC20MintableTokenInstance.approve(this.utilityTokenInstance.address, '0x'+grantAmount, { from: accountTwo });
        
        //
        await truffleAssert.reverts(
            this.utilityTokenInstance.claim({ from: accountTwo }), 
            "There are no allowed tokens for claiming"
        );
        
    });

    it('should claim to account', async () => {
      
        const currentBlockInfo = await web3.eth.getBlock("latest");
        const grantAmount = (10*10**18).toString(16);
        const claimCorrectRateAmount = (5*10**18).toString(16);
        
     
         // Get initial balances of second account.
        const accountTwoStartingBalance = (await this.utilityTokenInstance.balanceOf.call(accountTwo));
        
         // add to claim list
        await this.utilityTokenInstance.claimingTokenAdd(this.ERC20MintableTokenInstance.address, maxClaimingSpeed, maxClaimingFrequency, ownerCanWithdraw, ownerThrottleWithdraw, exchangeRate, { from: accountOne });
        
        // mint to ERC20MintableToken
        await this.ERC20MintableTokenInstance.mint(accountTwo, '0x'+grantAmount, { from: accountOne });
        
        //make approve with exceed rate
        await this.ERC20MintableTokenInstance.approve(this.utilityTokenInstance.address, '0x'+grantAmount, { from: accountTwo });

        // claim()
        await truffleAssert.reverts(
            this.utilityTokenInstance.claim({ from: accountTwo }), 
            "Amount exceeds available claiming rates limit."
        );
        
        // now approve correctly
        await this.ERC20MintableTokenInstance.approve(this.utilityTokenInstance.address, '0x'+claimCorrectRateAmount, { from: accountTwo });

        // claim()
        await this.utilityTokenInstance.claim({ from: accountTwo });

        
        // Get balances of first and second account after the transactions.
        const accountTwoEndingBalance = (await this.utilityTokenInstance.balanceOf.call(accountTwo));

        assert.equal(
            new BN(accountTwoEndingBalance,16).toString(16),
            (new BN(accountTwoStartingBalance,16)).add(new BN(claimCorrectRateAmount,16)).toString(16), 
            "Amount wasn't correctly sent to the receiver"
        );

    });    

    it('should add/remove to/from whitelist ', async () => {
        
        var existAccountTwoInWhitelist,existAccountThreeInWhitelist;
        
        // add accountTwo and check
        await this.utilityTokenInstance.whitelistAdd([accountTwo], { from: accountOne });
        existAccountTwoInWhitelist = (await this.utilityTokenInstance.isWhitelisted.call(accountTwo));
        assert.equal(existAccountTwoInWhitelist, true, "Account was not added in whitelist");
        
        // remove accountTwo after adding before  and check
        await this.utilityTokenInstance.whitelistRemove([accountTwo], { from: accountOne });
        existAccountTwoInWhitelist = (await this.utilityTokenInstance.isWhitelisted.call(accountTwo));
        assert.notEqual(existAccountTwoInWhitelist, true, "Account was not removed in whitelist");
        
        // adding batch accountTwo and accountThree  and check
        await this.utilityTokenInstance.whitelistAdd([accountTwo,accountThree], { from: accountOne });
        existAccountTwoInWhitelist = (await this.utilityTokenInstance.isWhitelisted.call(accountTwo));
        existAccountThreeInWhitelist = (await this.utilityTokenInstance.isWhitelisted.call(accountThree));
        assert.equal(existAccountTwoInWhitelist && existAccountThreeInWhitelist, true, "Accounts were not added in whitelist");
        
        await this.utilityTokenInstance.whitelistRemove([accountTwo,accountThree], { from: accountOne });
        existAccountTwoInWhitelist = (await this.utilityTokenInstance.isWhitelisted.call(accountTwo));
        existAccountThreeInWhitelist = (await this.utilityTokenInstance.isWhitelisted.call(accountThree));
        assert.notEqual(this.utilityTokenInstance && existAccountThreeInWhitelist, true, "Accounts were not added in whitelist");
        
    });
    
    it('should add/remove to/from whitelist by owner only', async () => {
        
        await truffleAssert.reverts(
            this.utilityTokenInstance.whitelistAdd([accountTwo], { from: accountTwo }), 
            "Ownable: caller is not the owner."
        );
        
        await truffleAssert.reverts(
            this.utilityTokenInstance.whitelistRemove([accountTwo], { from: accountThree }), 
            "Ownable: caller is not the owner."
        );
        
    });

    it('should exchange Token/Token2', async () => {
        
        const amountT2SendToContract = (10*10**18).toString(16);; // 10 token2
        
        const instanceToken2StartingBalance = (await this.ERC20MintableToken2Instance.balanceOf.call(this.utilityTokenInstance.address));
        const instanceToken1StartingBalance = (await this.utilityTokenInstance.totalSupply());
        // Get initial token balances of second account.
        const accountTwoToken1StartingBalance = (await this.utilityTokenInstance.balanceOf.call(accountTwo));
        const accountTwoToken2StartingBalance = (await this.ERC20MintableToken2Instance.balanceOf.call(accountTwo));
        
        
        await this.ERC20MintableToken2Instance.mint(accountTwo, '0x'+amountT2SendToContract, { from: accountOne });
        
        
        // send Token2 to Contract
        await this.ERC20MintableToken2Instance.approve(this.utilityTokenInstance.address, '0x'+amountT2SendToContract, { from: accountTwo });
        await this.utilityTokenInstance.receiveReserveToken(false, { from: accountTwo });
        //---
        const instanceToken2EndingBalance = (await this.ERC20MintableToken2Instance.balanceOf.call(this.utilityTokenInstance.address));
        const instanceToken1EndingBalance = (await this.utilityTokenInstance.totalSupply());
        // Get initial token balances of second account.
        const accountTwoToken1EndingBalance = (await this.utilityTokenInstance.balanceOf.call(accountTwo));
        const accountTwoToken2EndingBalance = (await this.ERC20MintableToken2Instance.balanceOf.call(accountTwo));
        
        assert.equal(
            (new BN(instanceToken2StartingBalance+'',16).add(new BN(amountT2SendToContract+'',16))).toString(16), 
            (new BN(instanceToken2EndingBalance, 16)).toString(16),
            'Сontract does not receive token2'
        );
        
        let sellExchangeRate = await this.utilityTokenInstance.getSellExchangeRate();
        let buyExchangeRate = await this.utilityTokenInstance.getBuyExchangeRate();
        sellExchangeRate = ((new BN(sellExchangeRate+'',10)).div(new BN(10000+'',10))).toString(10);
        buyExchangeRate = ((new BN(buyExchangeRate+'',10)).div(new BN(10000+'',10))).toString(10);

        
        assert.equal(
            (new BN(amountT2SendToContract+'',16).mul(new BN(buyExchangeRate+'',16)).div(new BN(100+'',16))).toString(16), 
            (new BN(accountTwoToken1EndingBalance, 10)).toString(16),
            'Token\'s count are wrong'
        );

        await truffleAssert.reverts(
            this.utilityTokenInstance.transfer(this.utilityTokenInstance.address, '0x'+(new BN(accountTwoToken1EndingBalance+'',10)).toString(16), { from: accountTwo }), 
            "Sender is not in whitelist"
        );
        
        await this.utilityTokenInstance.whitelistAdd([accountTwo], { from: accountOne });
        
        // try again send token back to contract 
        // await this.utilityTokenInstance.transfer(this.utilityTokenInstance.address, '0x'+(new BN(accountTwoToken1EndingBalance+'',10)).toString(16), { from: accountTwo });
        await truffleAssert.reverts(
            this.utilityTokenInstance.transfer(this.utilityTokenInstance.address, '0x'+(new BN(accountTwoToken1EndingBalance+'',10)).toString(16), { from: accountTwo }), 
            "Amount exceeds available reserve token limit."
        );
        
        let reserveTokenLimitPerDay = await this.utilityTokenInstance.getReserveTokenLimitPerDay();
        
        let token2Transfer =  BigNumber(parseInt(accountTwoToken1EndingBalance)).times(BigNumber(reserveTokenLimitPerDay)).div(BigNumber(1e6))
        
        await this.utilityTokenInstance.transfer(this.utilityTokenInstance.address, '0x'+(new BN(token2Transfer+'',10)).toString(16), { from: accountTwo });
        
        await truffleAssert.reverts(
            this.utilityTokenInstance.transfer(this.utilityTokenInstance.address, '0x'+(new BN(token2Transfer+'',10)).toString(16), { from: accountTwo }), 
            "Available only one time in 24h."
        );
        
        const instanceToken2EndingBalance2 = (await this.ERC20MintableToken2Instance.balanceOf.call(this.utilityTokenInstance.address));
        const instanceToken1EndingBalance2 = (await this.utilityTokenInstance.totalSupply());
        // Get initial token balances of second account.
        const accountTwoToken1EndingBalance2 = (await this.utilityTokenInstance.balanceOf.call(accountTwo));
        const accountTwoToken2EndingBalance2 = (await this.ERC20MintableToken2Instance.balanceOf.call(accountTwo));
        
        assert.equal(
            (
                BigNumber(parseInt(accountTwoToken1EndingBalance2))
            ).toString(), 
            (
                BigNumber(parseInt(accountTwoToken1EndingBalance)).minus(BigNumber(token2Transfer))
            ).toString(), 
            
            'Tokens were not transfered to contract'
        );
        
        assert.equal(
            
            (
                BigNumber(parseInt(instanceToken1EndingBalance2))
            ).toString(), 
            (
                BigNumber(parseInt(instanceToken1EndingBalance)).minus(BigNumber(token2Transfer))
            ).toString(), 
            'Contract does not burn tokens'
        );

        assert.equal(
            (
                (
                    new BN(instanceToken2EndingBalance, 10)).sub(
                        new BN(token2Transfer+'',10).mul(new BN(sellExchangeRate+'',10)).div(new BN(100+'',10))
                    )
                ).toString(16), 
            (new BN(instanceToken2EndingBalance2, 10)).toString(16),
            'token2 left at contract is wrong'
        );
        
        
    });    
    
});
