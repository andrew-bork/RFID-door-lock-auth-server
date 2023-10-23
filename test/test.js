import { Database, Expires, Expired, DatabaseTest } from "../src/database.js";

console.log(await DatabaseTest.clearUsers());
console.log(await Database.createUserWithScopes("abcd", "andrew", [{ scope: "door-lock", expires_at: Expires.tomorrow() }]));
console.log(await Database.createUserWithScopes("efg", "hunter", [
        { scope: "door-lock", expires_at: Expires.never() },
        { scope: "hardware-locker", expires_at: Expires.never() },
    ]));
console.log(await Database.createUserWithScopes("hijk", "jeff", [
    { scope: "door-lock", expires_at: Expires.tomorrow() },
    { scope: "vending-machine", expires_at: Expired.yesterday() },
]));
console.log(await Database.createUserWithScopes("lmnop", "billy", [
    { scope: "door-lock", expires_at: Expired.yesterday() },
]));
console.log(await Database.createUserWithScopes("qrst", "bruh", []));

console.log(await Database.getAllUsers());

console.log(await Database.findUserWithScopes("lmnop", ["door-lock"]));
console.log(await Database.findUsersWithExpiredScopes());

console.log(await Database.updateScopesOfUser("hijk", [
    { scope: "vending-machine", expires_at: Expires.tomorrow() },
]));
console.log(await Database.updateScopesOfUser("fdsa", [
    { scope: "vending-machine", expires_at: Expires.tomorrow() },
]));

console.log(await Database.setScopesOfUser("abcd", [{ scope: "vending-machine", expires_at: Expires.tomorrow() }]))

console.log(await Database.getScopesOfUser("abcd"));
console.log(await Database.findUsersWithExpiredScopes());
console.log(await Database.removeScopesFromUser("efg", ["door-lock"]));
console.log(await Database.getScopesOfUser("efg"));
