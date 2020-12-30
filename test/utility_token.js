const BN = require('bn.js'); // https://github.com/indutny/bn.js
const BigNumber = require('bignumber.js');
const util = require('util');
const UtilityToken = artifacts.require("UtilityToken");
const UtilityTokenMock = artifacts.require("UtilityTokenMock");
const ERC20MintableToken = artifacts.require("ERC20Mintable");
const ERC20MintableToken2 = artifacts.require("ERC20Mintable");
const UtilityTokenFactory = artifacts.require("UtilityTokenFactory");
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
    
        

    it('should deployed correctly with correctly owner', async () => {
        const ERC20MintableToken2Instance = await ERC20MintableToken.new('t2','t2');
        const utilityTokenInstance = await UtilityToken.new('t1','t1', ERC20MintableToken2Instance.address);
        
        const owner = (await utilityTokenInstance.owner.call());
        assert.equal(owner, accountOne, 'owner is not accountOne');
        
    });

    it('should used transferOwnership by owner only', async () => {
        const ERC20MintableToken2Instance = await ERC20MintableToken.new('t2','t2');
        const utilityTokenInstance = await UtilityToken.new('t1','t1', ERC20MintableToken2Instance.address);
      
        await truffleAssert.reverts(
            utilityTokenInstance.transferOwnership(accountTwo, { from: accountTwo }), 
            "Ownable: caller is not the owner."
        );
        
        await utilityTokenInstance.transferOwnership(accountTwo, { from: accountOne });
    });

    it('should add address TokenForClaiming to list', async () => {
        const ERC20MintableToken2Instance = await ERC20MintableToken.new('t2','t2');
        const utilityTokenInstance = await UtilityToken.new('t1','t1', ERC20MintableToken2Instance.address);
        const ERC20MintableTokenInstance = await ERC20MintableToken.new('t2','t2');
        
        
        await truffleAssert.reverts(
            utilityTokenInstance.claimingTokenAdd(ERC20MintableTokenInstance.address, maxClaimingSpeed, maxClaimingFrequency, ownerCanWithdraw, ownerThrottleWithdraw, exchangeRate, { from: accountTwo }), 
            "Ownable: caller is not the owner."
        );
        
        await truffleAssert.reverts(
            utilityTokenInstance.claimingTokenAdd(accountThree, maxClaimingSpeed, maxClaimingFrequency, ownerCanWithdraw, ownerThrottleWithdraw, exchangeRate, { from: accountOne }), 
            "tokenForClaiming must be a contract address"
        );
        // add to claim list
        await utilityTokenInstance.claimingTokenAdd(ERC20MintableTokenInstance.address, maxClaimingSpeed, maxClaimingFrequency, ownerCanWithdraw, ownerThrottleWithdraw, exchangeRate, { from: accountOne });
        
        let list = (await utilityTokenInstance.claimingTokensView({ from: accountOne }));
        
        assert.notEqual(
            list.indexOf(ERC20MintableTokenInstance.address),
            -1,
            "TokenForClaiming does not added in list as expected");
    });

    it('should revert claim if it wasn\'t approve tokens before', async () => {
        // setup
        const ERC20MintableToken2Instance = await ERC20MintableToken.new('t2','t2');
        const utilityTokenInstance = await UtilityToken.new('t1','t1', ERC20MintableToken2Instance.address);
        const ERC20MintableTokenInstance = await ERC20MintableToken.new('t2','t2');
        
        const grantAmount = (10*10**18).toString(16);
        
        // add to claim list
        await utilityTokenInstance.claimingTokenAdd(ERC20MintableTokenInstance.address, maxClaimingSpeed, maxClaimingFrequency, ownerCanWithdraw, ownerThrottleWithdraw, exchangeRate, { from: accountOne });
        
        // mint to ERC20MintableToken
        await ERC20MintableTokenInstance.mint(accountTwo, '0x'+grantAmount, { from: accountOne });
        
        //
        await truffleAssert.reverts(
            utilityTokenInstance.claim({ from: accountTwo }), 
            "Amount exceeds allowed balance"
        );
    });

    it('should revert claim if it wasn\'t added TokenForClaiming before', async () => {
        // setup
        const ERC20MintableToken2Instance = await ERC20MintableToken.new('t2','t2');
        const utilityTokenInstance = await UtilityToken.new('t1','t1', ERC20MintableToken2Instance.address);
        const ERC20MintableTokenInstance = await ERC20MintableToken.new('t2','t2');
        
        const grantAmount = (10*10**18).toString(16);
        
        // mint to ERC20MintableToken
        await ERC20MintableTokenInstance.mint(accountTwo, '0x'+grantAmount, { from: accountOne });
        
        //make approve
        await ERC20MintableTokenInstance.approve(utilityTokenInstance.address, '0x'+grantAmount, { from: accountTwo });
        
        //
        await truffleAssert.reverts(
            utilityTokenInstance.claim({ from: accountTwo }), 
            "There are no allowed tokens for claiming"
        );
        
    });

    it('should claim to account', async () => {
      
        // setup
        const ERC20MintableToken2Instance = await ERC20MintableToken.new('t2','t2');
        const utilityTokenInstance = await UtilityToken.new('t1','t1', ERC20MintableToken2Instance.address);
        const ERC20MintableTokenInstance = await ERC20MintableToken.new('t2','t2');
        const currentBlockInfo = await web3.eth.getBlock("latest");
        const grantAmount = (10*10**18).toString(16);
        const claimCorrectRateAmount = (5*10**18).toString(16);
        
     
         // Get initial balances of second account.
        const accountTwoStartingBalance = (await utilityTokenInstance.balanceOf.call(accountTwo));
        
         // add to claim list
        await utilityTokenInstance.claimingTokenAdd(ERC20MintableTokenInstance.address, maxClaimingSpeed, maxClaimingFrequency, ownerCanWithdraw, ownerThrottleWithdraw, exchangeRate, { from: accountOne });
        
        // mint to ERC20MintableToken
        await ERC20MintableTokenInstance.mint(accountTwo, '0x'+grantAmount, { from: accountOne });
        
        //make approve with exceed rate
        await ERC20MintableTokenInstance.approve(utilityTokenInstance.address, '0x'+grantAmount, { from: accountTwo });

        // claim()
        await truffleAssert.reverts(
            utilityTokenInstance.claim({ from: accountTwo }), 
            "Amount exceeds available claiming rates limit."
        );
        
        // now approve correctly
        await ERC20MintableTokenInstance.approve(utilityTokenInstance.address, '0x'+claimCorrectRateAmount, { from: accountTwo });

        // claim()
        await utilityTokenInstance.claim({ from: accountTwo });

        
        // Get balances of first and second account after the transactions.
        const accountTwoEndingBalance = (await utilityTokenInstance.balanceOf.call(accountTwo));

        assert.equal(
            new BN(accountTwoEndingBalance,16).toString(16),
            (new BN(accountTwoStartingBalance,16)).add(new BN(claimCorrectRateAmount,16)).toString(16), 
            "Amount wasn't correctly sent to the receiver"
        );

    });    

    it('should add/remove to/from whitelist ', async () => {
        const ERC20MintableToken2Instance = await ERC20MintableToken.new('t2','t2');
        const utilityTokenInstance = await UtilityToken.new('t1','t1',ERC20MintableToken2Instance.address);
        var existAccountTwoInWhitelist,existAccountThreeInWhitelist;
        
        // add accountTwo and check
        await utilityTokenInstance.whitelistAdd([accountTwo], { from: accountOne });
        existAccountTwoInWhitelist = (await utilityTokenInstance.isWhitelisted.call(accountTwo));
        assert.equal(existAccountTwoInWhitelist, true, "Account was not added in whitelist");
        
        // remove accountTwo after adding before  and check
        await utilityTokenInstance.whitelistRemove([accountTwo], { from: accountOne });
        existAccountTwoInWhitelist = (await utilityTokenInstance.isWhitelisted.call(accountTwo));
        assert.notEqual(existAccountTwoInWhitelist, true, "Account was not removed in whitelist");
        
        // adding batch accountTwo and accountThree  and check
        await utilityTokenInstance.whitelistAdd([accountTwo,accountThree], { from: accountOne });
        existAccountTwoInWhitelist = (await utilityTokenInstance.isWhitelisted.call(accountTwo));
        existAccountThreeInWhitelist = (await utilityTokenInstance.isWhitelisted.call(accountThree));
        assert.equal(existAccountTwoInWhitelist && existAccountThreeInWhitelist, true, "Accounts were not added in whitelist");
        
        await utilityTokenInstance.whitelistRemove([accountTwo,accountThree], { from: accountOne });
        existAccountTwoInWhitelist = (await utilityTokenInstance.isWhitelisted.call(accountTwo));
        existAccountThreeInWhitelist = (await utilityTokenInstance.isWhitelisted.call(accountThree));
        assert.notEqual(utilityTokenInstance && existAccountThreeInWhitelist, true, "Accounts were not added in whitelist");
        
    });
    
    it('should add/remove to/from whitelist by owner only', async () => {
        const ERC20MintableToken2Instance = await ERC20MintableToken.new('t2','t2');
        const utilityTokenInstance = await UtilityToken.new('t1','t1',ERC20MintableToken2Instance.address);
        
        await truffleAssert.reverts(
            utilityTokenInstance.whitelistAdd([accountTwo], { from: accountTwo }), 
            "Ownable: caller is not the owner."
        );
        
        await truffleAssert.reverts(
            utilityTokenInstance.whitelistRemove([accountTwo], { from: accountThree }), 
            "Ownable: caller is not the owner."
        );
        
    });

    it('should exchange Token/Token2', async () => {
        const ERC20MintableToken2Instance = await ERC20MintableToken.new('t2','t2');
        const utilityTokenInstance = await UtilityTokenMock.new('t1','t1',ERC20MintableToken2Instance.address);
        const amountT2SendToContract = (10*10**18).toString(16);; // 10 token2
        
        
        
        const instanceToken2StartingBalance = (await ERC20MintableToken2Instance.balanceOf.call(utilityTokenInstance.address));
        const instanceToken1StartingBalance = (await utilityTokenInstance.totalSupply());
        // Get initial token balances of second account.
        const accountTwoToken1StartingBalance = (await utilityTokenInstance.balanceOf.call(accountTwo));
        const accountTwoToken2StartingBalance = (await ERC20MintableToken2Instance.balanceOf.call(accountTwo));
        
        
        await ERC20MintableToken2Instance.mint(accountTwo, '0x'+amountT2SendToContract, { from: accountOne });
        
        
        // send Token2 to Contract
        await ERC20MintableToken2Instance.approve(utilityTokenInstance.address, '0x'+amountT2SendToContract, { from: accountTwo });
        await utilityTokenInstance.receiveReserveToken(false, { from: accountTwo });
        //---
        const instanceToken2EndingBalance = (await ERC20MintableToken2Instance.balanceOf.call(utilityTokenInstance.address));
        const instanceToken1EndingBalance = (await utilityTokenInstance.totalSupply());
        // Get initial token balances of second account.
        const accountTwoToken1EndingBalance = (await utilityTokenInstance.balanceOf.call(accountTwo));
        const accountTwoToken2EndingBalance = (await ERC20MintableToken2Instance.balanceOf.call(accountTwo));
        
        assert.equal(
            (new BN(instanceToken2StartingBalance+'',16).add(new BN(amountT2SendToContract+'',16))).toString(16), 
            (new BN(instanceToken2EndingBalance, 16)).toString(16),
            'Сontract does not receive token2'
        );
        
        let sellExchangeRate = await utilityTokenInstance.getSellExchangeRate();
        let buyExchangeRate = await utilityTokenInstance.getBuyExchangeRate();
        sellExchangeRate = ((new BN(sellExchangeRate+'',10)).div(new BN(10000+'',10))).toString(10);
        buyExchangeRate = ((new BN(buyExchangeRate+'',10)).div(new BN(10000+'',10))).toString(10);

        
        assert.equal(
            (new BN(amountT2SendToContract+'',16).mul(new BN(buyExchangeRate+'',16)).div(new BN(100+'',16))).toString(16), 
            (new BN(accountTwoToken1EndingBalance, 10)).toString(16),
            'Token\'s count are wrong'
        );

        await truffleAssert.reverts(
            utilityTokenInstance.transfer(utilityTokenInstance.address, '0x'+(new BN(accountTwoToken1EndingBalance+'',10)).toString(16), { from: accountTwo }), 
            "Sender is not in whitelist"
        );
        
        await utilityTokenInstance.whitelistAdd([accountTwo], { from: accountOne });
        
        // try again send token back to contract 
        // await utilityTokenInstance.transfer(utilityTokenInstance.address, '0x'+(new BN(accountTwoToken1EndingBalance+'',10)).toString(16), { from: accountTwo });
        await truffleAssert.reverts(
            utilityTokenInstance.transfer(utilityTokenInstance.address, '0x'+(new BN(accountTwoToken1EndingBalance+'',10)).toString(16), { from: accountTwo }), 
            "Amount exceeds available reserve token limit."
        );
        
        let reserveTokenLimitPerDay = await utilityTokenInstance.getReserveTokenLimitPerDay();
        
        let token2Transfer =  BigNumber(parseInt(accountTwoToken1EndingBalance)).times(BigNumber(reserveTokenLimitPerDay)).div(BigNumber(1e6))
        
        await utilityTokenInstance.transfer(utilityTokenInstance.address, '0x'+(new BN(token2Transfer+'',10)).toString(16), { from: accountTwo });
        
        await truffleAssert.reverts(
            utilityTokenInstance.transfer(utilityTokenInstance.address, '0x'+(new BN(token2Transfer+'',10)).toString(16), { from: accountTwo }), 
            "Available only one time in 24h."
        );
        
        
        
        const instanceToken2EndingBalance2 = (await ERC20MintableToken2Instance.balanceOf.call(utilityTokenInstance.address));
        const instanceToken1EndingBalance2 = (await utilityTokenInstance.totalSupply());
        // Get initial token balances of second account.
        const accountTwoToken1EndingBalance2 = (await utilityTokenInstance.balanceOf.call(accountTwo));
        const accountTwoToken2EndingBalance2 = (await ERC20MintableToken2Instance.balanceOf.call(accountTwo));
        
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
