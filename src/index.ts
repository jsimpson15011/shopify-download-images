var fs = require('fs'),
    request = require('request');

var download = function (uri: string, filename: string, callback: any) {
    request.head(uri, function (err: any, res: any, body: any) {
        console.log('content-type:', res.headers['content-type']);
        console.log('content-length:', res.headers['content-length']);

        request(uri).pipe(fs.createWriteStream(filename)).on('close', callback);
    });
};

let mysql = require('mysql2');

import express from 'express';
import Shopify, {ApiVersion, AuthQuery} from '@shopify/shopify-api';

require('dotenv').config();

const app = express();

const {API_KEY, API_SECRET_KEY, SCOPES, SHOP, HOST} = process.env;


let connection = mysql.createConnection({
    host: process.env.DATABASE_HOST,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE
})

connection.connect(function(err:any) {
    if (err) {
        return console.error('error: ' + err.message);
    }

    console.log('Connected to the MySQL server.');
});

Shopify.Context.initialize({
    API_KEY,
    API_SECRET_KEY,
    SCOPES: [SCOPES],
    HOST_NAME: process.env.HOST.replace(/https:\/\//, ""),
    IS_EMBEDDED_APP: false,
    API_VERSION: ApiVersion.October20 // all supported versions are available, as well as "unstable" and "unversioned"
});

// Storing the currently active shops in memory will force them to re-login when your server restarts. You should
// persist this object in your app.
const ACTIVE_SHOPIFY_SHOPS: { [key: string]: string | undefined } = {};

// the rest of the example code goes here


const throttle = (func: any, limit: number) => {
    let lastFunc: NodeJS.Timeout;
    let lastRan: number;
    return function() {
        const context = this;
        const args = arguments;
        if (!lastRan) {
            func.apply(context, args)
            lastRan = Date.now();
        } else {
            clearTimeout(lastFunc);
            lastFunc = setTimeout(function() {
                if ((Date.now() - lastRan) >= limit) {
                    func.apply(context, args);
                    lastRan = Date.now();
                }
            }, limit - (Date.now() - lastRan));
        }
    }
}

app.get("/", async (req, res) => {
    // This shop hasn't been seen yet, go through OAuth to create a session
    if (ACTIVE_SHOPIFY_SHOPS[SHOP] === undefined) {
        // not logged in, redirect to login
        res.redirect(`/login`);
    } else {
        res.send("Hello world!");

        // Load the current session to get the `accessToken`.
        const session = await Shopify.Utils.loadCurrentSession(req, res);
// Create a new client for the specified shop.
        const client = new Shopify.Clients.Rest(session.shop, session.accessToken);
// Use `client.get` to request the specified Shopify REST API endpoint, in this case `products`.
        let products:any = await client.get({
            path: 'products',
            query: {"since_id":"0","limit":250}
        });
        async function goThroughProducts(products:any, lastID: string) {
            if(products.body.products.length > 0){
                let i = 0;
                for (i = 0; i < products.body.products.length; i++) {
                    for(let j = 0; j < products.body.products[i].images.length; j++){
                        const currImg = products.body.products[i].images[j]
                        console.log(currImg)
                        if(currImg['variant_ids'].length > 0){
                            console.log(currImg['variant_ids'])
                        }
                    }

                    lastID = products.body.products[i].id
                }
                throttle( goThroughProducts(await client.get({
                    path: 'products',
                    query: {"since_id": lastID,"limit":250}
                }), lastID), 501)

            }
        }

        await goThroughProducts(products, '0')










        // Load your app skeleton page with App Bridge, and do something amazing!
        res.end();
    }
});

app.get('/login', async (req, res) => {
    let authRoute = await Shopify.Auth.beginAuth(
        req,
        res,
        SHOP,
        '/auth/callback',
        false,
    );
    return res.redirect(authRoute);
});

app.get('/auth/callback', async (req, res) => {
    try {
        const session = await Shopify.Auth.validateAuthCallback(
            req,
            res,
            req.query as unknown as AuthQuery,
        ); // req.query must be cast to unkown and then AuthQuery in order to be accepted
        ACTIVE_SHOPIFY_SHOPS[SHOP] = session.scope;
        console.log(session.accessToken);
    } catch (error) {
        console.error(error); // in practice these should be handled more gracefully
    }
    return res.redirect(`/?host=${req.query.host}&shop=${req.query.shop}`); // wherever you want your user to end up after OAuth completes
});

app.listen(3000, () => {
    console.log('your app is now listening on port 3000');
});


