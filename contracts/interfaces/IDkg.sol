//SPDX-License-Identifier: MIT
pragma solidity >=0.8.4;

interface IDkg {
    function get_PK() external view returns (uint256, uint256);

    function get_PK_for(uint participant_id) external view returns(uint, uint);

    function get_committee_id_from_address(address addr) external view returns (uint);

    function n_comm() external view returns (uint);

    function tally_threshold() external view returns (uint);
}