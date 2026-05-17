// form loading animation
window.addEventListener('load', () => {
    const formContainer = document.querySelector('.form');
    const formChildren = formContainer ? [...formContainer.children] : [];

    formChildren.forEach((item, i) => {
        setTimeout(() => {
            item.style.opacity = 1;
        }, i * 100);
    });

    // --- GITHUB OAUTH LOGIC ---
    const githubBtn = document.querySelector('.github-btn');
    const GITHUB_CLIENT_ID = "Ov23lilerskpgrSOkoTP"; 
    const REDIRECT_URI = window.location.origin + "/login";

    if(githubBtn) {
        githubBtn.onclick = () => {
            console.log("GitHub Button Clicked");
            const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&scope=user:email&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;
            window.location.href = githubAuthUrl;
        }
    }
});

window.onload = () => {
    const token = sessionStorage.token;

    // --- GITHUB CALLBACK LOGIC ---
    const urlParams = new URLSearchParams(window.location.search);
    const githubCode = urlParams.get('code');

    if (githubCode) {
        fetch('/github-login', {
            method: 'post',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ code: githubCode })
        })
        .then(res => res.json())
        .then(data => {
            window.history.replaceState({}, document.title, "/login"); // Clean URL
            validateData(data);
        })
        .catch(err => alertBox("GitHub Login Failed"));
        return;
    }

    if (!token) return;

    fetch('/check-auth', {
        headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => {
        if (res.ok) {
            return res.json();
        }
    })
    .then(data => {
        if (data) {
            if (data.hasDashboardAccess) {
                location.href = '/admin';
            } else {
                location.href = '/';
            }
        }
    });
}

// form validation
const name = document.querySelector('.name') || null;
const email = document.querySelector('.email');
const password = document.querySelector('.password');
const submitBtn = document.querySelector('.submit-btn');

// Add Enter key event listener to all inputs
[email, password, name].forEach(item => {
    if(item) {
        item.addEventListener('keyup', (e) => {
            if(e.key === 'Enter') if(submitBtn) submitBtn.click();
        });
    }
});

if(submitBtn) {
    if(name == null){ // means login page is open
        submitBtn.addEventListener('click', () => {
            fetch('/login-user',{
                method: 'post',
                headers: new Headers({'Content-Type': 'application/json'}),
                body: JSON.stringify({
                    email: email.value.toLowerCase().trim(), 
                    password: password.value.trim()
                })
            })
            .then(res => res.json())
            .then(data => {
                validateData(data);
            })
        })
    } else{ // means register page is open

        submitBtn.addEventListener('click', () => {
            fetch('/register-user', {
                method: 'post',
                headers: new Headers({'Content-Type': 'application/json'}),
                body: JSON.stringify({
                    name: name.value.trim(),
                    email: email.value.toLowerCase().trim(), 
                    password: password.value.trim()
                })
            })
            .then(res => res.json())
            .then(data => {
                validateData(data);
            })
        })
    }
}

const validateData = (data) => {
    if(!data.name){
        alertBox(data);
    } else{
        sessionStorage.name = data.name;
        sessionStorage.email = data.email;
        sessionStorage.group = data.group || 'none';
        sessionStorage.role = data.role || 'User';
        sessionStorage.token = data.token; // Store JWT
        
        if (data.hasDashboardAccess) {
            location.href = '/admin';
        } else {
            location.href = '/';
        }
    }
}

const alertBox = (data) => {
    const alertContainer = document.querySelector('.alert-box');
    const alertMsg = document.querySelector('.alert');
    if(alertMsg) alertMsg.innerHTML = data;

    if(alertContainer) {
        alertContainer.style.top = `5%`;
        setTimeout(() => {
            alertContainer.style.top = null;
        }, 5000);
    }
}
