const userTableBody = document.querySelector('#user-table-body');
const logOut = document.querySelector('.logout');
let groups = [];

logOut.onclick = () => {
    sessionStorage.clear();
    location.href = '/login';
}

const fetchData = async () => {
    const [usersRes, groupsRes] = await Promise.all([
        fetch('/get-users'),
        fetch('/get-groups')
    ]);
    
    const users = await usersRes.json();
    groups = await groupsRes.json();
    
    renderUsers(users);
}

const renderUsers = (users) => {
    userTableBody.innerHTML = '';
    users.forEach(user => {
        const groupOptions = ['none', ...groups].map(g => 
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

const updateRole = (userId, role) => {
    fetch('/update-role', {
        method: 'post',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ userId, role })
    }).then(() => fetchData());
}

const deleteUser = (userId) => {
    if(!confirm('Are you sure you want to delete this user?')) return;

    fetch('/delete-user', {
        method: 'post',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ userId })
    }).then(() => fetchData());
}

const createGroup = () => {
    const groupName = document.querySelector('#new-group-name').value;
    if(!groupName) return alert('Enter group name');

    fetch('/create-group', {
        method: 'post',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ groupName })
    }).then(() => {
        document.querySelector('#new-group-name').value = '';
        fetchData();
    });
}

const assignGroup = (userId, groupName) => {
    fetch('/assign-group', {
        method: 'post',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ userId, groupName })
    }).then(() => fetchData());
}

const toggleBan = (userId, banned) => {
    fetch('/toggle-ban', {
        method: 'post',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ userId, banned: !banned })
    }).then(() => fetchData());
}

window.onload = () => {
    if(!sessionStorage.name){
        location.href = '/login';
    } else {
        fetchData();
    }
}
