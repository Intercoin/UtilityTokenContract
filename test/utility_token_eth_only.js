const BN = require('bn.js'); // https://github.com/indutny/bn.js
const util = require('util');
const UtilityTokenETHOnly = artifacts.require("UtilityTokenETHOnly");
const UtilityTokenETHOnlyMock = artifacts.require("UtilityTokenETHOnlyMock");
const ERC20MintableToken = artifacts.require("ERC20Mintable");
const UtilityTokenETHOnlyFactory = artifacts.require("UtilityTokenETHOnlyFactory");
const truffleAssert = require('truffle-assertions');
const helper = require("../helpers/truffleTestHelper");

contract('UtilityTokenETHOnly', (accounts) => {
    
    // Setup accounts.
    const accountOne = accounts[0];
    const accountTwo = accounts[1];  
    const accountThree = accounts[2];  

    it('should deployed correctly with correctly owner', async () => {
        const utilityTokenETHOnlyInstance = await UtilityTokenETHOnly.new('t1','t1');
        
        const owner = (await utilityTokenETHOnlyInstance.owner.call());
        assert.equal(owner, accountOne, 'owner is not accountOne');
        
    });
    
    it('should used transferOwnership by owner only', async () => {
        const utilityTokenETHOnlyInstance = await UtilityTokenETHOnly.new('t1','t1');
      
        await truffleAssert.reverts(
            utilityTokenETHOnlyInstance.transferOwnership(accountTwo, { from: accountTwo }), 
            "Ownable: caller is not the owner."
        );
        
        await utilityTokenETHOnlyInstance.transferOwnership(accountTwo, { from: accountOne });
    });

    it('should add address TokenForClaiming to list', async () => {
        const utilityTokenETHOnlyInstance = await UtilityTokenETHOnly.new('t1','t1');
        const ERC20MintableTokenInstance = await ERC20MintableToken.new('t2','t2');
        
        await truffleAssert.reverts(
            utilityTokenETHOnlyInstance.claimingTokenAdd(ERC20MintableTokenInstance.address, { from: accountTwo }), 
            "Ownable: caller is not the owner."
        );
        
        await truffleAssert.reverts(
            utilityTokenETHOnlyInstance.claimingTokenAdd(accountThree, { from: accountOne }), 
            "tokenForClaiming must be a contract address"
        );
        // add to claim list
        await utilityTokenETHOnlyInstance.claimingTokenAdd(ERC20MintableTokenInstance.address, { from: accountOne });
        
        let list = (await utilityTokenETHOnlyInstance.claimingTokensView({ from: accountOne }));
        
        assert.notEqual(
            list.indexOf(ERC20MintableTokenInstance.address),
            -1,
            "TokenForClaiming does not added in list as expected");
    });

    it('should revert claim if it wasn\'t approve tokens before', async () => {
        // setup
        const utilityTokenETHOnlyInstance = await UtilityTokenETHOnly.new('t1','t1');
        const ERC20MintableTokenInstance = await ERC20MintableToken.new('t2','t2');
        
        const grantAmount = (10*10**18).toString(16);
        
        // add to claim list
        await utilityTokenETHOnlyInstance.claimingTokenAdd(ERC20MintableTokenInstance.address, { from: accountOne });
        
        // mint to ERC20MintableToken
        await ERC20MintableTokenInstance.mint(accountTwo, '0x'+grantAmount, { from: accountOne });
        
        //
        await truffleAssert.reverts(
            utilityTokenETHOnlyInstance.claim({ from: accountTwo }), 
            "Amount exceeds allowed balance"
        );
    });
    
    it('should revert claim if it wasn\'t added TokenForClaiming before', async () => {
        // setup
        const utilityTokenETHOnlyInstance = await UtilityTokenETHOnly.new('t1','t1');
        const ERC20MintableTokenInstance = await ERC20MintableToken.new('t2','t2');
        
        const grantAmount = (10*10**18).toString(16);
        
        // mint to ERC20MintableToken
        await ERC20MintableTokenInstance.mint(accountTwo, '0x'+grantAmount, { from: accountOne });
        
        //make approve
        await ERC20MintableTokenInstance.approve(utilityTokenETHOnlyInstance.address, '0x'+grantAmount, { from: accountTwo });
        
        //
        await truffleAssert.reverts(
            utilityTokenETHOnlyInstance.claim({ from: accountTwo }), 
            "There are no allowed tokens for claiming"
        );
        
    });

    it('should claim to account', async () => {
      
        // setup
        const utilityTokenETHOnlyInstance = await UtilityTokenETHOnly.new('t1','t1');
        const ERC20MintableTokenInstance = await ERC20MintableToken.new('t2','t2');
        const currentBlockInfo = await web3.eth.getBlock("latest");
        const grantAmount = (10*10**18).toString(16);
     
         // Get initial balances of second account.
        const accountTwoStartingBalance = (await utilityTokenETHOnlyInstance.balanceOf.call(accountTwo));
        
         // add to claim list
        await utilityTokenETHOnlyInstance.claimingTokenAdd(ERC20MintableTokenInstance.address, { from: accountOne });
        
        // mint to ERC20MintableToken
        await ERC20MintableTokenInstance.mint(accountTwo, '0x'+grantAmount, { from: accountOne });
        
        //make approve
        await ERC20MintableTokenInstance.approve(utilityTokenETHOnlyInstance.address, '0x'+grantAmount, { from: accountTwo });
        
        // claim()
        await utilityTokenETHOnlyInstance.claim({ from: accountTwo });
        
        // Get balances of first and second account after the transactions.
        const accountTwoEndingBalance = (await utilityTokenETHOnlyInstance.balanceOf.call(accountTwo));

        assert.equal(
            new BN(accountTwoEndingBalance,16).toString(16),
            (new BN(accountTwoStartingBalance,16)).add(new BN(grantAmount,16)).toString(16), 
            "Amount wasn't correctly sent to the receiver"
        );

    });    
 /*
    it('checking transfer limit none-gradual', async () => {
        // setup
        const countSecondsNeedToPass = 10000;
        const utilityTokenETHOnlyMockInstance = await UtilityTokenETHOnlyMock.new('t1','t1');
        await utilityTokenETHOnlyMockInstance.setClaimGradual(false, { from: accountTwo });
        await utilityTokenETHOnlyMockInstance.setClaimLockupPeriod(countSecondsNeedToPass, { from: accountTwo });
        const currentBlockInfo = await web3.eth.getBlock("latest");
        const grantAmount = (10*10**18).toString(16);
        
        
        const ERC20MintableTokenInstance = await ERC20MintableToken.new('t2','t2');
    
        // Make grant from first account to second. for 10000 seconds and gradual = false
        

        // claim mechanizm
        await utilityTokenETHOnlyMockInstance.claimingTokenAdd(ERC20MintableTokenInstance.address, { from: accountOne });
        await ERC20MintableTokenInstance.mint(accountTwo, '0x'+grantAmount, { from: accountOne });
        await ERC20MintableTokenInstance.approve(utilityTokenETHOnlyMockInstance.address, '0x'+grantAmount, { from: accountTwo });
        await utilityTokenETHOnlyMockInstance.claim({ from: accountTwo });
        //----------------
        //await utilityTokenETHOnlyInstance.grant(accountTwo, '0x'+grantAmount, startBlockNumber+countSecondsNeedToPass, false, { from: accountOne });

        // emulate skipping countSecondsNeedToPass/2

        await helper.advanceTime(countSecondsNeedToPass/2);
    
        // for now passed block spent countBlocksNeedToPass-1
        await truffleAssert.reverts(
            utilityTokenETHOnlyMockInstance.transfer(accountThree, '0x'+grantAmount, { from: accountTwo }), 
            "TransferLimit: There are no allowance tokens to transfer"
        );
        // after this pass another countSecondsNeedToPass/2 seconds
        await helper.advanceTime(countSecondsNeedToPass/2+1);
        
        // and transfer have to be available for account two
        await utilityTokenETHOnlyMockInstance.transfer(accountThree, '0x'+grantAmount, { from: accountTwo });
        
        // await truffleAssert.reverts(
        //     utilityTokenETHOnlyInstance.grant(accountTwo, '0x'+grantAmount, currentBlockInfo.number+100, false, { from: accountTwo }), 
        //     "Ownable: caller is not the owner."
        // );

    }); 

    it('checking transfer limit gradual', async () => {
        // setup
        const utilityTokenETHOnlyMockInstance = await UtilityTokenETHOnlyMock.new('t1','t1');
        const currentBlockInfo = await web3.eth.getBlock("latest");
        const grantAmount = (10*10**18).toString(16);
        const countSecondsNeedToPass = 10;
        await utilityTokenETHOnlyMockInstance.setClaimGradual(true, { from: accountTwo });
        await utilityTokenETHOnlyMockInstance.setClaimLockupPeriod(countSecondsNeedToPass, { from: accountTwo });
        const ERC20MintableTokenInstance = await ERC20MintableToken.new('t2','t2');


        // claim mechanizm
        await utilityTokenETHOnlyMockInstance.claimingTokenAdd(ERC20MintableTokenInstance.address, { from: accountOne });
        await ERC20MintableTokenInstance.mint(accountTwo, '0x'+grantAmount, { from: accountOne });
        await ERC20MintableTokenInstance.approve(utilityTokenETHOnlyMockInstance.address, '0x'+grantAmount, { from: accountTwo });

        await utilityTokenETHOnlyMockInstance.claim({ from: accountTwo });
        // emulate skipping countBlocksNeedToPass/2 seconds
        await helper.advanceTimeAndBlock(countSecondsNeedToPass/2);

        var lockupForNow = (await utilityTokenETHOnlyMockInstance.amountLockUp(accountTwo));

        var passedSecondsForNow = countSecondsNeedToPass/2; 
        var expectedLockup = (new BN(grantAmount,16))-(new BN(grantAmount,16)).div(new BN(countSecondsNeedToPass,10)).mul(new BN(passedSecondsForNow,10));
        
        assert.equal(
            lockupForNow.toString(16), 
            expectedLockup.toString(16), 
            "LockUp does not  equal to expected"
            );


        var lockupForNowNextSecond = (new BN(grantAmount,16))-(new BN(grantAmount,16)).div(new BN(countSecondsNeedToPass,10)).mul(new BN(passedSecondsForNow,10));

        await truffleAssert.reverts(
            utilityTokenETHOnlyMockInstance.transfer(accountThree, '0x'+(new BN(grantAmount.toString(10),16)).toString(16), { from: accountTwo }), 
            "TransferLimit: There are no allowance tokens to transfer"
        );


        await helper.advanceTimeAndBlock(countSecondsNeedToPass/2);
        
        passedSecondsForNow = countSecondsNeedToPass;
        
        // and transfer have to be available for account two
        expectedLockup = (new BN(grantAmount,16))-(new BN(grantAmount,16)).div(new BN(countSecondsNeedToPass,10)).mul(new BN(passedSecondsForNow,10));
        lockupForNow = (await utilityTokenETHOnlyMockInstance.amountLockUp.call(accountTwo));
        
        assert.equal(new BN(lockupForNow,16).toString(16), expectedLockup.toString(16), "LockUp does not  equal to expected");
        
        await utilityTokenETHOnlyMockInstance.transfer(accountThree, '0x'+((new BN(grantAmount.toString(16),16)).sub(new BN(expectedLockup.toString(16),16))).toString(16), { from: accountTwo }); 

    });      
  */
    it('should add/remove to/from whitelist ', async () => {
        const utilityTokenETHOnlyInstance = await UtilityTokenETHOnly.new('t1','t1');
        var existAccountTwoInWhitelist,existAccountThreeInWhitelist;
        
        // add accountTwo and check
        await utilityTokenETHOnlyInstance.whitelistAdd([accountTwo], { from: accountOne });
        existAccountTwoInWhitelist = (await utilityTokenETHOnlyInstance.isWhitelisted.call(accountTwo));
        assert.equal(existAccountTwoInWhitelist, true, "Account was not added in whitelist");
        
        // remove accountTwo after adding before  and check
        await utilityTokenETHOnlyInstance.whitelistRemove([accountTwo], { from: accountOne });
        existAccountTwoInWhitelist = (await utilityTokenETHOnlyInstance.isWhitelisted.call(accountTwo));
        assert.notEqual(existAccountTwoInWhitelist, true, "Account was not removed in whitelist");
        
        // adding batch accountTwo and accountThree  and check
        await utilityTokenETHOnlyInstance.whitelistAdd([accountTwo,accountThree], { from: accountOne });
        existAccountTwoInWhitelist = (await utilityTokenETHOnlyInstance.isWhitelisted.call(accountTwo));
        existAccountThreeInWhitelist = (await utilityTokenETHOnlyInstance.isWhitelisted.call(accountThree));
        assert.equal(existAccountTwoInWhitelist && existAccountThreeInWhitelist, true, "Accounts were not added in whitelist");
        
        await utilityTokenETHOnlyInstance.whitelistRemove([accountTwo,accountThree], { from: accountOne });
        existAccountTwoInWhitelist = (await utilityTokenETHOnlyInstance.isWhitelisted.call(accountTwo));
        existAccountThreeInWhitelist = (await utilityTokenETHOnlyInstance.isWhitelisted.call(accountThree));
        assert.notEqual(existAccountTwoInWhitelist && existAccountThreeInWhitelist, true, "Accounts were not added in whitelist");
        
    });
    
    it('should add/remove to/from whitelist by owner only', async () => {
        const utilityTokenETHOnlyInstance = await UtilityTokenETHOnly.new('t1','t1');
        
        await truffleAssert.reverts(
            utilityTokenETHOnlyInstance.whitelistAdd([accountTwo], { from: accountTwo }), 
            "Ownable: caller is not the owner."
        );
        
        await truffleAssert.reverts(
            utilityTokenETHOnlyInstance.whitelistRemove([accountTwo], { from: accountThree }), 
            "Ownable: caller is not the owner."
        );
        
    });
    
    it('should exchange Token/ETH', async () => {
        const utilityTokenETHOnlyInstance = await UtilityTokenETHOnly.new('t1','t1');
        const amountETHSendToContract = 10*10**18; // 10ETH
        
        
        const instanceETHStartingBalance = (await web3.eth.getBalance(utilityTokenETHOnlyInstance.address));
        const instanceETHStartingTotalSupply = (await utilityTokenETHOnlyInstance.totalSupply());
         // Get initial token balances of second account.
        const accountTwoTokenStartingBalance = (await utilityTokenETHOnlyInstance.balanceOf.call(accountTwo));
        const accountTwoETHStartingBalance = (await web3.eth.getBalance(accountTwo));
        
        // send ETH to Contract
        await web3.eth.sendTransaction({
            from:accountTwo,
            to: utilityTokenETHOnlyInstance.address, 
            value: amountETHSendToContract
            
        });
        
        const instanceETHEndingBalance = (await web3.eth.getBalance(utilityTokenETHOnlyInstance.address));
        const instanceETHEndingTotalSupply = (await utilityTokenETHOnlyInstance.totalSupply());
         // Get initial token balances of second account.
        const accountTwoTokenEndingBalance = (await utilityTokenETHOnlyInstance.balanceOf.call(accountTwo));
        const accountTwoETHEndingBalance = (await web3.eth.getBalance(accountTwo));
        
        assert.equal(
            (new BN(instanceETHStartingBalance+'',10).add(new BN(amountETHSendToContract+'',10))).toString(16), 
            (new BN(instanceETHEndingBalance, 10)).toString(16),
            'Сontract does not receive eth'
        );
        const sellExchangeRate = 99;
        const buyExchangeRate = 100;
        
        assert.equal(
            (new BN(amountETHSendToContract+'',10).mul(new BN(buyExchangeRate+'',10)).div(new BN(100+'',10))).toString(16), 
            (new BN(accountTwoTokenEndingBalance, 10)).toString(16),
            'Token\'s count are wrong'
        );
        
        await truffleAssert.reverts(
            utilityTokenETHOnlyInstance.transfer(utilityTokenETHOnlyInstance.address, '0x'+(new BN(accountTwoTokenEndingBalance+'',10)).toString(16), { from: accountTwo }), 
            "Sender is not in whitelist"
        );
        
        await utilityTokenETHOnlyInstance.whitelistAdd([accountTwo], { from: accountOne });
        
        // try again send token back to contract 
        await utilityTokenETHOnlyInstance.transfer(utilityTokenETHOnlyInstance.address, '0x'+(new BN(accountTwoTokenEndingBalance+'',10)).toString(16), { from: accountTwo });
        
        const instanceETHEndingBalance2 = (await web3.eth.getBalance(utilityTokenETHOnlyInstance.address));
        const instanceETHEndingTotalSupply2 = (await utilityTokenETHOnlyInstance.totalSupply());
         // Get initial token balances of second account.
        const accountTwoTokenEndingBalance2 = (await utilityTokenETHOnlyInstance.balanceOf.call(accountTwo));
        const accountTwoETHEndingBalance2 = (await web3.eth.getBalance(accountTwo));
        
        assert.equal(
            new BN(accountTwoTokenEndingBalance2+'',10).toString(16), 
            new BN(0+'',10).toString(16), 
            'Tokens were not transfered to contract'
        );
        
        assert.equal(
            new BN(instanceETHEndingTotalSupply2+'',10).toString(16), 
            new BN(instanceETHStartingTotalSupply+'',10).toString(16), 
            'Contract does not burn tokens'
        );
        
         assert.equal(
            (
                (
                    new BN(instanceETHEndingBalance, 10)).sub(
                        new BN(accountTwoTokenEndingBalance+'',10).mul(new BN(sellExchangeRate+'',10)).div(new BN(100+'',10))
                    )
                ).toString(16), 
            (new BN(instanceETHEndingBalance2, 10)).toString(16),
            'eth left at contract is wrong'
        );
        
    });    

    it('should deployed correctly with correctly owner through factory', async () => {
        
        const utilityTokenETHOnlyFactoryInstance = await UtilityTokenETHOnlyFactory.new({ from: accountThree });
        await utilityTokenETHOnlyFactoryInstance.createUtilityTokenETHOnly('t1','t1', { from: accountOne });
        
        var utilityTokenETHOnlyAddress; 
        await utilityTokenETHOnlyFactoryInstance.getPastEvents('UtilityTokenETHOnlyCreated', {
            filter: {addr: accountOne}, // Using an array in param means OR: e.g. 20 or 23
            fromBlock: 0,
            toBlock: 'latest'
        }, function(error, events){ })
        .then(function(events){
            
            utilityTokenETHOnlyAddress = events[0].returnValues['utilityTokenETHOnly'];
        });
        console.log(utilityTokenETHOnlyAddress);
        
        let utilityTokenETHOnlyInstance = await UtilityTokenETHOnly.at(utilityTokenETHOnlyAddress);
        
        
        
        const owner = (await utilityTokenETHOnlyInstance.owner());
        assert.equal(owner, accountOne, 'owner is not accountOne');
        
    });

  
});
