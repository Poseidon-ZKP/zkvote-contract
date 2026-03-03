export const TURING_TOKEN_ADDRESS = '0xe8001DC781B66D5ccb189AC0429978fc48c6cf5E';

export const TURING_TOKEN_ABI = [
  'function balanceOf(address account) view returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'function circulatingSupply() view returns (uint256)',
  'function totalBurned() view returns (uint256)',
  'function treasuryBalance() view returns (uint256)',
  'function floorPrice() view returns (uint256)',
  'function currentDay() view returns (uint256)',
  'function hasCheckedInToday(address account) view returns (bool)',
  'function lastCheckIn(address account) view returns (uint256)',
  'function lastMaterialized(address account) view returns (uint256)',
  'function verifier() view returns (address)',
  'function teamWallet() view returns (address)',
  'function getDecayInfo(address account) view returns (uint256 rawBalance, uint256 effectiveBalance, uint256 daysMissed, uint256 decayAmount, uint256 lastCheckInTimestamp)',
  'function checkIn(uint256 day, bytes signature)',
  'function redeemForETH(uint256 amount)',
  'event CheckedIn(address indexed account, uint256 day)',
  'event DecayMaterialized(address indexed account, uint256 decayAmount)',
  'event Redeemed(address indexed account, uint256 tokensBurned, uint256 ethReceived)',
] as const;
