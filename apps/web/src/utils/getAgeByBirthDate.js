export function getAgeByDate(birthDateString) {

    const today = new Date();
    const birthDate = new Date(birthDateString);

    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDifference = today.getMonth() - birthDate.getMonth();

    if(monthDifference < 0 || (monthDifference === 0 && today.getDate() < birthDate.getDate())){
        age--;
    }
    return age;
}


export function getMaxBirthDate(minAge) {
    const date = new Date()
    date.setFullYear(date.getFullYear() - minAge)
    return date.toISOString().split("T")[0]
}
