const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express()
const port =  process.env.PORT || 3000;
const uri = process.env.MONGODB_URI;

const admin = require("firebase-admin");

// index.js
const decoded = Buffer.from(process.env.FIREBASE_KEY,'base64').toString("utf-8");
const serviceAccount = JSON.parse(decoded);

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
        
        const RentWheels = client.db('RentWheels');
        const carsCollection = RentWheels.collection('cars')

       
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


        // search cars
        app.get('/cars/search', async (req, res) => {
            try {
                const { query } = req.query;
                if (!query || query.trim() === "") {
                    return res.send([]);
                }

                const regex = new RegExp(query.trim(), "i"); 
                const result = await carsCollection.find({ carName: { $regex: regex } }).toArray();
                res.send(result);
            } catch (error) {
                console.error("Search error:", error);
                res.status(500).send({ message: "Search failed" });
            }
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

        // Add a new car
        app.post('/cars', verifyFireBaseToken, async (req, res) => {
            try {
                const newCar = req.body;

                if (!newCar.carName || !newCar.category || !newCar.rentPricePerDay || !newCar.location || !newCar.imageUrl) {
                    return res.status(400).send({ message: "Missing required fields" });
                }

                newCar.status = newCar.status || "available";

                const today = new Date();
                const yyyy = today.getFullYear();
                const mm = String(today.getMonth() + 1).padStart(2, "0");
                const dd = String(today.getDate()).padStart(2, "0");
                newCar.addedDate = `${yyyy}-${mm}-${dd}`;

                const result = await carsCollection.insertOne(newCar);
                res.status(201).send({
                    message: "Car added successfully",
                    insertedId: result.insertedId
                });
            } catch (error) {
                console.error("Error adding car:", error);
                res.status(500).send({ message: "Failed to add car" });
            }
        });


        // POST /bookings → Book a car
        app.post('/bookings', verifyFireBaseToken, async (req, res) => {
            try {
                const bookingData = req.body;

                if (!bookingData.carId || !bookingData.userEmail) {
                    return res.status(400).send({ message: "Car ID and user email are required" });
                }

                const RentWheels = client.db('RentWheels');
                const carsCollection = RentWheels.collection('cars');
                const bookingsCollection = RentWheels.collection('bookings');

                const car = await carsCollection.findOne({ _id: new ObjectId(bookingData.carId) });
                if (!car) return res.status(404).send({ message: "Car not found" });
                if (car.status === "booked") {
                    return res.status(400).send({ message: "Car is already booked" });
                }


                await bookingsCollection.insertOne(bookingData);


                await carsCollection.updateOne(
                    { _id: new ObjectId(bookingData.carId) },
                    { $set: { status: "booked" } }
                );

                res.send({ message: "Car booked successfully" });

            } catch (error) {
                console.error("Booking error:", error);
                res.status(500).send({ message: "Failed to book car" });
            }
        });


        // GET /bookings → Fetch all bookings
        app.get('/bookings', verifyFireBaseToken, async (req, res) => {
            try {
                const RentWheels = client.db('RentWheels');
                const bookingsCollection = RentWheels.collection('bookings');

                const bookings = await bookingsCollection.find().toArray();
                res.send(bookings);
            } catch (error) {
                console.error("Error fetching bookings:", error);
                res.status(500).send({ message: "Failed to fetch bookings" });
            }
        });

        // Get bookings by logged-in user 
        app.get('/my-bookings', verifyFireBaseToken, async (req, res) => {
            try {
                const { email } = req.query;
                if (!email) {
                    return res.status(400).send({ message: "User email is required" });
                }

                const bookingsCollection = client.db('RentWheels').collection('bookings');
                const bookings = await bookingsCollection.find({ userEmail: email }).toArray();

                res.send(bookings);
            } catch (error) {
                console.error("Error fetching user bookings:", error);
                res.status(500).send({ message: "Failed to fetch bookings" });
            }
        });

        // Cancel booking → update booking status 
        app.delete('/bookings/:id', verifyFireBaseToken, async (req, res) => {
            try {
                const id = req.params.id;
                const RentWheels = client.db('RentWheels');
                const bookingsCollection = RentWheels.collection('bookings');
                const carsCollection = RentWheels.collection('cars');


                const booking = await bookingsCollection.findOne({ _id: new ObjectId(id) });
                if (!booking) return res.status(404).send({ message: "Booking not found" });


                await bookingsCollection.deleteOne({ _id: new ObjectId(id) });


                await carsCollection.updateOne(
                    { _id: new ObjectId(booking.carId) },
                    { $set: { status: "available" } }
                );

                res.send({ message: "Booking cancelled successfully" });
            } catch (error) {
                console.error("Cancel booking error:", error);
                res.status(500).send({ message: "Failed to cancel booking" });
            }
        });

        // Get all cars listed by a specific provider (My Listings)
        app.get('/my-cars', verifyFireBaseToken, async (req, res) => {
            try {
                const { email } = req.query;
                if (!email) {
                    return res.status(400).send({ message: "Provider email is required" });
                }

                const RentWheels = client.db('RentWheels');
                const carsCollection = RentWheels.collection('cars');

                const cars = await carsCollection.find({ providerEmail: email }).toArray();

                res.send(cars);
            } catch (error) {
                console.error("Error fetching provider cars:", error);
                res.status(500).send({ message: "Failed to fetch listings" });
            }
        });

        // Delete a car
        app.delete('/cars/:id', async (req, res) => {
            try {
                const id = req.params.id;
                const result = await client
                    .db('RentWheels')
                    .collection('cars')
                    .deleteOne({ _id: new ObjectId(id) });

                if (result.deletedCount === 0)
                    return res.status(404).send({ message: "Car not found" });

                res.send({ message: "Car deleted successfully" });
            } catch (error) {
                console.error("Delete error:", error);
                res.status(500).send({ message: "Failed to delete car" });
            }
        });


        console.log("I successfully connected to MongoDB!");
    }
    finally {

    }
}
run().catch(console.dir)


app.listen(port, () => {
    console.log(`My server is running on port ${port}`);
})

