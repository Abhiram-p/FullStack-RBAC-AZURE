const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const axios = require('axios');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET || 'a_secure_random_jwt_secret_12345';

// --- MONGODB CONNECTION ---
const mongoURI = process.env.MONGO_URI || process.env.AZURE_COSMOS_CONNECTIONSTRING;
mongoose.connect(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useFindAndModify: false,
    useCreateIndex: true
})
    .then(() => console.log("Connected to MongoDB (Azure Cosmos)"))
    .catch(err => console.error("MongoDB Connection Error:", err));

// --- SCHEMAS ---
const userSchema = new mongoose.Schema({
    name: String,
    email: { type: String, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    role: { type: String, default: 'User' },
    group: { type: String, default: 'none' },
    banned: { type: Boolean, default: false },
    registrationType: { type: String, default: 'email' },
    lastLogin: String
});

const groupSchema = new mongoose.Schema({
    name: { type: String, unique: true },
    permissions: {
        canBan: Boolean,
        canDelete: Boolean,
        canChangeRole: Boolean,
        canAssignGroup: Boolean,
        canViewLogs: Boolean,
        canViewUsers: Boolean
    }
}, { timestamps: true });

const logSchema = new mongoose.Schema({
    action: String,
    target: String,
    performedBy: String,
    timestamp: String,
    date: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Group = mongoose.model('Group', groupSchema);
const Log = mongoose.model('Log', logSchema);

// Middleware
app.use(express.json());
app.use(express.static(__dirname));

// --- ACCESS HELPER ---
const getDashboardAccess = async (user) => {
    if (user.role === 'Admin' || user.role === 'Manager') return true;
    if (user.group && user.group !== 'none') {
        const group = await Group.findOne({ name: user.group });
        if (group && group.permissions) {
            const perms = group.permissions;
            return perms.canBan || perms.canDelete || perms.canChangeRole || perms.canAssignGroup || perms.canViewLogs;
        }
    }
    return false;
};

// --- JWT RBAM + GBAM Middleware ---
const authorize = (permission) => {
    return async (req, res, next) => {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) return res.status(401).json('unauthorized');

        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            if (decoded.id === 'admin-id') { req.user = decoded; return next(); }

            const user = await User.findById(decoded.id);
            if (!user) return res.status(401).json('user not found');
            if (user.banned) return res.status(403).json('banned');

            req.user = user;
            if (user.role === 'Admin') return next();

            const managerDefaults = ['canViewUsers', 'canBan', 'canAssignGroup'];
            if (user.role === 'Manager' && managerDefaults.includes(permission)) return next();

            if (user.group && user.group !== 'none') {
                const group = await Group.findOne({ name: user.group });
                if (group && group.permissions && group.permissions[permission]) return next();
            }
            res.status(403).json('forbidden');
        } catch (err) { return res.status(403).json('invalid token'); }
    };
};

const createLog = async (action, targetUser, performedBy) => {
    try {
        const newLog = new Log({ action, target: targetUser, performedBy, timestamp: new Date().toLocaleString() });
        await newLog.save();
    } catch (error) { console.error("Logging Error:", error); }
};

// --- ROUTES ---
app.get('/check-auth', async (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json('no token');
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.id === 'admin-id') return res.json({ ...decoded, hasDashboardAccess: true });
        const user = await User.findById(decoded.id).select('-password');
        const hasDashboardAccess = await getDashboardAccess(user);
        res.json({ ...user._doc, id: user._id, hasDashboardAccess });
    } catch (err) { res.status(401).json('invalid token'); }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'login.html')));
app.get('/register', (req, res) => res.sendFile(path.join(__dirname, 'register.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));

app.post('/register-user', async (req, res) => {
    let { name, email, password } = req.body;
    if (!name || !email || !password) return res.json('Fill all the fields');
    try {
        const existing = await User.findOne({ email });
        if (existing) return res.json('email already exists');
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ name, email, password: hashedPassword });
        await newUser.save();
        const payload = { id: newUser._id, name: newUser.name, email: newUser.email, role: newUser.role, group: newUser.group, hasDashboardAccess: false };
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
        res.json({ ...payload, token });
    } catch (error) { res.json('registration failed'); }
});

app.post('/login-user', async (req, res) => {
    let { email, password } = req.body;
    if (email === 'admin' && password === 'admin') {
        const payload = { name: 'Admin', email: 'admin@system.local', role: 'Admin', group: 'none', id: 'admin-id', hasDashboardAccess: true };
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
        return res.json({ ...payload, token });
    }
    try {
        const user = await User.findOne({ email });
        if (!user) return res.json('invalid email or password');
        const match = await bcrypt.compare(password, user.password);
        if (!match) return res.json('invalid email or password');
        if (user.banned) return res.json('your account is banned');
        user.lastLogin = new Date().toLocaleString();
        await user.save();
        const hasDashboardAccess = await getDashboardAccess(user);
        const payload = { id: user._id, name: user.name, email: user.email, role: user.role, group: user.group, hasDashboardAccess };
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
        res.json({ ...payload, token });
    } catch (error) { res.json('login failed'); }
});

app.post('/github-login', async (req, res) => {
    const { code } = req.body;
    try {
        const tokenResponse = await axios.post('https://github.com/login/oauth/access_token', {
            client_id: process.env.GITHUB_CLIENT_ID,
            client_secret: process.env.GITHUB_CLIENT_SECRET,
            code: code
        }, { headers: { Accept: 'application/json' } });
        const accessToken = tokenResponse.data.access_token;
        const userResponse = await axios.get('https://api.github.com/user', { headers: { Authorization: `token ${accessToken}` } });
        const emailsResponse = await axios.get('https://api.github.com/user/emails', { headers: { Authorization: `token ${accessToken}` } });
        const primaryEmail = emailsResponse.data.find(e => e.primary).email;
        const { name, login } = userResponse.data;
        let user = await User.findOne({ email: primaryEmail });
        if (!user) {
            user = new User({ name: name || login, email: primaryEmail, password: await bcrypt.hash(Math.random().toString(36), 10), registrationType: 'github' });
            await user.save();
        } else {
            if (user.banned) return res.status(403).json('your account is banned');
            user.lastLogin = new Date().toLocaleString();
            await user.save();
        }
        const hasDashboardAccess = await getDashboardAccess(user);
        const jwtPayload = { id: user._id, name: user.name, email: user.email, role: user.role, group: user.group, hasDashboardAccess };
        const token = jwt.sign(jwtPayload, JWT_SECRET, { expiresIn: '24h' });
        res.json({ ...jwtPayload, token });
    } catch (error) { res.status(401).json('github authentication failed'); }
});

// Admin API
app.get('/get-users', authorize('canViewUsers'), async (req, res) => {
    const users = await User.find().select('-password');
    res.json(users.map(u => ({ ...u._doc, id: u._id })));
});

app.get('/get-groups', authorize('canViewUsers'), async (req, res) => {
    const groups = await Group.find();
    res.json(groups.map(g => ({ ...g._doc, name: g.name })));
});

app.post('/create-group', authorize('canCreateGroup'), async (req, res) => {
    const { groupName, permissions } = req.body;
    try {
        const newGroup = new Group({ name: groupName, permissions });
        await newGroup.save();
        await createLog(`Created Group: ${groupName}`, 'N/A', req.user.email);
        res.json('success');
    } catch (error) { res.json('error'); }
});

app.post('/update-group', authorize('canCreateGroup'), async (req, res) => {
    const { groupName, permissions } = req.body;
    try {
        await Group.findOneAndUpdate({ name: groupName }, { permissions });
        await createLog(`Updated Group: ${groupName}`, 'N/A', req.user.email);
        res.json('success');
    } catch (error) { res.json('error'); }
});

app.post('/delete-group', authorize('canCreateGroup'), async (req, res) => {
    const { groupName } = req.body;
    try {
        await Group.findOneAndDelete({ name: groupName });
        await createLog(`Deleted Group: ${groupName}`, 'N/A', req.user.email);
        res.json('success');
    } catch (error) { res.json('error'); }
});

app.post('/assign-group', authorize('canAssignGroup'), async (req, res) => {
    const { userId, groupName } = req.body;
    try {
        const user = await User.findByIdAndUpdate(userId, { group: groupName });
        await createLog(`Assigned Group: ${groupName}`, user.email, req.user.email);
        res.json('success');
    } catch (error) { res.json('error'); }
});

app.post('/update-role', authorize('canChangeRole'), async (req, res) => {
    const { userId, role } = req.body;
    try {
        const user = await User.findByIdAndUpdate(userId, { role });
        await createLog(`Updated Role: ${role}`, user.email, req.user.email);
        res.json('success');
    } catch (error) { res.json('error'); }
});

app.post('/toggle-ban', authorize('canBan'), async (req, res) => {
    const { userId, banned } = req.body;
    try {
        const user = await User.findByIdAndUpdate(userId, { banned });
        const userDoc = await User.findById(userId);
        await createLog(banned ? 'Banned User' : 'Unbanned User', userDoc.email, req.user.email);
        res.json('success');
    } catch (error) { res.json('error'); }
});

app.post('/delete-user', authorize('canDelete'), async (req, res) => {
    const { userId } = req.body;
    try {
        const userDoc = await User.findById(userId);
        const userEmail = userDoc ? userDoc.email : 'Unknown';
        await User.findByIdAndDelete(userId);
        await createLog('Deleted User', userEmail, req.user.email);
        res.json('success');
    } catch (error) { res.json('error'); }
});

app.get('/get-logs', authorize('canViewLogs'), async (req, res) => {
    try {
        const logs = await Log.find().limit(50);
        res.json(logs);
    } catch (error) { res.json([]); }
});

app.listen(PORT, '0.0.0.0', () => console.log(`Server is running on http://0.0.0.0:${PORT}`));
