require("dotenv").config();

const {
    initializeApp,
    applicationDefault,
    cert
} = require("firebase-admin/app");

let credencial;

if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    const cuentaServicio = JSON.parse(
        process.env.FIREBASE_SERVICE_ACCOUNT_JSON
    );

    credencial = cert(cuentaServicio);
} else {
    credencial = applicationDefault();
}

const app = initializeApp({
    credential: credencial,
    projectId: "constructor-examenes"
});

module.exports = { app };
