'use strict';
const Alexa = require("ask-sdk-core");

const firebase = require('firebase');
require("firebase/auth");
require("firebase/firestore");

var config = {
    apiKey: "AIzaSyBPUBLiY-FCuqpJLVibdr-RoiUt4wzbaLE",
    authDomain: "airspace-management-app.firebaseapp.com",
    databaseURL: "https://airspace-management-app.firebaseio.com",
    projectId: "airspace-management-app",
    storageBucket: "airspace-management-app.appspot.com",
    messagingSenderId: "927508779333"
};

firebase.initializeApp(config);
var db = firebase.firestore();

// var admin = require('firebase-admin');

// var serviceAccount = require('airspace-management-app-firebase-adminsdk-08c03-abca33ebd3.json');

// admin.initializeApp({
//   credential: admin.credential.cert(serviceAccount),
//   databaseURL: 'https://airspace-management-app.firebaseio.com'
// });

var Airtable = require('airtable');
var base = new Airtable({ apiKey: 'keyz3xvywRem7PtDO' }).base('app3AbmyNz7f8Mkb4');

const LaunchRequestHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === "LaunchRequest";
    },
    async handle(handlerInput) {
        console.log("LaunchRequest");

        var speechText = "Welcome to Airspace Assistant! Please link your Airspace account in the Alexa App to continue.";

        const accessToken =
            handlerInput.requestEnvelope.context.System.user.accessToken;

        // Test if user has linked his account.
        if (!accessToken) {
            return handlerInput.responseBuilder.speak(speechText).getResponse();
        }

        // Alexa will save our custom token in the access token field, so we can use it here.
        await firebase
            .auth()
            .signInWithCustomToken(accessToken)
            .catch((error) => {
                // Handle Errors here.
                var errorCode = error.code;
                var errorMessage = error.message;
                console.log(errorMessage);
                return handlerInput.responseBuilder.speak(speechText).getResponse();
            });

        let user = firebase.auth().currentUser;

        if (user) {
            // login successful
            speechText = `Welcome to Airspace Assistant! You can easily submit service requests to your office administrator.`;
            const repromptText = "For example, you can say Tell Air space we're out of granola bars or we need cleaning and food for an event tomorrow.";

            // ATTENTION: This is very important. Without this the function will time out.
            await firebase.auth().signOut();

            return handlerInput.responseBuilder.speak(speechText).reprompt(repromptText).getResponse();
        } else {
            // No user is signed in.
            speechText = "Welcome to Airspace Assistant! Please link your Airspace account in the Alexa App to continue.";

            // ATTENTION: This is very important. Without this the function will time out.
            await firebase.auth().signOut();

            return handlerInput.responseBuilder.speak(speechText).getResponse();
        }
    }
};

const addRequestHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && handlerInput.requestEnvelope.request.intent.name === 'ServiceRequest';
    },
    async handle(handlerInput) {

        var speechText = "Please link your Airspace account in the Alexa App to continue.";

        const accessToken = handlerInput.requestEnvelope.context.System.user.accessToken;

        // Test if user has linked his account.
        if (!accessToken) {
            return handlerInput.responseBuilder.speak(speechText).getResponse();
        }

        await firebase
            .auth()
            .signInWithCustomToken(accessToken)
            .catch((error) => {
                // Handle Errors here.
                var errorCode = error.code;
                var errorMessage = error.message;
                console.log(errorMessage);
                return handlerInput.responseBuilder.speak(speechText).getResponse();
            });

        let user = firebase.auth().currentUser;

        try {
            if (user) {
                // login successful
                speechText = 'Got it!';

                const userUID = user.uid;

                const officeUID = await db.collection('alexa-auth-codes').doc(userUID).get()
                    .then(docRef => {
                        const data = docRef.data() || null;
                        if (data === null) {
                            throw Error(speechText);

                        }
                        const officeUID = data.selectedOfficeUID || null;
                        if (officeUID === null) {
                            throw Error(speechText);
                        }
                        return officeUID;
                    })


                const officeProfileATID = await db.collection('offices').doc(officeUID).get()
                    .then(docRef => {
                        const data = docRef.data() || null;
                        if (data === null) {
                            throw Error(speechText);

                        }
                        const atid = data.officeProfileATID || null;
                        if (atid === null) {
                            throw Error(speechText);
                        }
                        return atid;
                    })

                var issueNote = handlerInput.resuestEnvelope.request.intent.slots.issue.value;

                await base('Alexa Requests').create({
                    "Notes": issueNote,
                    "Office": [
                        officeProfileATID
                    ]
                }, function (err, record) {
                    if (err) {
                        console.error(err);
                        throw err;
                    }
                    return
                });

                // ATTENTION: This is very important. Without this the function will time out.
                await firebase.auth().signOut();

                return handlerInput.responseBuilder
                    .speak(speechText)
                    .withShouldEndSession(true)
                    .getResponse();

            } else {
                // No user is signed in.
                throw Error(speechText);
            }

        } catch (error) {
            // ATTENTION: This is very important. Without this the function will time out.
            await firebase.auth().signOut();

            return handlerInput.responseBuilder.speak(error.message).getResponse();
        }
    }
};

const SessionEndedRequestHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'SessionEndedRequest';
    },
    handle(handlerInput) {
        //any cleanup logic goes here
        return handlerInput.responseBuilder.getResponse();
    }
};

const ErrorHandler = {
    canHandle() {
        return true;
    },
    handle(handlerInput, error) {
        console.log(`Error handled: ${error.message}`);

        return handlerInput.responseBuilder
            .speak('Sorry, I can\'t understand the command. Please say again.')
            .reprompt('Sorry, I can\'t understand the command. Please say again.')
            .getResponse();
    },
};

let skill;

const handler = async (event, context) => {

    console.log(`REQUEST++++${JSON.stringify(event)}`);

    if (!skill) {
        skill = Alexa.SkillBuilders.custom()
            .addRequestHandlers(
                LaunchRequestHandler,
                addRequestHandler,
                SessionEndedRequestHandler
            )
            .addErrorHandlers(ErrorHandler)
            .create();
    }

    const response = await skill.invoke(event, context);
    console.log(`RESPONSE++++${JSON.stringify(response)}`);

    return response;
}

exports.handler = (events, context) => handler(events, context);

// function buildResponse(options) {
//     // options.speechText
//     // options.endSession
//     // options.repromptText (optional)

//     var response = {
//         version: "1.0",
//         response: {
//             outputSpeech: {
//                 type: "PlainText",
//                 text: options.speechText
//             },
//             shouldEndSession: options.endSession
//         }
//     }

//     if (options.repromptText) {
//         response.response.reprompt = {
//             outputSpeech: {
//                 type: "PlainText",
//                 text: options.repromptText
//             }
//         }
//     }

//     return response;
// }

// const handler = (events, context) => {

//     var request = event.request;
//     const type = request.type;

//     try {
//         if (type === "LaunchRequest") {

//         } else if (type === "IntentRequest") {
//             let options = {};
//             const intent = request.intent;
//             const intentName = intent.name;
//             const slots = intent.slots;

//         } else if (type === "SessionEndedRequest") {

//         } else {
//             throw Error("Unknown intent type.");
//         }
//     } catch (error) {
//         context.fail("Exception: " + error);
//     }
// }