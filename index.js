require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const MongoClient = require('mongodb').MongoClient;
const ObjectID = require('mongodb').ObjectID;
const fileUpload = require('express-fileupload');
const admin = require('firebase-admin');
const imgbbUploader = require("imgbb-uploader");
const fs = require('fs')


const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(fileUpload());

const dbInfo = {
  DB_USER:process.env.DB_USER,
  DB_PASS:process.env.DB_PASS,
  DB_NAME:process.env.DB_NAME,
  FIREBASE_DB_URL: process.env.FIREBASE_DB_URL,
}

const serviceAccount = require("./hot-onion-by-mahbub-firebase-adminsdk-2kp9t-6a8372e39c.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: `${dbInfo.FIREBASE_DB_URL}`
});

const uri = `mongodb+srv://${dbInfo.DB_USER}:${dbInfo.DB_PASS}@hot-onion-restaurant.1otew.mongodb.net/${dbInfo.DB_NAME}?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true  });

client.connect(err => {
  const adminCollection = client.db(`${dbInfo.DB_NAME}`).collection("admin");
  const allFoodCollection = client.db(`${dbInfo.DB_NAME}`).collection("AllFood");
  const ordersCollection = client.db(`${dbInfo.DB_NAME}`).collection("orders");
  const reviewCollection = client.db(`${dbInfo.DB_NAME}`).collection("review");


const handleToken = bearer => {
  if(bearer && bearer.startsWith('Bearer ')){
    const idToken = bearer.split(' ')[1];
      return admin.auth().verifyIdToken(idToken)
      .then(function(decodedToken) {
        let tokenEmail = decodedToken.email;
        return tokenEmail;
      });
  };
};

  app.get('/order_list', (req, res) =>{
    const bearer = req.headers.authorization;
    const queryEmail = req.query.admin_email;
    const tokenEmail = handleToken(bearer);
      tokenEmail.then(decodeEmail => {
        if(decodeEmail === queryEmail){
          adminCollection.find({adminEmail: queryEmail})
          .toArray((err, result) => {
            if(result.length){
              ordersCollection.find()
              .toArray((err, documents) => {
                if(documents){
                  res.send(documents);
                };
              });
            };
          });
        }
        else{
          res.status(401).send('Unauthorized access');
        };
      });
  });
  
  app.patch('/updateStatus/:id', (req, res) => {
    const bearer = req.headers.authorization;
    const tokenEmail = handleToken(bearer);
    tokenEmail.then(decodeEmail => {
        if(decodeEmail){
          adminCollection.find({adminEmail: decodeEmail})
          .toArray((err, result) => {
            if(result.length){
              ordersCollection.updateOne({_id: ObjectID(req.params.id)},
                {
                  $set:{status: req.body.changeStatus}
                })
                .then(result => {
                    if(result.matchedCount > 0){
                      res.send(result.matchedCount > 0);
                    };
                });
            };
          });
      }
      else{
            res.status(401).send('Unauthorized access');
      };
    });
});

  app.post('/add_order', (req, res) =>{
    const bearer = req.headers.authorization;
    const queryEmail = req.query.email;
    const tokenEmail = handleToken(bearer);
      tokenEmail.then(decodeEmail => {
        if(decodeEmail === queryEmail){
          ordersCollection.insertOne(req.body)
          .then(result =>{
              res.send(result.insertedCount > 0);
          });
        }
        else{
          res.status(401).send('Unauthorized access');
        };
      });
  });

  app.get('/my_orders', (req, res) =>{
    const bearer = req.headers.authorization;
    const queryEmail = req.query.email;
    const tokenEmail = handleToken(bearer);
      tokenEmail.then(decodeEmail => {
        if(decodeEmail === queryEmail){
            ordersCollection.find({orderEmail: queryEmail})
            .toArray((err, documents) => {
              if(documents){
                res.send(documents);
              };
            });
        }
        else{
              res.status(401).send('Unauthorized access');
        };
      });
  });

  app.get('/get_all_food', (req, res) =>{
    allFoodCollection.find()
    .toArray((err, documents) => {
      if(documents){
        res.send(documents);
      };
    });
  });


  app.get('/get_single_food/:category', (req, res) =>{
    allFoodCollection.find({category: req.params.category})
    .toArray((err, document) => {
      if(document){
        res.send(document);
      };
    });
  });

    app.post('/add_food', (req, res) =>{
      adminCollection.find({adminEmail: req.query.check_admin})
      .toArray((err, results) => {
        if(results.length){
            const img_link = req.files.file;
            const name = req.body.name;
            const title = req.body.title;
            const category = req.body.category;
            const description = req.body.description;
            const price = req.body.price;
            
            const date = new Date();
            const imagePath = `${__dirname}/image/${ String(date.getUTCMilliseconds()) + "_"  + Math.ceil(123454 * Math.random()) + "_"  + img_link.name }`
            img_link.mv(imagePath);

            
            imgbbUploader( process.env.IMGBB_API_KEY, imagePath)
            .then((response) => {
                const image_link = response.url;    
                allFoodCollection.insertOne({name, title, category, description, price, image_link})
                .then(documents =>{
                    fs.unlink(imagePath, err => console.error(err));
                    res.send(documents.insertedCount > 0);
                });    
            })
            .catch((error) => console.error(error));
        };
      });
    });


    app.post('/add_review', (req, res) =>{
      const bearer = req.headers.authorization;
      const queryEmail = req.query.user_email;
      const tokenEmail = handleToken(bearer);
        tokenEmail.then(decodeEmail => {
          if(decodeEmail === queryEmail){
            reviewCollection.insertOne(req.body)
            .then(result =>{
                res.send(result.insertedCount > 0);
            });
          }
          else{
              res.status(401).send('Unauthorized access');
          };
        });
    });
    
    app.get('/review', (req, res) =>{
      reviewCollection.find()
      .toArray((err, documents) => {
        if(documents){
          res.send(documents);
        };
      });
    });

    app.post('/make_admin', (req, res) =>{
      const bearer = req.headers.authorization;
      const queryEmail = req.query.check_admin;
      const tokenEmail = handleToken(bearer);
        tokenEmail.then(decodeEmail => {
          if(decodeEmail === queryEmail){
            adminCollection.find({adminEmail: decodeEmail})
            .toArray((err, results) => {
              if(results.length){
                adminCollection.insertOne(req.body)
                .then(documents =>{
                    res.send(documents.insertedCount > 0);
                });
              };
            });
          }
          else{
              res.status(401).send('Unauthorized access');
          };
        });
    });

    app.get('/isAdmin', (req, res) =>{
      adminCollection.find({adminEmail: req.query.email})
      .toArray((err, result) => {
        if(result){
          res.send(result.length > 0);
        };
      });
    });



});

app.get('/', (req, res) => {
    res.send('Hello World');
  });
  
app.listen( process.env.PORT || 8080);