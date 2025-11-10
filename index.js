const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express()
const port = process.env.PORT || 5000;
const uri = process.env.MONGODB_URI;

const admin = require("firebase-admin");

const serviceAccount = require("./rentwheels-client-rasel-firebase-adminsdk.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});


// middleware
app.use(cors());
app.use(express.json());

const verifyFireBaseToken = async (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization) {
        return res.status(401).send({ message: 'unauthorized access' })
    }
    const token = authorization.split(' ')[1];

    try {
        const decoded = await admin.auth().verifyIdToken(token);
        console.log('inside token', decoded)
        req.token_email = decoded.email;
        next();
    }
    catch (error) {
        return res.status(401).send({ message: 'unauthorized access' })
    }
}

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

app.get('/', (req, res) => {
    res.send('My Server is running')
})

async function run() {
    try {
        await client.connect()

        const RentWheels = client.db('RentWheels');
        const carsCollection = RentWheels.collection('cars')

        // -----------------------//

        // Check mongodb database connection
        app.get('/', async (req, res) => {

            res.send('wow my database connection work');
        })





        await client.db('admin').command({ ping: 1 })
        console.log("I successfully connected to MongoDB!");
    }
    finally {

    }
}
run().catch(console.dir)


app.listen(port, () => {
    console.log(`My server is running on port ${port}`);
})

