// Firebase Realtime Database – shared handle for app.js and archive.html.
// No backend anymore: the browser talks to the database directly; security lives in database.rules.json.
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";
import { firebaseConfig } from "./firebase-config.js";

export const db = getDatabase(initializeApp(firebaseConfig));
export * from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";
