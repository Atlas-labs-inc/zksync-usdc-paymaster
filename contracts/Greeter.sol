// SPDX-License-Identifier: Unlicensed
pragma solidity ^0.8.0;

contract Greeter {
  string public greeting;

  constructor (string memory initGreeting) {
    greeting = initGreeting;
  }
  
  function setGreeting(string memory _greeting) public {
    greeting = _greeting;
  }

  function greet() public view returns(string memory) {
    return greeting;
  }
}
 
