// True when the user's profile still has any of the placeholder defaults the
// backend's normalizeUser leaves in place ("Not Defined", "Unknown", '', null).
// Drives the "Complete your profile" prompt on the feed page.
export default function isProfileIncomplete(user) {
    if (!user) return false;
    return (
        user?.address?.country === "Not Defined" ||
        user?.phone === '' ||
        user?.age === '' ||
        user?.job === "Not Defined" ||
        user?.gender === "Unknown" ||
        user?.birthDate === null ||
        user?.aboutMe === "Not Defined"
    );
}
