const greeting = document.querySelector('.greeting');
const logOut = document.querySelector('.logout');

window.onload = () => {
    const token = sessionStorage.token;
    if (!token) {
        location.href = '/login';
        return;
    }

    // Auth Guard: Check session with server using JWT
    fetch('/check-auth', {
        headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => {
        if (!res.ok) {
            sessionStorage.clear();
            location.href = '/login';
            return;
        }
        return res.json();
    })
    .then(data => {
        if (data) {
            // Sync sessionStorage with server session
            sessionStorage.name = data.name;
            sessionStorage.group = data.group || 'none';
            
            const groupInfo = data.group && data.group !== 'none' 
                          ? `<br>from<br>team ${data.group}` 
                          : '';
            greeting.innerHTML = `hello ${data.name}${groupInfo}`;
        }
    });
}

logOut.onclick = () => {
    sessionStorage.clear();
    location.href = '/login';
}
