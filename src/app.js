import express from "express";
import crypto from "crypto";
import { Database, Expires } from "./database.js";
import os from "os";


const PORT = process.env.PORT ?? 1234;
const BYTES_PER_ID = 48; // 48 bytes per ID seems reasonable. 2^48 = 1.84e19
const MAX_NAME_LENGTH = 40;
const MAX_SCOPE_LENGTH = 40;

console.log(`PORT: ${PORT}`);
console.log(`BYTES_PER_ID: ${BYTES_PER_ID}`);
console.log(`MAX_SCOPE_LENGTH: ${MAX_SCOPE_LENGTH}`);
console.log(`MAX_NAME_LENGTH: ${MAX_NAME_LENGTH}`);
const app = express();



/**
 * Create and return a base64url encoded id with BYTES_PER_ID bytes
 * @returns 
 */
function generateID() {
    const id = crypto.randomBytes(BYTES_PER_ID); 
    return id.toString("base64url");
}


/**
 * Returns true if the string is a valid name. False otherwise
 * @param {string} name 
 */
function validateName(name) {
    return name.length < MAX_NAME_LENGTH && /^[\w ]+$/g.test(name);
}

/**
 * Returns true if the string is a valid scope name. False otherwise
 * @param {string} scope 
 * @returns 
 */
function validateScope(scope) {
    return scope.length < MAX_SCOPE_LENGTH && /^[A-Za-z\-_]+$/g.test(scope);
}

// GET /:id/authenticate?scope=[scope name]
app.get("/:id/authenticate", async (req, res) => {
    console.log(`${req.method} ${req.originalUrl}`);
    
    // Validate scope input
    const scopeName = req.query.scope;
    if(scopeName == null) {
        res.status(400).send(`"scope" parameter needed.`);
        return;
    }
    if(!validateScope(scopeName)) {
        res.status(400).send(`"scope" is not a valid scope.`);
        return;
    }

    // Get user
    const id = req.params.id;
    const user = await Database.getUser(id);
    if(user == null) {
        console.log(`id "${id}" does not exists`);
        res.status(400).send(`id "${id}" does not exists`);
        return;
    }
    console.log(`"${user.name}" is trying to authenticate for "${scopeName}"`);

    // Check if user has scope.
    const scope = user.scopes.find((scope) => (scope.scope === scopeName));
    if(scope == null) {
        console.log(`"${user.name}" does not have access to "${scopeName}".`);
        res.status(401).send(`You do not have access to "${scopeName}".`);
        return;
    }

    // Check if scope access has expired.
    const now = new Date();
    if(scope.expires_at.getTime() < now.getTime()) {
        console.log(`"${user.name}"'s access to "${scopeName}" has expired. Please ask an admin to renew it.`);
        res.status(401).send(`Your access to "${scopeName}" has expired. Please ask an admin to renew it.`);
        return;
    }

    // Send authenticated message.
    console.log(`"${user.name}" has been granted access for "${scopeName}"`);
    res.status(200).send("Authenticated");
});

// POST /create-user?name=[string]
app.use("/create-user", (req, res) => {
    console.log(`${req.method} ${req.originalUrl}`);
    
    // Validate name parameter
    const name = req.query["name"];
    if(name == null) {
        res.status(400).send(`"name" parameter is needed.`);
        return;
    }
    if(!validateName(name)) {
        res.status(400).send("Invalid name.");
        return;
    }

    // Generate id
    const id = generateID();
    console.log(`Creating user "${name}" with id "${id}"`);

    // Create user with empty scopes
    return Database.createUserWithScopes(id, name, [])
        .then(() => {
            res.status(201).send(id);
        })
        .catch((err) => {
            console.error(err);
            res.status(500).send("Internal database error");
        });
});

// POST /:id/update-scope?scope=[scope]&expires_in=[days]
app.use("/:id/update-scope", async (req, res) => {
    console.log(`${req.method} ${req.originalUrl}`);
    
    // Validate scope parameter
    const scope = req.query.scope;
    if(scope == null) {
        res.status(400).send(`"scope" parameter needed.`);
        return;
    }
    if(!validateScope(scope)) {
        res.status(400).send(`"scope" is not a valid scope.`);
        return;
    }

    // Validate and parse expires_in parameter
    let expiresInString = req.query.expires_in;
    let expiresIn = 1;
    if(expiresInString != null) {
        expiresIn = parseInt(expiresInString);
        if(isNaN(expiresIn)) {
            res.status(400).send(`"expires_in" is not a number`);
            return;
        }
        if(expiresIn <= 0) {
            res.status(400).send(`"expires_in" must be greater than 0`);
            return;
        }
    }

    // Get user
    const id = req.params.id;
    const user = await Database.getUser(id);
    if(user == null) {
        console.log(`id "${id}" does not exists`);
        res.status(400).send(`id "${id}" does not exists`);
        return;
    }

    // Update scopes of user.
    console.log(`Updating "${user.name}"'s scopes with "${scope}" that will expire in "${expiresIn}" days`);
    await Database.updateScopesOfUser(id, [ {scope: scope, expires_at: Expires.after(expiresIn) } ])
        .then(() => {
            res.status(200).send(id);
        })
        .catch((err) => {
            console.error(err);
            res.status(500).send("Internal database error");
        });
});


app.get("/users", async (req, res) => {
    res.status(200).json(await Database.getAllUsers());
});


app.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);

    const networkInterfaces = os.networkInterfaces();
    console.log(`Possible urls: `)
    networkInterfaces["Wi-Fi"].forEach((networkInfo) => {
        if(networkInfo.family === "IPv4") {
            console.log(`\thttp://${networkInfo.address}:${PORT}/users`);
        }
    });

    console.log(`\thttp://localhost:${PORT}/users`);
    console.log(`\thttp://127.0.0.1:${PORT}/users`);
});