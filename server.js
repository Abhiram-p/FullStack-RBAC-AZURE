const express = require('express');
const path = require('path');
const admin = require('firebase-admin');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');
const session = require('express-session');

dotenv.config();

// Initialize Firebase Admin
const serviceAccount = require(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || './firebase-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL
});

const db = admin.firestore();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(__dirname));
app.use(session({
    secret: 'mysecretkey',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
}));

// Role Check Middleware
const checkRole = (roles) => {
    return (req, res, next) => {
        if (!req.session.user) return res.status(401).json('unauthorized');
        if (!roles.includes(req.session.user.role)) return res.status(403).json('forbidden');
        next();
    };
};

// Routes for serving HTML files
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'login.html')));
app.get('/register', (req, res) => res.sendFile(path.join(__dirname, 'register.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));

// API Routes
app.post('/register-user', async (req, res) => {
    let { name, email, password } = req.body;
    if (!name || !email || !password) return res.json('Fill all the fields');
    email = email.toLowerCase().trim();

    try {
        const userCheck = await db.collection('users').where('email', '==', email).get();
        if (!userCheck.empty) return res.json('email already exists');

        const hashedPassword = await bcrypt.hash(password, 10);
        const userData = {
            name, email, password: hashedPassword,
            role: 'User', // Default role
            banned: false,
            registrationType: 'email',
            group: 'none',
            lastLogin: new Date().toLocaleString()
        };
        
        await db.collection('users').add(userData);
        res.json({ name, email, role: 'User' });
    } catch (error) {
        res.json('registration failed');
    }
});

app.post('/login-user', async (req, res) => {
    let { email, password } = req.body;
    
    // Hardcoded Admin Override
    if (email === 'admin' && password === 'admin') {
        req.session.user = { name: 'Admin', email: 'admin@system.local', role: 'Admin' };
        return res.json(req.session.user);
    }

    if (!email || !password) return res.json('Fill all the fields');
    email = email.toLowerCase().trim();

    try {
        const userSnapshot = await db.collection('users').where('email', '==', email).get();
        if (userSnapshot.empty) return res.json('invalid email or password');

        const userDoc = userSnapshot.docs[0];
        const userData = userDoc.data();

        const passwordMatch = await bcrypt.compare(password, userData.password);
        if (!passwordMatch) return res.json('invalid email or password');
        if (userData.banned) return res.json('your account is banned');

        const lastLogin = new Date().toLocaleString();
        await userDoc.ref.update({ lastLogin });

        // Set session
        req.session.user = { 
            name: userData.name, 
            email: userData.email, 
            role: userData.role || 'User',
            group: userData.group || 'none'
        };

        res.json(req.session.user);
    } catch (error) {
        res.json('login failed');
    }
});

// Admin Panel Endpoints (Protected by RBAM)
app.get('/get-users', checkRole(['Admin', 'Manager']), async (req, res) => {
    try {
        const usersSnapshot = await db.collection('users').get();
        const usersData = [];
        usersSnapshot.forEach(doc => {
            const data = doc.data();
            delete data.password;
            usersData.push({ id: doc.id, ...data });
        });
        res.json(usersData);
    } catch (error) {
        res.json([]);
    }
});

app.get('/get-groups', checkRole(['Admin', 'Manager']), async (req, res) => {
    try {
        const groupsSnapshot = await db.collection('groups').get();
        const groups = [];
        groupsSnapshot.forEach(doc => groups.push(doc.id));
        res.json(groups);
    } catch (error) {
        res.json([]);
    }
});

app.post('/create-group', checkRole(['Admin']), async (req, res) => {
    const { groupName } = req.body;
    try {
        await db.collection('groups').doc(groupName).set({ createdAt: new Date() });
        res.json('success');
    } catch (error) {
        res.json('error');
    }
});

app.post('/assign-group', checkRole(['Admin', 'Manager']), async (req, res) => {
    const { userId, groupName } = req.body;
    try {
        await db.collection('users').doc(userId).update({ group: groupName });
        res.json('success');
    } catch (error) {
        res.json('error');
    }
});

app.post('/update-role', checkRole(['Admin']), async (req, res) => {
    const { userId, role } = req.body;
    try {
        await db.collection('users').doc(userId).update({ role });
        res.json('success');
    } catch (error) {
        res.json('error');
    }
});

app.post('/toggle-ban', checkRole(['Admin', 'Manager']), async (req, res) => {
    const { userId, banned } = req.body;
    try {
        await db.collection('users').doc(userId).update({ banned });
        res.json('success');
    } catch (error) {
        res.json('error');
    }
});

app.post('/delete-user', checkRole(['Admin']), async (req, res) => {
    const { userId } = req.body;
    try {
        await db.collection('users').doc(userId).delete();
        res.json('success');
    } catch (error) {
        res.json('error');
    }
});

app.listen(PORT, '0.0.0.0', () => console.log(`Server is running on http://0.0.0.0:${PORT}`));
