
const TimelockERC20 = artifacts.require('TimelockERC20Test');
const ERC20 = artifacts.require('ERC20');
const web3 = global.web3;
const uint = v => web3.toBigNumber(v)
const util = require('web3-utils');

async function assertRevert (promise) {
    try {
        await promise;
    } catch (error) {
        const revertFound = error.message.search('revert') >= 0;
        assert(revertFound, `Expected "revert", got ${error} instead`);
        return;
    }
    assert.fail('Expected revert not received');
}

contract('TimelockERC20', async(accounts) => {
    const admin = accounts[9];

    const owner = accounts[0];
    const recipient = accounts[1];

    const fromOwner = { from: owner };
    const fromRecipient = { from: recipient };
    const fromAdmin = { from: admin };

    let erc20;
    let contract;

    let now = Math.floor(Date.now()/1000);
    let minute = 60;
    let result;

    async function checkBalance(ownerBalance,recipientBalance,contractBalance) {
        let current = await erc20.balanceOf(owner)
        assert(current.eq(uint(ownerBalance)),`owner.balance(${current}) != ${ownerBalance}`)
        current = await erc20.balanceOf(recipient)
        assert(current.eq(uint(recipientBalance)),`recipient.balance(${current}) != ${recipientBalance}`)
        current = await erc20.balanceOf(contract.address)
        assert(current.eq(uint(contractBalance)),`contract.balance(${current}) != ${contractBalance}`)
    }

    beforeEach(async () => {
        // Creating ERC20 contract with 100 balance
        erc20 = await ERC20.new(uint(100))

        // Creating TimelockERC20 contract by admin
        contract = await TimelockERC20.new(erc20.address,fromAdmin)
    })

    it('should create contract', async() => {
        // Checking current balance
        let currentBalance = await erc20.balanceOf(owner)
        assert.equal(currentBalance,100)
    })
    it('approving 100 balance to send', async() => {
        // Approving
        await erc20.approve(owner,100)

        // Checking approved balance
        let allowedToTransfer = await erc20.allowance(owner,owner)
        assert.equal(allowedToTransfer,100)
    })
    it('sending 100 balance and unlocking now', async() => {
        // Checking current balance (sender,receiver,contract)
        await checkBalance(100,0,0)

        // Approving contract to take 100 from senders balance
        await erc20.approve(contract.address,uint(100))

        // Sending 100 to owner
        await contract.accept(owner, uint(now), uint(100))

        // Checking current balance (sender,receiver,contract)
        await checkBalance(0,0,100)
    })
    it('sending 100 balance locked for 1 minute', async() => {
        // Approving contract to take 100 from senders balance
        await erc20.approve(contract.address,uint(100))

        // Sending 100 to owner with minute timeout
        await contract.accept(recipient, uint(now+minute), uint(100))
    })
    it('sending 100 balance unlocked 1 minute ago', async() => {
        // Approving contract to take 100 from senders balance
        await erc20.approve(contract.address,uint(100))

        // Sending 100 to owner with -1 minute timeout
        await contract.accept(recipient, uint(now-minute), uint(100))
    })
    it('getting unlocked 100 balance', async() => {
        let time = uint(now-minute)

        // Approving contract to take 100 from senders balance
        await erc20.approve(contract.address,uint(100))

        // Sending 100 to recipient with -1 minute timeout
        await contract.accept(recipient, time, uint(100))

        // Checking current balance (sender,receiver,contract)
        await checkBalance(0,0,100)

        // Receiving balance
        await contract.release([time],[100],fromRecipient)

        // Checking current balance (sender,receiver,contract)
        await checkBalance(0,100,0)
    })
    it('trying to take locked 100 balance', async() => {
        let time = uint(now+minute)

        // Approving contract to take 100 from senders balance
        await erc20.approve(contract.address,uint(100))

        // Sending 100 to recipient with 1 minute timeout
        await contract.accept(recipient, time, uint(100))

        // Recipient trying to get his balance, but timeout is not ended
        await assertRevert(contract.release([time],[100],fromRecipient))

        // Checking current balance (sender,receiver,contract)
        await checkBalance(0,0,100)
    })
    it('waiting for unlock date and taking 100 balance', async() => {
        let time = uint(now+minute)

        // Approving contract to take 100 from senders balance
        await erc20.approve(contract.address,uint(100))

        // Sending 100 to recipient with 1 minute timeout
        await contract.accept(recipient, time, uint(100))

        // Checking current balance (sender,receiver,contract)
        await checkBalance(0,0,100)

        // Waiting 1 minute
        await contract.setTimestamp(time)

        // Receiving balance
        await contract.release([time],[100],fromRecipient)

        // Checking current balance (sender,receiver,contract)
        await checkBalance(0,100,0)
    })
    it('trying to take 100 balance, waiting and taking 100 balance', async() => {
        let time = uint(now+minute)

        // Approving contract to take 100 from senders balance
        await erc20.approve(contract.address,uint(100))

        // Sending 100 to recipient with 1 minute timeout
        await contract.accept(recipient, time, uint(100))

        // Recipient trying to get his balance, but timeout is not ended
        await assertRevert(contract.release([time],[100],fromRecipient))

        // Checking current balance (sender,receiver,contract)
        await checkBalance(0,0,100)

        // Waiting 1 minute
        await contract.setTimestamp(time)

        // Receiving balance
        await contract.release([time],[100],fromRecipient)

        // Checking current balance (sender,receiver,contract)
        await checkBalance(0,100,0)
    })
    it('sending 10 balance multiple times at the same timecode', async() => {
        let time = uint(now-minute)

        // Approving contract to take 100 from senders balance
        await erc20.approve(contract.address,uint(100))

        // Sending 10 to recipient 10 times with -1 minute timeout
        for (var i = 0; i < 10; i++) {
            await contract.accept(recipient, time, uint(10))
        }

        // Checking current balance (sender,receiver,contract)
        await checkBalance(0,0,100)

        // Receiving balance
        await contract.release([time],[100],fromRecipient)

        // Checking current balance (sender,receiver,contract)
        await checkBalance(0,100,0)
    })
    it('sending 10 balance multiple times at the different timecodes', async() => {
        // Approving contract to take 100 from senders balance
        await erc20.approve(contract.address,uint(100))
        let array = [];
        let values = [];
        for (var i = 1; i <= 10; i++) {
            let timecode = uint(now+minute*i)
            array.push(timecode)
            values.push(10)
            await contract.accept(recipient, timecode, uint(10))
        }

        // Checking current balance (sender,receiver,contract)
        await checkBalance(0,0,100)

        // Waiting 10 minutes
        await contract.setTimestamp(uint(now+minute*10))

        // Receiving balance
        await contract.release(array,values,fromRecipient)

        // Checking current balance (sender,receiver,contract)
        await checkBalance(0,100,0)
    })
    it('trying to take some balance from incompleted timecodes', async() => {
        // Approving contract to take 100 from senders balance
        await erc20.approve(contract.address,uint(100))

        let array = []
        let values = []
        for (var i = 1; i <= 10; i++) {
            let timecode = uint(now+minute*i)
            array.push(timecode)
            values.push(10)
            await contract.accept(recipient, timecode, uint(10))
        }

        // Checking current balance (sender,receiver,contract)
        await checkBalance(0,0,100)

        // Recipient trying to get his balance, but timeout is not ended
        await assertRevert(contract.release(array,values,fromRecipient))

        // Checking current balance (sender,receiver,contract)
        await checkBalance(0,0,100)
    })
    it('trying to take some balance from half incompleted and half completed timecodes', async() => {
        // Approving contract to take 100 from senders balance
        await erc20.approve(contract.address,uint(100))
        let array = []
        let values = []
        for (var i = 1; i <= 10; i++) {
            let timecode = uint(now+minute*i)
            array.push(timecode)
            values.push(10)
            await contract.accept(recipient, timecode, uint(10))
        }

        // Checking current balance (sender,receiver,contract)
        await checkBalance(0,0,100)

        // Waiting 5 minutes
        await contract.setTimestamp(uint(now+minute*5))

        // Recipient trying to get his balance, but timeout is not ended
        await assertRevert(contract.release(array,values,fromRecipient))

        // Checking current balance (sender,receiver,contract)
        await checkBalance(0,0,100)
    })
    it('trying to send 100 balance without approve', async() => {
        let time = uint(now-minute)
        await assertRevert(contract.accept(recipient, time, uint(100)))

        // Checking current balance (sender,receiver,contract)
        await checkBalance(100,0,0)

        await assertRevert(contract.release([time],[100],fromRecipient))

        // Checking current balance (sender,receiver,contract)
        await checkBalance(100,0,0)
    })
    it('trying release 100 balance from different address ', async() => {
        let time = uint(now-minute)

        // Approving contract to take 100 from senders balance
        await erc20.approve(contract.address,uint(100))
        await contract.accept(recipient, time, uint(100))

        // Checking current balance (sender,receiver,contract)
        await checkBalance(0,0,100)

        // Someone trying to take other user balance
        await assertRevert(contract.release([time],[100],fromAdmin))

        // Checking current balance (sender,receiver,contract)
        await checkBalance(0,0,100)
    })
    it('force releasing 100 balance by admin', async() => {
        let time = uint(now-minute)

        // Approving contract to take 100 from senders balance
        await erc20.approve(contract.address,uint(100))
        await contract.accept(recipient, time, uint(100))

        // Checking current balance (sender,receiver,contract)
        await checkBalance(0,0,100)

        // Admin accepting request
        await contract.releaseForce(recipient,[time],[100],fromAdmin)

        // Checking current balance (sender,receiver,contract)
        await checkBalance(0,100,0)
    })
    it('admin cannot release when timeout is not ended', async() => {
        let time = uint(now+minute)

        // Approving contract to take 100 from senders balance
        await erc20.approve(contract.address,uint(100))
        await contract.accept(recipient, time, uint(100))

        // Checking current balance (sender,receiver,contract)
        await checkBalance(0,0,100)

        // Admin trying to release operation but timeout is not ended
        await assertRevert(contract.releaseForce(recipient,[time],[100],fromAdmin))

        // Checking current balance (sender,receiver,contract)
        await checkBalance(0,0,100)
    })
    it('trying to force release 100 balance not by admin', async() => {
        let time = uint(now-minute)

        // Approving contract to take 100 from senders balance
        await erc20.approve(contract.address,uint(100))
        await contract.accept(recipient, time, uint(100))

        // Checking current balance (sender,receiver,contract)
        await checkBalance(0,0,100)

        // Someone trying to accept request when timeout is not ended
        await assertRevert(contract.releaseForce(recipient,[time],[100]))

        // Checking current balance (sender,receiver,contract)
        await checkBalance(0,0,100)
    })
})
