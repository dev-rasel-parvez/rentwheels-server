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

        // all cars API
        app.get('/cars', async (req, res) => {
            const cursor = carsCollection.find();
            const result = await cursor.toArray();
            res.send(result);
        })

        // all cars sorted by recent date 
        app.get('/cars/recent', async (req, res) => {
            const cursor = carsCollection.find().sort({ addedDate: -1 });
            const result = await cursor.toArray();
            res.send(result);
        });

        // Specific car API
        app.get('/cars/:id', verifyFireBaseToken, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await carsCollection.findOne(query);
            res.send(result);
        })


        // Update car 
        app.patch('/cars/:id', verifyFireBaseToken, async (req, res) => {
            const id = req.params.id;
            const updateData = req.body;

            try {
                const filter = { _id: new ObjectId(id) };

                if (!updateData || Object.keys(updateData).length === 0) {
                    return res.status(400).send({ error: "No update data provided" });
                }


                if (Object.keys(updateData).length === 1 && updateData.status) {
                    const updateDoc = { $set: { status: updateData.status } };
                    const result = await carsCollection.updateOne(filter, updateDoc);

                    if (result.modifiedCount === 0) {
                        return res.status(404).send({ error: "Car not found or status unchanged" });
                    }

                    return res.send({ message: "Car status updated successfully" });
                }

                const allowedFields = [
                    "carName",
                    "category",
                    "rentPricePerDay",
                    "location",
                    "imageUrl",
                    "description",
                    "status"
                ];


                const safeUpdate = {};
                for (const key of allowedFields) {
                    if (updateData[key] !== undefined) safeUpdate[key] = updateData[key];
                }

                const updateDoc = { $set: safeUpdate };

                const result = await carsCollection.updateOne(filter, updateDoc);

                if (result.modifiedCount === 0) {
                    return res.status(404).send({ error: "Car not found or data unchanged" });
                }

                res.send({ message: "Car updated successfully" });
            } catch (err) {
                console.error("Error updating car:", err);
                res.status(500).send({ error: "Failed to update car" });
            }
        });

        

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

