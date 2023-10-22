import { MongoClient } from "mongodb";

const client = new MongoClient("mongodb://127.0.0.1:27017/");


console.log("Connecting to the database...");
await client.connect();
console.log("Connected to the database");

const db = client.db("rfid");


function tomorrow() {
    const today = new Date();
    const tomorrow = new Date();
    
    tomorrow.setDate(today.getDate() + 1);
    tomorrow.setHours(23, 59); // tmr 11:59 PM

    return tomorrow.getTime();
}

function yesterday() {
    const today = new Date();
    const yesterday = new Date();
    
    yesterday.setDate(today.getDate() - 1);
    yesterday.setHours(23, 59); // tmr 11:59 PM

    return yesterday.getTime();
}


function never() {
    return new Date(8640000000000000).getTime();
}

export const Database  = {
    async findUsersWithExpiredScopes() {
        const now = Date.now();
        return await db.collection("users").find({
            scopes: {
                $elemMatch: {
                    expires_at: {
                        $lt: now
                    }
                }
            }
        }).toArray();
    },
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

        const result = await db.collection("users").findOne(query);

        return result;
    },
    async findUser(id) {
        return await db.collection("users").findOne({ _id:id });
    },
    async createUserWithScopes(id, name, scopes = []) {
        const result = await db.collection("users").insertOne({
            _id: id,
            name: name,
            scopes: scopes,
        });
        return result;
    },
    async removeScopesFromUser(id, scopes = []) {
        return await db.collection("users").updateOne({ _id: id }, { $pull: { scopes: {scope: { $in: scopes } } } });
    },
    async updateScopesOfUser(id, scopes = []) {
        const scopeNames = scopes.map((scope) => scope.scope);
        const pullResult = await db.collection("users").updateOne({ _id: id }, { $pull: { scopes: {scope: { $in: scopeNames } } } });
        const pushResult = await db.collection("users").updateOne({ _id: id }, { $push: { scopes: { $each: scopes } } });
        return {
            pull: pullResult,
            push: pushResult,
        };
    },
    async setScopesOfUser(id, scopes = []) {
        return await db.collection("users").updateOne({ _id: id }, { $set: { scopes: scopes } });
    },
    async getUser(id) {
        return await db.collection("users").findOne({ _id: id});
    },
    async getScopesOfUser(id) {
        return (await Database.getUser(id)).scopes;
    }
};

export const Expires = {
    tomorrow,
    never
};

export const Expired = {

    yesterday
};

export const DatabaseTest = {
    async clearUsers() {
       return await db.collection("users").drop();
    },
    async getAllUsers() {
        return (await db.collection("users").find()).toArray();
    }
}