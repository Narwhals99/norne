/* What vendor/firebase.js exports. Rebuild after changing this list:
   npm i firebase@13.0.0 esbuild && npx esbuild vendor/firebase-entry.js --bundle --format=esm --minify --legal-comments=eof --outfile=vendor/firebase.js */
export {initializeApp} from 'firebase/app';
export {getAuth, onAuthStateChanged, signInWithPopup, signInWithCredential, signOut, GoogleAuthProvider, connectAuthEmulator} from 'firebase/auth';
export {initializeFirestore, connectFirestoreEmulator, doc, collection, query, where, onSnapshot, getDoc, getDocFromCache, setDoc, updateDoc, deleteDoc, deleteField, writeBatch, FieldPath, persistentLocalCache, persistentMultipleTabManager, clearIndexedDbPersistence, terminate} from 'firebase/firestore';
