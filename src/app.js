import express from "express";
import crypto from "crypto";



const PORT = process.env.PORT ?? 1234;


const BYTES_PER_ID = 48; // 48 bytes per ID seems reasonable. 2^48 = 1.84e19

const app = express();



const Users = {}


// GET /authenticate?id=[base64 encoded string]
app.get("/authenticate", (req, res) => {

});

// POST /add-user?
app.use("/add-user", (req, res) => {
    const id = crypto.randomBytes(BYTES_PER_ID);
    const idBase64 = id.toString("base64url");

    console.log(idBase64);
    Users[idBase64] = {

        expires_at: new Date()
    };

    res.status(201).send(idBase64);
});


app.get("/users", (req, res) => {
    res.status(200).json(Users);
});


app.listen(PORT, () => {

});