const express = require('express');
const cors = require('cors');

const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser') // this is help to set token or cookie in the req.cookies

const app = express();
const port = process.env.PORT || 6900;
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

// middleware
app.use(cors(
    {
        origin: ['http://localhost:5173'], //send token to client site
        credentials: true
    }
));
app.use(express.json());
app.use(cookieParser());

// creating a middleware for verify the token system  and set what will happen when token will change or deleted
const verifyToken = (req, res, next) => {

    const token = req?.cookies?.token;


    // jodi token na thake 
    if (!token) {
        return res.status(401).send({ message: 'Unauthorized access' })
    }

    // jodi token thake kintu oita vul ba expired thake tokhon 
    jwt.verify(token, process.env.JWT_ACCESS_TOKEN, (err, decoded) => {
        if (err) {
            return res.status(401).send({ message: 'Unauthorized access' })
        }

        // decoded er man ta req.dataOfDecoded a set hobe 
        req.dataOfDecoded = decoded;
        next();
    })


}


// job-portal 
// sR7b4tGiIOsYcWKH



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.v3edin0.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {

    const hotJobsDB = client.db("jobPortalBD").collection("jobs");
    const jobApplicationsCollection = client.db('jobPortalBD').collection("job_application");

    try {

        // await client.connect();
        // console.log("Pinged your deployment. You successfully connected to MongoDB!");


        // jwt related working 
        app.post('/jwt', (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.JWT_ACCESS_TOKEN, { expiresIn: '1hr' });

            res
                .cookie('token', token, {
                    httpOnly: true,
                    secure: false,
                })
                .send({ success: true })
        })

        // for clean the token from client site in cookie 
        app.post('/logOut', (req, res) => {

            res
                .clearCookie('token', {
                    httpOnly: true,
                    secure: false
                })
                .send({ success: true })
        })


        app.get('/jobs', async (req, res) => {
            // const result = hotJobsDB.find().toArray()
            const email = req.query.email;
            let query = {};
            if (email) {
                query = { hrEmail: email }
            }
            const cursor = hotJobsDB.find(query);
            const result = await cursor.toArray();
            res.send(result);
        })

        // this code will help find a job details 
        app.get('/jobs/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await hotJobsDB.findOne(query);
            res.send(result)
        })
        app.post('/jobs', async (req, res) => {
            const data = req.body;
            const result = await hotJobsDB.insertOne(data);
            res.send(result);
        })

        // get all data , get one data, get some data [0,1,many] 
        app.get('/job-application', verifyToken, async (req, res) => {
            const email = req.query.email;
            // ekhan a applicant_email ta hocche user je mail ta diya login korche oi email ta 
            const query = { applicant_email: email }

            // jodi token decoded hoy tokhon
            if (req.dataOfDecoded.email !== email) {
                return res.status(403).send({ message: 'forbidden access' });
            }


            // this is for recevied tokon from client site 
            // console.log(req.cookies?.token);


            const result = await jobApplicationsCollection.find(query).toArray();

            for (const application of result) {
                // ekhan a job_id ta hocche apply korar somoy je card a click korchilam oitar job id ,tai ei id ta diya hotjobsDB theke data find kore ana jabe
                const query1 = { _id: new ObjectId(application.job_id) }
                const job = await hotJobsDB.findOne(query1);
                if (job) {
                    application.title = job.title;
                    application.company = job.company;
                    application.company_logo = job.company_logo;
                    application.location = job.location;
                    application.jobType = job.jobType;
                    application.category = job.category;
                    application.salaryRange = job.salaryRange;
                }
            }

            res.send(result);
        })


        app.delete('/job-application/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await jobApplicationsCollection.deleteOne(query);
            res.send(result);
        })

        app.get('/job-application/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await jobApplicationsCollection.findOne(query);
            res.send(result);
        })

        // it is helping to read data for view appications in my postedJods 
        app.get('/job-application/jobs/:job_id', async (req, res) => {
            const jobId = req.params.job_id;
            const query = { job_id: jobId }
            const result = await jobApplicationsCollection.find(query).toArray();
            res.send(result)
        })

        // job application api
        app.post('/job-applications', async (req, res) => {
            const application = req.body;
            const result = await jobApplicationsCollection.insertOne(application);
            // not the best Way (use aggregate) 
            const id = application.job_id;
            const query = { _id: new ObjectId(id) };
            const job = await hotJobsDB.findOne(query);
            let newCount = 0;
            if (job.applicationCount) {
                newCount = job.applicationCount + 1
            }
            else {
                newCount = 1
            }
            // now update the job info 
            const filter = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: {
                    applicationCount: newCount
                }
            }
            const updateResult = await hotJobsDB.updateOne(filter, updateDoc)


            res.send(result);
        })


        // update the status value of viewApplication
        app.patch('/job-application/:id', async (req, res) => {
            const id = req.params.id;
            const data = req.body;
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    status: data.status
                }
            }
            const result = await jobApplicationsCollection.updateOne(filter, updateDoc);
            res.send(result);
        })

    } finally {

        // await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('this is job portal server and active')
})

app.listen(port, () => {
    // console.log(`this job portal server site running from port ${port}`)
})