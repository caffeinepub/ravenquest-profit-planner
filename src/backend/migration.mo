import Map "mo:core/Map";

module {
  public type OldActor = {
    priceBook : Map.Map<Nat, { itemId : Nat; itemName : Text; price : Float; lastUpdatedAt : Int; updatedBy : Principal }>;
    claims : Map.Map<Text, { itemId : Nat; itemName : Text; category : Text; landSize : Text; quantity : Nat; claimedAt : Int; claimedBy : Principal }>;
    userProfiles : Map.Map<Principal, { name : Text }>;
  };

  public type NewActor = {
    priceBook : Map.Map<Nat, { itemId : Nat; itemName : Text; price : Float; lastUpdatedAt : Int; updatedBy : Principal }>;
    claims : Map.Map<Text, { itemId : Nat; itemName : Text; category : Text; landSize : Text; quantity : Nat; claimedAt : Int; claimedBy : Principal }>;
    userProfiles : Map.Map<Principal, { name : Text }>;
  };

  public func run(old : OldActor) : NewActor {
    old;
  };
};
