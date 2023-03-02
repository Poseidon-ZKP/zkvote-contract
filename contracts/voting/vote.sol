//SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "../group/IGroup.sol";
import "../signal/ISignal.sol";
import "./ReentrancyGuard.sol";

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

enum PollState {
    Created,
    Ongoing,
    Ended
}

//uint constant MAX_MSG_NUM = 10;
struct Poll {
    uint group_id;
    uint id;
    string[] msgs;
    PollState state;
    string title;
    string desc;
}

// Compose group/signal primitive
contract Vote is ReentrancyGuard{
    IGroup public group;
    ISignal public signal;
    event VoteAdded(uint256 indexed groupId, bytes32 voteMsg);
    event JoinRequested(uint256 indexed groupId, uint256 indexed identityCommitment);

    mapping(uint256 => mapping(bytes32 => uint256)) public voteStat;
    uint public GROUP_ID;

    // TODO : avoid too big
    mapping(uint256 => mapping(uint256 => bool)) public idInGroup;

    mapping(uint256 => address) public admins;
    modifier onlyAdmin(uint256 id) {
        require(admins[id] == msg.sender, "only Admin!");
        _;
    }

    mapping(uint => string) public groupDesc;
    mapping(uint => string) public groupIcon;
    mapping(uint => string) public groupPrivacy;
    mapping(uint => string) public groupName;

    enum PRIVACY {
        ANYONE,     // any one can join
        NFT,        // could join group if owner of a NFT
        TOKEN       // could join group if owner of token
    }

    struct groupInfo {
        uint id;
        string name;
        string desc;
        string icon;
        PRIVACY privacy;
        address asset;  // asset (nft/token) contract address
    }

    event GroupInfo(
        uint256 indexed groupId,
        string name,
        string desc,
        string icon,
        PRIVACY privacy,
        address asset
    );

    mapping(uint => groupInfo) public groups;

    mapping(uint => mapping(uint => Poll)) public groupPolls;
    mapping(uint => uint) public groupPollNum;
    mapping(uint256 => mapping(uint256 => mapping(string => uint256))) public pollVoteStat;
    event PoolVoteAdded(uint256 indexed groupId, uint256 indexed poolId, string voteMsg);
    event MemberAdded(uint256 indexed groupId, uint256 indexed identityCommitment);

    function initialize(
        IGroup _group,
        ISignal _signal
	) external {
        initializeReentrancyGuard();

        group  = _group;
        signal = _signal;
        GROUP_ID = 0;
    }

    function createGroup(
        uint256 merkleTreeDepth,
        address admin
    ) public returns (uint) {
        group.createGroup(++GROUP_ID, merkleTreeDepth, address(this));
        admins[GROUP_ID] = admin;
        return GROUP_ID;
    }

    function CreateGroupExtra(
        uint256 merkleTreeDepth,
        address admin,
        string calldata name,
        string calldata description,
        string calldata privacy,
        string calldata icon
    ) public returns (uint groupId) {
        groupId = createGroup(merkleTreeDepth, admin);
        groupName[groupId] = name;
        groupDesc[groupId] = description;
        groupPrivacy[groupId] = privacy;
        groupIcon[groupId] = icon;
    }

    function CreateGroupWithAssetDemand(
        uint256 merkleTreeDepth,
        address admin,
        string calldata name,
        string calldata description,
        PRIVACY privacy,
        string calldata icon,
        address asset
    ) public returns (uint groupId) {
        groupId = createGroup(merkleTreeDepth, admin);
        groups[groupId] = groupInfo({
            id : groupId,
            name : name,
            desc : description,
            icon : icon,
            privacy : privacy,
            asset : asset
        });
        
        emit GroupInfo(groupId, name, description, icon, privacy, asset);
    }

    function JoinRequest(
        uint256 groupId,
        uint256 identityCommitment
    ) public {
        emit JoinRequested(groupId, identityCommitment);
    }

    // TODO : Group frozen when vote start.
    function addMember(
        uint256 groupId,
        uint256 identityCommitment
    ) public {
        require(!idInGroup[groupId][identityCommitment], "id exist in group!");
        checkPrivacy(groupId);
        group.addMember(groupId, identityCommitment);
        idInGroup[groupId][identityCommitment] = true;
        emit MemberAdded(groupId, identityCommitment);
    }

    function checkPrivacy(uint groupId) public {
        if (groups[groupId].privacy == PRIVACY.NFT) {
            IERC721 nft = IERC721(groups[groupId].asset);
            require(nft.balanceOf(msg.sender) > 0, "missing nft!");
        }
    }

    event PollAdded(uint256 indexed groupId, uint256 indexed pollId, string title, string[] voteMsgs, string desc);
    function createPollInGroup(
        uint256 groupId,
        string[] calldata voteMsgs,
        string calldata title,
        string calldata desc
    ) public returns(uint pollId) {
        pollId = groupPollNum[groupId]++;
        groupPolls[groupId][pollId] = Poll({
            group_id : groupId,
            id : pollId,
            msgs : new string[](voteMsgs.length),
            state : PollState.Created,
            title : title,
            desc : desc
        });

        for (uint i=0; i < voteMsgs.length; ++i) {
            groupPolls[groupId][pollId].msgs[i] = voteMsgs[i];
        }

        emit PollAdded(groupId, pollId, title, voteMsgs, desc);
    }

    function voteInPoll(
        uint256 rc,
        // group
        uint256 groupId,
        uint256[8] calldata group_proof,
        // poll
        uint256 pollId,
        string calldata voteMsg,
        // signal
        uint256 nullifierHash,
        uint256[8] calldata signal_proof
    ) public {
        uint256 externalNullifier = (groupId << 128) + pollId;

        vote(rc, groupId, group_proof, keccak256(abi.encode(voteMsg)), nullifierHash, externalNullifier, signal_proof);
        pollVoteStat[groupId][pollId][voteMsg]++;
        emit PoolVoteAdded(groupId, pollId, voteMsg);
    }

    // if a member vote multi rounds in a group, Frontend using latest vote
    function vote(
        uint256 rc,
        // group
        uint256 groupId,
        uint256[8] calldata group_proof,
        // signal
        bytes32 voteMsg,
        uint256 nullifierHash,
        uint256 externalNullifier,
        uint256[8] calldata signal_proof
    ) public {
        require(group.verifyProof(rc, groupId, group_proof), "group proof err");
        require(signal.signal(rc, voteMsg, nullifierHash, externalNullifier, signal_proof), "signal fail");

        emit VoteAdded(groupId, voteMsg);
        voteStat[groupId][voteMsg] += 1;
    }

}
