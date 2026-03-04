import Principal "mo:core/Principal";
import Nat "mo:core/Nat";
import Int "mo:core/Int";
import Text "mo:core/Text";
import Map "mo:core/Map";
import Time "mo:core/Time";
import Float "mo:core/Float";
import Array "mo:core/Array";
import List "mo:core/List";
import Iter "mo:core/Iter";
import Runtime "mo:core/Runtime";
import AccessControl "authorization/access-control";
import MixinAuthorization "authorization/MixinAuthorization";



actor {
  type InternalCompositeKey = Text;

  let accessControlState = AccessControl.initState();
  include MixinAuthorization(accessControlState);

  public type UserProfile = {
    name : Text;
  };

  public type PriceEntry = {
    itemId : Nat;
    itemName : Text;
    price : Float;
    lastUpdatedAt : Int;
    updatedBy : Principal;
  };

  public type GrowingClaim = {
    itemId : Nat;
    itemName : Text;
    category : Text;
    landSize : Text;
    quantity : Nat;
    claimedAt : Int;
    claimedBy : Principal;
  };

  public type PriceHistoryEntry = {
    itemId : Nat;
    itemName : Text;
    price : Float;
    timestamp : Int;
    source : Text;
    updatedBy : Text;
  };

  public type PriceHistoryInput = {
    itemId : Nat;
    itemName : Text;
    price : Float;
    source : Text;
    updatedBy : Text;
  };

  public type BaselineResult = {
    baseline : Float;
    volatility : Float;
    method : Text;
    dataPoints : Nat;
  };

  let priceBook = Map.empty<Nat, PriceEntry>();
  let claims = Map.empty<InternalCompositeKey, GrowingClaim>();
  let userProfiles = Map.empty<Principal, UserProfile>();
  var priceHistory = List.empty<PriceHistoryEntry>();

  func makeCompositeKey(principal : Principal, itemId : Nat) : Text {
    principal.toText() # ":" # itemId.toText();
  };

  // User Profile management
  public query ({ caller }) func getCallerUserProfile() : async ?UserProfile {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only authenticated users can get their profile");
    };
    userProfiles.get(caller);
  };

  public query ({ caller }) func getUserProfile(user : Principal) : async ?UserProfile {
    if (caller != user and not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Can only view your own profile");
    };
    userProfiles.get(user);
  };

  public shared ({ caller }) func saveCallerUserProfile(profile : UserProfile) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only authenticated users can save their profile");
    };
    userProfiles.add(caller, profile);
  };

  // Price Book functions (ADMIN ONLY)
  public query ({ caller }) func getPrices() : async [(Nat, PriceEntry)] {
    priceBook.toArray();
  };

  public shared ({ caller }) func setPrice(itemId : Nat, itemName : Text, price : Float) : async () {
    if (not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Admin only");
    };

    let entry : PriceEntry = {
      itemId;
      itemName;
      price;
      lastUpdatedAt = Time.now() / 1_000_000;
      updatedBy = caller;
    };

    priceBook.add(itemId, entry);
  };

  public shared ({ caller }) func clearPrice(itemId : Nat) : async () {
    if (not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Admin only");
    };
    priceBook.remove(itemId);
  };

  public shared ({ caller }) func clearAll() : async () {
    if (not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Admin only");
    };
    priceBook.clear();
  };

  public query ({ caller }) func getAttributions() : async [(Nat, Text)] {
    let entries = priceBook.toArray();
    entries.map(
      func((itemId, entry)) {
        (
          itemId,
          (Text.fromArray(
            entry.updatedBy.toText().toArray().sliceToArray(0, 8),
          ))
        );
      }
    );
  };

  // Planner (What Are You Growing?) functions (user only)
  public shared ({ caller }) func setClaim(itemId : Nat, itemName : Text, category : Text, landSize : Text, quantity : Nat) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only authenticated users can set claims");
    };

    let entry : GrowingClaim = {
      itemId;
      itemName;
      category;
      landSize;
      quantity;
      claimedAt = Time.now() / 1_000_000;
      claimedBy = caller;
    };

    claims.add(makeCompositeKey(caller, itemId), entry);
  };

  public shared ({ caller }) func removeClaim(itemId : Nat) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only authenticated users can remove claims");
    };

    let key = makeCompositeKey(caller, itemId);
    switch (claims.get(key)) {
      case (?_) {
        claims.remove(key);
      };
      case (null) {
        Runtime.trap("Claim not found");
      };
    };
  };

  public query ({ caller }) func getClaims() : async [GrowingClaim] {
    claims.values().toArray();
  };

  public query ({ caller }) func getMyClaims() : async [GrowingClaim] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only authenticated users can get their claims");
    };

    claims.values().toArray().filter(
      func(claim) {
        claim.claimedBy == caller;
      }
    );
  };

  // Price History functions
  public shared ({ caller }) func addPriceHistory(entries : [PriceHistoryInput]) : async () {
    let currentTime = Time.now() / 1_000_000;

    // Create new entries
    let newEntries = entries.map(
      func(input) {
        let updatedBy = if (input.updatedBy.size() > 0) {
          input.updatedBy;
        } else {
          caller.toText();
        };
        {
          itemId = input.itemId;
          itemName = input.itemName;
          price = input.price;
          timestamp = currentTime;
          source = input.source;
          updatedBy;
        };
      }
    );

    let newEntriesList = List.fromArray<PriceHistoryEntry>(newEntries);
    priceHistory.addAll(newEntriesList.values());

    // Trim to 2000 entries if needed
    let historySize = priceHistory.size();
    if (historySize > 2000) {
      let historyArray = priceHistory.toArray();
      let trimmedArray = historyArray.sliceToArray(0, 2000);
      priceHistory := List.fromArray<PriceHistoryEntry>(trimmedArray);
    };
  };

  public query ({ caller }) func getPriceHistory(itemId : Nat, limit : Nat) : async [PriceHistoryEntry] {
    let filtered = priceHistory.toArray().filter(
      func(entry) {
        entry.itemId == itemId;
      }
    );

    let limited = if (limit > 0 and filtered.size() > limit) {
      filtered.sliceToArray(0, limit);
    } else {
      filtered;
    };

    limited;
  };

  public query ({ caller }) func getAllPriceHistory(limit : Nat) : async [PriceHistoryEntry] {
    let historyArray = priceHistory.toArray();

    let limited = if (limit > 0 and historyArray.size() > limit) {
      historyArray.sliceToArray(0, limit);
    } else {
      historyArray;
    };

    limited;
  };

  public shared ({ caller }) func getBaseline(itemId : Nat) : async BaselineResult {
    let nowMs = Time.now() / 1_000_000;
    let dayMs = 24 * 3600 * 1000;
    let sevenDaysMs = 7 * dayMs;

    let entries : [PriceHistoryEntry] = priceHistory.toArray().filter(
      func(entry) {
        entry.itemId == itemId;
      }
    );

    let window7Days = entries.filter(
      func(entry) {
        (nowMs - entry.timestamp) <= sevenDaysMs
      }
    );

    if (window7Days.size() >= 3) {
      return computeStats(window7Days, "7d_rolling_avg");
    } else if (entries.size() >= 3) {
      let endIndex = if (entries.size() >= 30) { 30 } else { entries.size() };
      let last30Entries = entries.sliceToArray(0, endIndex);
      if (last30Entries.size() >= 3) {
        return computeStats(last30Entries, "last_30_avg");
      };
    };

    if (entries.size() >= 1) {
      let endIndex = if (entries.size() >= 10) { 10 } else { entries.size() };
      let last10Entries = entries.sliceToArray(0, endIndex);
      if (last10Entries.size() >= 1) {
        return computeStats(last10Entries, "last_10_avg");
      };
    };

    { baseline = 0.0; volatility = 0.0; method = "none"; dataPoints = 0 };
  };

  func computeStats(entries : [PriceHistoryEntry], method : Text) : BaselineResult {
    let n = entries.size();
    if (n == 0) {
      return { baseline = 0.0; volatility = 0.0; method = "none"; dataPoints = 0 };
    };

    var sum = 0.0;
    for (entry in entries.values()) {
      sum += entry.price;
    };

    let mean = sum / n.toFloat();

    if (n == 1) {
      return { baseline = mean; volatility = 0.0; method; dataPoints = n };
    };

    var sumSquares = 0.0;
    for (entry in entries.values()) {
      let diff = entry.price - mean;
      sumSquares += diff * diff;
    };

    let variance = sumSquares / (n.toFloat() - 1);
    let stddev = Float.sqrt(variance);

    { baseline = mean; volatility = stddev; method; dataPoints = n };
  };

  // ADMIN QUERY (Updated)
  public query ({ caller }) func getAdminPrincipal() : async ?Principal {
    null;
  };
};
