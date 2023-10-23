import { MongoClient } from "mongodb";


const DATABASE_URL = process.env.DATABASE_URL ?? "mongodb://127.0.0.1:27017/";

const client = new MongoClient(DATABASE_URL);

console.log(`Database is located at "${DATABASE_URL}"`)
console.log("Connecting to the database...");
await client.connect();
console.log("Connected to the database");

// RFID database, users collections.
const db = client.db("rfid");
const users = db.collection("users");


/**
 * Return a expiration date that is tomorrow at midnight.
 * @returns 
 */
function tomorrow() {
    const today = new Date();
    const tomorrow = new Date();
    
    tomorrow.setDate(today.getDate() + 1);
    tomorrow.setHours(23, 59); // tmr 11:59 PM

    return tomorrow;
}


/**
 * Returns an expiration date that expires a number of days after today at midnight.
 * @param {number} days 
 */
function after(days) {
    const today = new Date();
    const out = new Date();
    
    out.setDate(today.getDate() + days);
    out.setHours(23, 59); // 11:59 PM

    return out;
}

/**
 * Return a expiration date that was yesterday at midnight. Used as a debug expiration date.
 * @returns 
 */
function yesterday() {
    const today = new Date();
    const yesterday = new Date();
    
    yesterday.setDate(today.getDate() - 1);
    yesterday.setHours(23, 59); // tmr 11:59 PM

    return yesterday;
}

/**
 * Returns a the maximum expiration date. This date should never expire.
 * @returns 
 */
function never() {
    return new Date(8640000000000000);
}


/**
 * @typedef {{ scope: name, expires_at: Date }} Scope
 * @typedef {{ _id: string, name: string, scopes: [Scope] }} User
 */

/**
 * A collection of queries and operations on the database.
 */
export const Database  = {
    /**
     * Find all users in the database that have at least one scope that is expired.
     * 
     * @returns {Promise<[User]>}
     */
    async findUsersWithExpiredScopes() {
        const now = new Date();
        return await users.find({
            scopes: {
                $elemMatch: {
                    expires_at: {
                        $lt: now
                    }
                }
            }
        }).toArray();
    },
    /**
     * Find if a user has a given scopes. 
     * If the user doesn't exist or the user does not have the all the scopes given or the found scope has already expired, this function returns null.
     * 
     * @param {string} id 
     * @param {[string]} scopes 
     * @returns {Promise<User>}
     */
    async findUserWithValidScopes(id, scopes = []) {
        const now = new Date();
        const query = {
            _id: id,
            scopes: {
                $all: scopes.map(scope => {
                    return {
                        $elemMatch: { 
                            scope: scope,
                            expires_at: {
                                $lt: now
                            }
                        }
                    };
                })
            }
        };

        return await users.findOne(query);
    },
    /**
     * Find if a user has a given scopes. If the user doesn't exist or the user does not have the all the scopes given, this function returns null.
     * This function does not check if a scope has expired yet.
     * 
     * @param {string} id 
     * @param {[string]} scopes 
     * @returns {Promise<User>}
     */
    async findUserWithScopes(id, scopes = []) {
        const query = {
            _id: id,
            scopes: {
                $all: scopes.map(scope => {
                    return {
                        $elemMatch: { scope: scope }
                    };
                })
            }
        };

        return await users.findOne(query);
    },
    /**
     * Create a user with a name and scopes.
     * 
     * @param {string} id 
     * @param {string} name 
     * @param {[Scope]} scopes 
     */
    async createUserWithScopes(id, name, scopes = []) {
        const result = await users.insertOne({
            _id: id,
            name: name,
            scopes: scopes,
        });
        return result;
    },
    /**
     * Remove the scope of a given user.
     * 
     * @param {string} id 
     * @param {[string]} scopes 
     * @returns 
     */
    async removeScopesFromUser(id, scopes = []) {
        return await users.updateOne({ _id: id }, { $pull: { scopes: {scope: { $in: scopes } } } });
    },
    /**
     * Updates the scopes of a given user. If the user already has a scope, this will overwrite that scope.
     * If the user doesn't already have a scope, the new scope will be added.
     * 
     * @param {string} id 
     * @param {[Scope]} scopes 
     * @returns 
     */
    async updateScopesOfUser(id, scopes = []) {
        const scopeNames = scopes.map((scope) => scope.scope);
        const pullResult = await users.updateOne({ _id: id }, { $pull: { scopes: {scope: { $in: scopeNames } } } });
        const pushResult = await users.updateOne({ _id: id }, { $push: { scopes: { $each: scopes } } });
        return {
            pull: pullResult,
            push: pushResult,
        };
    },
    /**
     * Sets the scopes of a given user. Overwrites all scopes the user already has.
     * 
     * @param {string} id 
     * @param {[Scope]} scopes 
     * @returns 
     */
    async setScopesOfUser(id, scopes = []) {
        return await users.updateOne({ _id: id }, { $set: { scopes: scopes } });
    },
    /**
     * Get all the scopes of a given user. Returns null if user does not exist.
     * 
     * @param {string} id 
     * @returns {Promise<User>}
     */
    async getUser(id) {
        return await users.findOne({ _id: id});
    },
    /**
     * Get all the scopes of a given user. Returns null if user does not exist.
     * 
     * @param {string} id Id of the user
     * @returns {Promise<[Scope]|null>}
     */
    async getScopesOfUser(id) {
        const user = await Database.getUser(id);
        if(user == null) return null;
        return (await Database.getUser(id)).scopes;
    },
    /**
     * Get all the users in the database. This might be bad if the database is too large.
     * 
     * @returns {Promise<[User]>}
     */
    async getAllUsers() {
        return (await users.find()).toArray();
    }
};

/**
 * Contains utitily functions to create and check expiration dates.
 */
export const Expires = {
    after,
    tomorrow,
    never,
    /**
     * Returns true if a scope has expired or the user does not have the specified scope.
     * Returns false if the scope is still valid.
     * @param {User} user 
     * @param {string} scopeName 
     */
    already(user, scopeName) {  
        const now = new Date();
        const scope = user.scopes.find((scope) => scope.scope === scopeName);
        if(scope == null) return true;
        return scope.expires_at.getTime() < now.getTime();
    },
    yesterday
};

/**
 * Database operations for testing.
 * Do not use these in production.
 */
export const DatabaseTest = {
    async clearUsers() {
       return await users.drop();
    }
}