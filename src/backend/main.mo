import Principal "mo:core/Principal";
import Nat "mo:core/Nat";
import Text "mo:core/Text";
import Map "mo:core/Map";
import Time "mo:core/Time";
import Int "mo:core/Int";
import Array "mo:core/Array";
import Runtime "mo:core/Runtime";
import Iter "mo:core/Iter";
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

  let priceBook = Map.empty<Nat, PriceEntry>();
  let claims = Map.empty<InternalCompositeKey, GrowingClaim>();
  let userProfiles = Map.empty<Principal, UserProfile>();

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

  // USER AUTH/ADMIN QUERY
  // Note: This function cannot be fully implemented as specified because
  // AccessControlState is an opaque type with no public API to iterate user roles.
  // The AccessControl module would need to expose a getUserRoles() method.
  // For now, this returns null as we cannot access the internal state.
  public query ({ caller }) func getAdminPrincipal() : async ?Principal {
    // Cannot iterate accessControlState as it's opaque and has no public iteration API
    // This would require AccessControl module to expose a method like:
    // public func getAllUserRoles(state: AccessControlState) : [(Principal, UserRole)]
    null;
  };
};
