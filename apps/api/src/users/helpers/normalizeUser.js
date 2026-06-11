
const normalizeUser = (user) => {
    return{
        ...user,
        profilePicture: user.profilePicture || "https://cdn.pixabay.com/photo/2023/02/18/11/00/icon-7797704_640.png",
        coverImage: user.coverImage || 'https://images.unsplash.com/photo-1507608869274-d3177c8bb4c7?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
        job: user.job || 'Not Defined',
        gender: user.gender || 'Unknown',
        aboutMe: user.aboutMe || "Not Defined",
        address:{
            ...user.address,
            country: user.address?.country || "Not Defined",
            city: user.address?.city || "Not Defined",
            street: user.address?.street || "Not Defined",
            house: user.address?.house || 1,
            zip: user.address?.zip || 1 ,
    }}
} 

module.exports = normalizeUser;