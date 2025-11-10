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
        const usersCollection = RentWheels.collection('cars')

      // -----------------------//
      
      // Check mongodb database connection
      app.get('/', async (req, res) => {
            
            res.send('wow my database connection work');
        })
      
      // cars data
      app.get('/cars', async (req, res) => {
            const cursor = usersCollection.find();
            const result = await cursor.toArray();
            res.send(result);
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

