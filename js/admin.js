const userTableBody = document.querySelector('#user-table-body');
const logOut = document.querySelector('.logout');
let groups = [];

logOut.onclick = () => {
    sessionStorage.clear();
    location.href = '/login';
}

const checkAdminAuth = () => {
    const token = sessionStorage.token;
    if (!token) {
        location.href = '/login';
        return;
    }

    fetch('/check-auth', {
        headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => {
        if (!res.ok) {
            location.href = '/login';
            return;
        }
        return res.json();
    })
    .then(data => {
        if (data && data.hasDashboardAccess) {
            fetchData();
        } else {
            location.href = '/';
        }
    });
}

const showTab = (tab) => {
    document.querySelector('#section-users').classList.toggle('hidden', tab !== 'users');
    document.querySelector('#section-logs').classList.toggle('hidden', tab !== 'logs');
    document.querySelector('#section-groups').classList.toggle('hidden', tab !== 'groups');
    
    document.querySelector('#tab-users').classList.toggle('active', tab === 'users');
    document.querySelector('#tab-logs').classList.toggle('active', tab === 'logs');
    document.querySelector('#tab-groups').classList.toggle('active', tab === 'groups');

    if(tab === 'logs') fetchLogs();
    if(tab === 'groups' || tab === 'users') fetchData();
}

const fetchLogs = () => {
    fetch('/get-logs', {
        headers: { 'Authorization': `Bearer ${sessionStorage.token}` }
    })
    .then(res => res.json())
    .then(data => renderLogs(data));
}

const renderLogs = (logs) => {
    const logTableBody = document.querySelector('#log-table-body');
    logTableBody.innerHTML = '';
    logs.forEach(log => {
        logTableBody.innerHTML += `
        <tr>
            <td>${log.timestamp}</td>
            <td>${log.action}</td>
            <td>${log.target}</td>
            <td>${log.performedBy}</td>
        </tr>
        `;
    });
}

const fetchData = async () => {
    const token = sessionStorage.token;
    try {
        const [usersRes, groupsRes] = await Promise.all([
            fetch('/get-users', { headers: { 'Authorization': `Bearer ${token}` } }),
            fetch('/get-groups', { headers: { 'Authorization': `Bearer ${token}` } })
        ]);
        
        const users = await usersRes.json();
        groups = await groupsRes.json();
        
        renderUsers(users);
        renderGroups(groups);
    } catch (err) {
        console.error("Fetch Data Error:", err);
    }
}

const renderUsers = (users) => {
    userTableBody.innerHTML = '';
    users.forEach(user => {
        const groupOptions = ['none', ...groups.map(g => g.name)].map(g => 
            `<option value="${g}" ${user.group === g ? 'selected' : ''}>${g}</option>`
        ).join('');

        const roleOptions = ['User', 'Manager', 'Admin'].map(r => 
            `<option value="${r}" ${user.role === r ? 'selected' : ''}>${r}</option>`
        ).join('');

        userTableBody.innerHTML += `
        <tr>
            <td>${user.name}</td>
            <td>${user.registrationType || 'email'}</td>
            <td>
                <select onchange="updateRole('${user.id}', this.value)">
                    ${roleOptions}
                </select>
            </td>
            <td>
                <select onchange="assignGroup('${user.id}', this.value)">
                    ${groupOptions}
                </select>
            </td>
            <td>${user.lastLogin || 'N/A'}</td>
            <td>${user.banned ? 'Banned' : 'Active'}</td>
            <td>
                <button class="btn ${user.banned ? 'unban-btn' : 'ban-btn'}" onclick="toggleBan('${user.id}', ${user.banned})">
                    ${user.banned ? 'Unban' : 'Ban'}
                </button>
                <button class="btn delete-btn" onclick="deleteUser('${user.id}')">Delete</button>
            </td>
        </tr>
        `;
    });
}

const renderGroups = (groupsList) => {
    const groupTableBody = document.querySelector('#group-table-body');
    if(!groupTableBody) return;
    groupTableBody.innerHTML = '';
    
    if (!groupsList || groupsList.length === 0) {
        groupTableBody.innerHTML = '<tr><td colspan="3" style="text-align:center;">No groups found</td></tr>';
        return;
    }

    groupsList.forEach(g => {
        const permissions = g.permissions || {};
        const permsText = Object.keys(permissions).filter(k => permissions[k]).join(', ') || 'None';
        const permsString = JSON.stringify(permissions).replace(/"/g, '&quot;');

        groupTableBody.innerHTML += `
        <tr>
            <td>${g.name}</td>
            <td>${permsText}</td>
            <td>
                <button class="btn" onclick="editGroup('${g.name}', ${permsString})">Edit</button>
                <button class="btn delete-btn" onclick="deleteGroup('${g.name}')">Delete</button>
            </td>
        </tr>
        `;
    });
}

const editGroup = (name, perms) => {
    document.querySelector('#new-group-name').value = name;
    document.querySelector('#p-ban').checked = perms.canBan || false;
    document.querySelector('#p-delete').checked = perms.canDelete || false;
    document.querySelector('#p-role').checked = perms.canChangeRole || false;
    document.querySelector('#p-group').checked = perms.canAssignGroup || false;
    document.querySelector('#p-logs').checked = perms.canViewLogs || false;
    
    const btn = document.querySelector('#group-submit-btn');
    btn.innerText = "Update Group Permissions";
    btn.onclick = () => updateGroup(name);
}

const updateGroup = (groupName) => {
    const permissions = {
        canBan: document.querySelector('#p-ban').checked,
        canDelete: document.querySelector('#p-delete').checked,
        canChangeRole: document.querySelector('#p-role').checked,
        canAssignGroup: document.querySelector('#p-group').checked,
        canViewLogs: document.querySelector('#p-logs').checked,
        canViewUsers: true 
    };

    fetch('/update-group', {
        method: 'post',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionStorage.token}`
        },
        body: JSON.stringify({ groupName, permissions })
    }).then(() => {
        resetGroupForm();
        fetchData();
    });
}

const resetGroupForm = () => {
    document.querySelector('#new-group-name').value = '';
    document.querySelectorAll('#section-groups input[type="checkbox"]').forEach(c => c.checked = false);
    const btn = document.querySelector('#group-submit-btn');
    btn.innerText = "Create Group with Permissions";
    btn.onclick = createGroup;
}

const deleteGroup = (groupName) => {
    if(!confirm(`Are you sure you want to delete the group "${groupName}"?`)) return;

    fetch('/delete-group', {
        method: 'post',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionStorage.token}`
        },
        body: JSON.stringify({ groupName })
    }).then(() => fetchData());
}

const updateRole = (userId, role) => {
    fetch('/update-role', {
        method: 'post',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionStorage.token}`
        },
        body: JSON.stringify({ userId, role })
    }).then(() => fetchData());
}

const deleteUser = (userId) => {
    if(!confirm('Are you sure you want to delete this user?')) return;

    fetch('/delete-user', {
        method: 'post',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionStorage.token}`
        },
        body: JSON.stringify({ userId })
    }).then(() => fetchData());
}

const createGroup = () => {
    const groupName = document.querySelector('#new-group-name').value;
    if(!groupName) return alert('Enter group name');

    const permissions = {
        canBan: document.querySelector('#p-ban').checked,
        canDelete: document.querySelector('#p-delete').checked,
        canChangeRole: document.querySelector('#p-role').checked,
        canAssignGroup: document.querySelector('#p-group').checked,
        canViewLogs: document.querySelector('#p-logs').checked,
        canViewUsers: true 
    };

    fetch('/create-group', {
        method: 'post',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionStorage.token}`
        },
        body: JSON.stringify({ groupName, permissions })
    }).then(() => {
        resetGroupForm();
        fetchData();
    });
}

const assignGroup = (userId, groupName) => {
    fetch('/assign-group', {
        method: 'post',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionStorage.token}`
        },
        body: JSON.stringify({ userId, groupName })
    }).then(() => fetchData());
}

const toggleBan = (userId, banned) => {
    fetch('/toggle-ban', {
        method: 'post',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionStorage.token}`
        },
        body: JSON.stringify({ userId, banned: !banned })
    }).then(() => fetchData());
}

window.onload = () => {
    checkAdminAuth();
}
