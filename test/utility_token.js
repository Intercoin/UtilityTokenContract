const BN = require('bn.js'); // https://github.com/indutny/bn.js
const util = require('util');
const UtilityToken = artifacts.require("UtilityToken");
const UtilityTokenMock = artifacts.require("UtilityTokenMock");
const ERC20MintableToken = artifacts.require("ERC20Mintable");
const ERC20MintableToken2 = artifacts.require("ERC20Mintable");
const UtilityTokenFactory = artifacts.require("UtilityTokenFactory");
const truffleAssert = require('truffle-assertions');
//0x0000000000000000000000000000000000000000
contract('UtilityToken', (accounts) => {
    
    // Setup accounts.
    const accountOne = accounts[0];
    const accountTwo = accounts[1];  
    const accountThree = accounts[2];  

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
            utilityTokenInstance.claimingTokenAdd(ERC20MintableTokenInstance.address, { from: accountTwo }), 
            "Ownable: caller is not the owner."
        );
        
        await truffleAssert.reverts(
            utilityTokenInstance.claimingTokenAdd(accountThree, { from: accountOne }), 
            "tokenForClaiming must be a contract address"
        );
        // add to claim list
        await utilityTokenInstance.claimingTokenAdd(ERC20MintableTokenInstance.address, { from: accountOne });
        
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
        await utilityTokenInstance.claimingTokenAdd(ERC20MintableTokenInstance.address, { from: accountOne });
        
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
     
         // Get initial balances of second account.
        const accountTwoStartingBalance = (await utilityTokenInstance.balanceOf.call(accountTwo));
        
         // add to claim list
        await utilityTokenInstance.claimingTokenAdd(ERC20MintableTokenInstance.address, { from: accountOne });
        
        // mint to ERC20MintableToken
        await ERC20MintableTokenInstance.mint(accountTwo, '0x'+grantAmount, { from: accountOne });
        
        //make approve
        await ERC20MintableTokenInstance.approve(utilityTokenInstance.address, '0x'+grantAmount, { from: accountTwo });
        
        // claim()
        await utilityTokenInstance.claim({ from: accountTwo });
        
        // Get balances of first and second account after the transactions.
        const accountTwoEndingBalance = (await utilityTokenInstance.balanceOf.call(accountTwo));

        assert.equal(
            new BN(accountTwoEndingBalance,16).toString(16),
            (new BN(accountTwoStartingBalance,16)).add(new BN(grantAmount,16)).toString(16), 
            "Amount wasn't correctly sent to the receiver"
        );

    });    

    it('checking transfer limit none-gradual', async () => {
        // setup
        const ERC20MintableToken2Instance = await ERC20MintableToken.new('t2','t2');
        const utilityTokenMockInstance = await UtilityTokenMock.new('t1','t1', ERC20MintableToken2Instance.address);
        await utilityTokenMockInstance.setGrantGradual(false, { from: accountTwo });
        const currentBlockInfo = await web3.eth.getBlock("latest");
        const grantAmount = (10*10**18).toString(16);
        const countBlocksNeedToPass = 100;
        const ERC20MintableTokenInstance = await ERC20MintableToken.new('t2','t2');
    
        // Make grant from first account to second. for 100 blocks and gradual = false
        // Note that currentBlockInfo - its block before for transaction below !!!  so plus 1 needed
        const startBlockNumber = currentBlockInfo.number+1;
        
        // claim mechanizm
        await utilityTokenMockInstance.claimingTokenAdd(ERC20MintableTokenInstance.address, { from: accountOne });
        await ERC20MintableTokenInstance.mint(accountTwo, '0x'+grantAmount, { from: accountOne });
        await ERC20MintableTokenInstance.approve(utilityTokenMockInstance.address, '0x'+grantAmount, { from: accountTwo });
        await utilityTokenMockInstance.claim({ from: accountTwo });
        //----------------
        //await utilityTokenETHOnlyInstance.grant(accountTwo, '0x'+grantAmount, startBlockNumber+countBlocksNeedToPass, false, { from: accountOne });
        
        // one block spent for transaction before so 
        // emulate skipping countBlocksNeedToPass-2 block
        for (let i = 0; i < countBlocksNeedToPass-2; i++) {
            await utilityTokenMockInstance.setMaxGasPrice('0x'+(1*10**18).toString(16),{ from: accountOne });    
        }
        
        // for now passed block spent countBlocksNeedToPass-1
        await truffleAssert.reverts(
            utilityTokenMockInstance.transfer(accountThree, '0x'+grantAmount, { from: accountTwo }), 
            "TransferLimit: There are no allowance tokens to transfer"
        );
        // after this block passed by 1
        await utilityTokenMockInstance.setMaxGasPrice('0x'+(1*10**18).toString(16),{ from: accountOne });    
        // and transfer have to be available for account two
        await utilityTokenMockInstance.transfer(accountThree, '0x'+grantAmount, { from: accountTwo });
        
        // await truffleAssert.reverts(
        //     utilityTokenETHOnlyInstance.grant(accountTwo, '0x'+grantAmount, currentBlockInfo.number+100, false, { from: accountTwo }), 
        //     "Ownable: caller is not the owner."
        // );

    }); 
     
    it('checking transfer limit gradual', async () => {
        // setup
        const ERC20MintableToken2Instance = await ERC20MintableToken.new('t2','t2');
        const utilityTokenInstance = await UtilityToken.new('t1','t1', ERC20MintableToken2Instance.address);
        const currentBlockInfo = await web3.eth.getBlock("latest");
        const grantAmount = (10*10**18).toString(16);
        const countBlocksNeedToPass = 100;
        const ERC20MintableTokenInstance = await ERC20MintableToken.new('t2','t2');

        // Make grant from first account to second. for 100 blocks and gradual = true
        // Note that currentBlockInfo - its block before for transaction below !!!  so plus 1 needed
        const startBlockNumber = currentBlockInfo.number+1;
        
        // claim mechanizm
        await utilityTokenInstance.claimingTokenAdd(ERC20MintableTokenInstance.address, { from: accountOne });
        await ERC20MintableTokenInstance.mint(accountTwo, '0x'+grantAmount, { from: accountOne });
        await ERC20MintableTokenInstance.approve(utilityTokenInstance.address, '0x'+grantAmount, { from: accountTwo });
        await utilityTokenInstance.claim({ from: accountTwo });
        //await utilityTokenETHOnlyInstance.grant(accountTwo, '0x'+grantAmount, startBlockNumber+countBlocksNeedToPass, true, { from: accountOne });

        // one block spent for transaction before so 
        // emulate skipping countBlocksNeedToPass/2-2 block
        for (let i = 0; i < countBlocksNeedToPass/2-2; i++) {
            await utilityTokenInstance.setMaxGasPrice('0x'+(1*10**18).toString(16),{ from: accountOne });    
        }

        var lockupForNow = (await utilityTokenInstance.amountLockUp.call(accountTwo));

        var passedBloсkForNow = countBlocksNeedToPass/2-2; // 3 blocks
        var expectedLockup = (new BN(grantAmount,16))-(new BN(grantAmount,16)).div(new BN(countBlocksNeedToPass,10)).mul(new BN(passedBloсkForNow,10));
        assert.equal(
            lockupForNow.toString(16), 
            expectedLockup.toString(16), 
            "LockUp does not  equal to expected"
            );


        var lockupForNowNextBlock = (new BN(grantAmount,16))-(new BN(grantAmount,16)).div(new BN(countBlocksNeedToPass,10)).mul(new BN(passedBloсkForNow+1,10));
        // now try to transfer for 1 wei more than (grantAmount-lockupForNowNextBlock)
        await truffleAssert.reverts(
            utilityTokenInstance.transfer(accountThree, '0x'+(new BN(grantAmount.toString(16),16).sub(new BN(lockupForNowNextBlock.toString(16),16)).add(new BN(1,10))).toString(16), { from: accountTwo }), 
            "TransferLimit: There are no allowance tokens to transfer"
        );

        // 1 block passed by revert
        passedBloсkForNow = passedBloсkForNow + 1;
        
        // and transfer have to be available for account two
        expectedLockup = (new BN(grantAmount,16))-(new BN(grantAmount,16)).div(new BN(countBlocksNeedToPass,10)).mul(new BN(passedBloсkForNow,10));
        lockupForNow = (await utilityTokenInstance.amountLockUp.call(accountTwo));
        
        assert.equal(new BN(lockupForNow,16).toString(16), expectedLockup.toString(16), "LockUp does not  equal to expected");
        
        await utilityTokenInstance.transfer(accountThree, '0x'+((new BN(grantAmount.toString(16),16)).sub(new BN(expectedLockup.toString(16),16))).toString(16), { from: accountTwo }); 

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
        const utilityTokenInstance = await UtilityToken.new('t1','t1',ERC20MintableToken2Instance.address);
        const amountT2SendToContract = (10*10**18).toString(16);; // 10 token2
        
        
        
        const instanceToken2StartingBalance = (await ERC20MintableToken2Instance.balanceOf.call(utilityTokenInstance.address));
        const instanceToken1StartingBalance = (await utilityTokenInstance.totalSupply());
        // Get initial token balances of second account.
        const accountTwoToken1StartingBalance = (await utilityTokenInstance.balanceOf.call(accountTwo));
        const accountTwoToken2StartingBalance = (await ERC20MintableToken2Instance.balanceOf.call(accountTwo));
        
        
        await ERC20MintableToken2Instance.mint(accountTwo, '0x'+amountT2SendToContract, { from: accountOne });
        
        
        // send Token2 to Contract
        await ERC20MintableToken2Instance.approve(utilityTokenInstance.address, '0x'+amountT2SendToContract, { from: accountTwo });
        await utilityTokenInstance.receiveERC20Token2(false, { from: accountTwo });
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
        
        const sellExchangeRate = 99;
        const buyExchangeRate = 100;
        
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
        await utilityTokenInstance.transfer(utilityTokenInstance.address, '0x'+(new BN(accountTwoToken1EndingBalance+'',10)).toString(16), { from: accountTwo });
        
        const instanceToken2EndingBalance2 = (await ERC20MintableToken2Instance.balanceOf.call(utilityTokenInstance.address));
        const instanceToken1EndingBalance2 = (await utilityTokenInstance.totalSupply());
        // Get initial token balances of second account.
        const accountTwoToken1EndingBalance2 = (await utilityTokenInstance.balanceOf.call(accountTwo));
        const accountTwoToken2EndingBalance2 = (await ERC20MintableToken2Instance.balanceOf.call(accountTwo));
        
        assert.equal(
            new BN(accountTwoToken1EndingBalance2+'',16).toString(16), 
            new BN(0+'',10).toString(16), 
            'Tokens were not transfered to contract'
        );
        
        assert.equal(
            new BN(instanceToken1EndingBalance2+'',16).toString(16), 
            new BN(accountTwoToken1EndingBalance2+'',16).toString(16), 
            'Contract does not burn tokens'
        );

        assert.equal(
            (
                (
                    new BN(instanceToken2EndingBalance, 10)).sub(
                        new BN(accountTwoToken1EndingBalance+'',10).mul(new BN(sellExchangeRate+'',10)).div(new BN(100+'',10))
                    )
                ).toString(16), 
            (new BN(instanceToken2EndingBalance2, 10)).toString(16),
            'token2 left at contract is wrong'
        );
        
        
    });    

    it('should deployed correctly with correctly owner through factory', async () => {
        
        const ERC20MintableToken2Instance = await ERC20MintableToken.new('t2','t2');
        const utilityTokenFactoryInstance = await UtilityTokenFactory.new({ from: accountThree });
        await utilityTokenFactoryInstance.createUtilityToken('t1','t1', ERC20MintableToken2Instance.address, { from: accountOne });
        
        var utilityTokenAddress; 
        await utilityTokenFactoryInstance.getPastEvents('UtilityTokenCreated', {
            filter: {addr: accountOne}, // Using an array in param means OR: e.g. 20 or 23
            fromBlock: 0,
            toBlock: 'latest'
        }, function(error, events){ /* console.log(events);*/ })
        .then(function(events){
            
            utilityTokenAddress = events[0].returnValues['utilityToken'];
        });

        let utilityTokenInstance = await UtilityToken.at(utilityTokenAddress);
        
        const owner = (await utilityTokenInstance.owner());
        assert.equal(owner, accountOne, 'owner is not accountOne');
        
    });
});
