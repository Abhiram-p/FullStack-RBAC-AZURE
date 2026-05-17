// form loading animation

const form = [...document.querySelector('.form').children];

form.forEach((item, i) => {
    setTimeout(() => {
        item.style.opacity = 1;
    }, i*100);
})

window.onload = () => {
    if(sessionStorage.name){
        location.href = '/';
    }
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
            if(e.key === 'Enter') submitBtn.click();
        });
    }
});

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

const validateData = (data) => {
    if(!data.name){
        alertBox(data);
    } else{
        sessionStorage.name = data.name;
        sessionStorage.email = data.email;
        sessionStorage.group = data.group || 'none';
        sessionStorage.role = data.role || 'User';
        
        if(data.role === 'Admin' || data.role === 'Manager'){
            location.href = '/admin';
        } else {
            location.href = '/';
        }
    }
}

const alertBox = (data) => {
    const alertContainer = document.querySelector('.alert-box');
    const alertMsg = document.querySelector('.alert');
    alertMsg.innerHTML = data;

    alertContainer.style.top = `5%`;
    setTimeout(() => {
        alertContainer.style.top = null;
    }, 5000);
}