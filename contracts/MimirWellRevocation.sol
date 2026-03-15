// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MimirWellRevocation
 * @notice On-chain revocation registry for MimirWell agent memory.
 *
 * One contract. Deployed once. Every agent on the MimirWell network uses it.
 *
 * Any owner can revoke any agent wallet's decrypt rights.
 * MimirWell server checks isRevoked() at every recall attempt — enforced before returning the encrypted blob.
 *
 * Gas economics:
 *   - Deploy (once, ever):        ~$10-15
 *   - Store/recall memory:        FREE (no gas)
 *   - Revoke (rare/emergency):    ~$2-5
 */
contract MimirWellRevocation {
    /// @notice owner => agent => revoked
    mapping(address => mapping(address => bool)) public revoked;

    event Revoked(address indexed owner, address indexed agent);
    event Reinstated(address indexed owner, address indexed agent);

    /// @notice Owner permanently seals an agent's decrypt rights.
    function revoke(address agent) external {
        revoked[msg.sender][agent] = true;
        emit Revoked(msg.sender, agent);
    }

    /// @notice Owner reinstates a previously revoked agent.
    function reinstate(address agent) external {
        revoked[msg.sender][agent] = false;
        emit Reinstated(msg.sender, agent);
    }

    /// @notice Returns true if the agent has been revoked by this owner.
    /// @dev Called by MimirWell server before returning encrypted blobs. Also callable by external agents.
    function isRevoked(address owner, address agent) external view returns (bool) {
        return revoked[owner][agent];
    }
}
