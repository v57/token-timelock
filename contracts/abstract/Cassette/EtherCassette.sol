pragma solidity ^0.4.24;

import "./ICassette.sol";

contract EtherCassette is ICassette {
  function getCassetteSize_() internal view returns(uint) {
    return address(this).balance;
  }

  function acceptAbstractToken_(uint) internal returns(bool){
    return true;
  }
  function releaseAbstractToken_(address _for, uint _value) internal returns(bool){
    _for.transfer(_value);
    return true;
  }

  function getCassetteType_() internal pure returns(uint8){
    return CT_ETHER;
  }

}