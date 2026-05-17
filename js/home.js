const greeting = document.querySelector('.greeting');

window.onload = () => {
    if(!sessionStorage.name){
        location.href = '/login';
    } else{
        const groupInfo = sessionStorage.group && sessionStorage.group !== 'none' 
                      ? `<br>from<br>team ${sessionStorage.group}` 
                      : '';
        greeting.innerHTML = `hello ${sessionStorage.name}${groupInfo}`;
    }
}

const logOut = document.querySelector('.logout');

logOut.onclick = () => {
    sessionStorage.clear();
    location.reload();
}
